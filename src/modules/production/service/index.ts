// Phase 3 production service layer.
// Enforces RBAC (can), audit, multi-site isolation (SiteScope for site-owned entities),
// routing immutability (D6), WO/Batch/DeviceLot state machines (D7),
// transactional material consumption (D5), reservation invariants (D5), scrap/rework (D8).
// Critical logic lives here, NOT in the UI (PRD section 11).
// Genealogy: WorkOrder -> Batch -> DeviceLot -> OperationExecution -> MaterialConsumption -> MaterialLot.
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ConflictError, ForbiddenError, NotFoundError, StateTransitionError, ValidationError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";
import {
  assertBatchTransition,
  assertConsumptionQuantity,
  assertDlTransition,
  assertReservationQuantity,
  assertRoutingEditable,
  assertWoTransition,
  BatchTransitionSchema,
  CreateBatchSchema,
  CreateConsumptionSchema,
  CreateDeviceLotSchema,
  CreateOperationExecutionSchema,
  CreateOperationSchema,
  CreateReservationSchema,
  CreateReworkSchema,
  CreateScrapSchema,
  CreateShiftSchema,
  CreateWorkCenterSchema,
  CreateWorkOrderSchema,
  DeviceLotTransitionSchema,
  WorkOrderTransitionSchema,
} from "../domain";
import type z from "zod";

// ===========================================================================
// Routing + Operations (global, frozen at EFFECTIVE like BOM, D6)
// ===========================================================================

export async function getRouting(ctx: AuthContext, revisionId: string) {
  if (!can(ctx, "production.routing.read")) throw new ForbiddenError();
  const routing = await db.routing.findUnique({
    where: { productRevisionId: revisionId },
    include: { operations: { include: { workCenter: true }, orderBy: { sequence: "asc" } } },
  });
  return routing;
}

export async function ensureRouting(revisionId: string) {
  // Create a routing for a revision if it doesn't exist (1:1, D6).
  return db.routing.upsert({
    where: { productRevisionId: revisionId },
    update: {},
    create: { productRevisionId: revisionId, status: "DRAFT" },
  });
}

export async function addOperation(ctx: AuthContext, revisionId: string, input: z.infer<typeof CreateOperationSchema>) {
  if (!can(ctx, "production.routing.update")) throw new ForbiddenError();
  const rev = await db.productRevision.findUnique({ where: { id: revisionId }, include: { routing: true } });
  if (!rev) throw new NotFoundError("ProductRevision");
  assertRoutingEditable(rev.status); // D6
  const routing = rev.routing ?? (await ensureRouting(revisionId));
  if (input.workCenterId) {
    const wc = await db.workCenter.findUnique({ where: { id: input.workCenterId } });
    if (!wc) throw new NotFoundError("WorkCenter");
  }
  const op = await db.operation.create({ data: { routingId: routing.id, ...input } });
  await audit({ actorUserId: ctx.user.id, action: "production.operation.add", entityType: "Operation", entityId: op.id, newState: { sequence: op.sequence, name: op.name }, reason: `Revision ${rev.revisionCode} (DRAFT/IN_REVIEW)` });
  return op;
}

export async function updateOperation(ctx: AuthContext, opId: string, input: Partial<z.infer<typeof CreateOperationSchema>>) {
  if (!can(ctx, "production.routing.update")) throw new ForbiddenError();
  const op = await db.operation.findUnique({ where: { id: opId }, include: { routing: { include: { productRevision: true } } } });
  if (!op) throw new NotFoundError("Operation");
  assertRoutingEditable(op.routing.productRevision.status); // D6
  const updated = await db.operation.update({ where: { id: opId }, data: input });
  await audit({ actorUserId: ctx.user.id, action: "production.operation.update", entityType: "Operation", entityId: opId, newState: { sequence: updated.sequence, name: updated.name }, reason: `Revision ${op.routing.productRevision.revisionCode} (DRAFT/IN_REVIEW)` });
  return updated;
}

export async function deleteOperation(ctx: AuthContext, opId: string) {
  if (!can(ctx, "production.routing.update")) throw new ForbiddenError();
  const op = await db.operation.findUnique({ where: { id: opId }, include: { routing: { include: { productRevision: true } } } });
  if (!op) throw new NotFoundError("Operation");
  assertRoutingEditable(op.routing.productRevision.status); // D6
  await db.operation.delete({ where: { id: opId } });
  await audit({ actorUserId: ctx.user.id, action: "production.operation.delete", entityType: "Operation", entityId: opId, previousState: { sequence: op.sequence, name: op.name }, reason: `Revision ${op.routing.productRevision.revisionCode} (DRAFT/IN_REVIEW)` });
  return { id: opId };
}

// ===========================================================================
// Work Centers (site-owned)
// ===========================================================================

export async function listWorkCenters(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "production.workcenter.read")) throw new ForbiddenError();
  const where: Prisma.WorkCenterWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.workCenter.findMany({ where, orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { site: { select: { code: true, name: true } } } }),
    db.workCenter.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function createWorkCenter(ctx: AuthContext, input: z.infer<typeof CreateWorkCenterSchema>) {
  if (!can(ctx, "production.workcenter.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const existing = await db.workCenter.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("WorkCenter code already exists at this site");
  const wc = await db.workCenter.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "production.workcenter.create", entityType: "WorkCenter", entityId: wc.id, newState: { code: wc.code, name: wc.name, siteId: wc.siteId } });
  return wc;
}

export async function updateWorkCenter(ctx: AuthContext, id: string, input: { name?: string; description?: string | null; status?: string }) {
  if (!can(ctx, "production.workcenter.update")) throw new ForbiddenError();
  const wc = await db.workCenter.findUnique({ where: { id } });
  if (!wc) throw new NotFoundError("WorkCenter");
  assertSiteAccess(ctx, wc.siteId);
  const updated = await db.workCenter.update({ where: { id }, data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.status !== undefined ? { status: input.status } : {}) } });
  await audit({ actorUserId: ctx.user.id, action: "production.workcenter.update", entityType: "WorkCenter", entityId: id, previousState: { name: wc.name, status: wc.status }, newState: { name: updated.name, status: updated.status } });
  return updated;
}

// ===========================================================================
// Work Orders (site-owned, D7 state machine)
// ===========================================================================

export async function listWorkOrders(ctx: AuthContext, page: number, pageSize: number, filters?: { status?: string; siteId?: string }) {
  if (!can(ctx, "production.workorder.read")) throw new ForbiddenError();
  const where: Prisma.WorkOrderWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  if (filters?.status) where.status = filters.status;
  if (filters?.siteId) { assertSiteAccess(ctx, filters.siteId); where.siteId = filters.siteId; }
  const [items, total] = await Promise.all([
    db.workOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { productRevision: { include: { product: true } }, site: { select: { code: true, name: true } }, _count: { select: { batches: true } } } }),
    db.workOrder.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getWorkOrder(ctx: AuthContext, id: string) {
  if (!can(ctx, "production.workorder.read")) throw new ForbiddenError();
  const wo = await db.workOrder.findUnique({ where: { id }, include: { productRevision: { include: { product: true } }, site: true, batches: true, reservations: { include: { materialLot: true } } } });
  if (!wo) throw new NotFoundError("WorkOrder");
  assertSiteAccess(ctx, wo.siteId);
  return wo;
}

export async function createWorkOrder(ctx: AuthContext, input: z.infer<typeof CreateWorkOrderSchema>) {
  if (!can(ctx, "production.workorder.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const rev = await db.productRevision.findUnique({ where: { id: input.productRevisionId } });
  if (!rev) throw new NotFoundError("ProductRevision");
  if (rev.status !== "EFFECTIVE") throw new StateTransitionError("Work Orders can only be created for EFFECTIVE product revisions");
  const existing = await db.workOrder.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Work Order code already exists at this site");
  const wo = await db.workOrder.create({ data: { ...input, status: "PLANNED", isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "production.workorder.create", entityType: "WorkOrder", entityId: wo.id, newState: { code: wo.code, productRevisionId: wo.productRevisionId, siteId: wo.siteId, plannedQuantity: wo.plannedQuantity } });
  return wo;
}

export async function transitionWorkOrder(ctx: AuthContext, id: string, input: z.infer<typeof WorkOrderTransitionSchema>) {
  if (!can(ctx, "production.workorder.transition")) throw new ForbiddenError();
  const wo = await db.workOrder.findUnique({ where: { id } });
  if (!wo) throw new NotFoundError("WorkOrder");
  assertSiteAccess(ctx, wo.siteId);
  assertWoTransition(wo.status, input.to); // D7
  const updateData: Prisma.WorkOrderUpdateInput = { status: input.to };
  if (input.to === "RELEASED") updateData.releasedAt = new Date();
  if (input.to === "CLOSED") updateData.closedAt = new Date();
  if (input.to === "ON_HOLD" || input.to === "CANCELLED") updateData.reason = input.reason;
  const updated = await db.workOrder.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "production.workorder.transition", entityType: "WorkOrder", entityId: id, previousState: { status: wo.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}

// ===========================================================================
// Manufacturing Batches (site-owned, D7 state machine, D1 1:N DeviceLot)
// ===========================================================================

export async function listBatches(ctx: AuthContext, page: number, pageSize: number, filters?: { status?: string; workOrderId?: string; siteId?: string }) {
  if (!can(ctx, "production.batch.read")) throw new ForbiddenError();
  const where: Prisma.ManufacturingBatchWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  if (filters?.status) where.status = filters.status;
  if (filters?.workOrderId) where.workOrderId = filters.workOrderId;
  if (filters?.siteId) { assertSiteAccess(ctx, filters.siteId); where.siteId = filters.siteId; }
  const [items, total] = await Promise.all([
    db.manufacturingBatch.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { workOrder: { select: { code: true } }, productRevision: { include: { product: true } }, site: { select: { code: true, name: true } }, _count: { select: { deviceLots: true, executions: true, consumptions: true } } } }),
    db.manufacturingBatch.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getBatch(ctx: AuthContext, id: string) {
  if (!can(ctx, "production.batch.read")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id }, include: { workOrder: true, productRevision: { include: { product: true } }, site: true, deviceLots: true, executions: { include: { operation: true, workCenter: true, operator: true } }, consumptions: { include: { materialLot: { include: { material: true } } } }, scraps: true, reworks: true } });
  if (!batch) throw new NotFoundError("ManufacturingBatch");
  assertSiteAccess(ctx, batch.siteId);
  return batch;
}

export async function createBatch(ctx: AuthContext, workOrderId: string, input: z.infer<typeof CreateBatchSchema>) {
  if (!can(ctx, "production.batch.create")) throw new ForbiddenError();
  const wo = await db.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw new NotFoundError("WorkOrder");
  assertSiteAccess(ctx, wo.siteId);
  if (!["RELEASED", "IN_PRODUCTION", "ON_HOLD"].includes(wo.status)) {
    throw new StateTransitionError(`Cannot create batch for Work Order in status ${wo.status} (must be RELEASED or IN_PRODUCTION)`);
  }
  const existing = await db.manufacturingBatch.findUnique({ where: { siteId_code: { siteId: wo.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Batch code already exists at this site");
  const batch = await db.manufacturingBatch.create({ data: { code: input.code, workOrderId, productRevisionId: wo.productRevisionId, siteId: wo.siteId, plannedQuantity: input.plannedQuantity, unit: input.unit, status: "PLANNED", isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "production.batch.create", entityType: "ManufacturingBatch", entityId: batch.id, newState: { code: batch.code, workOrderId, siteId: batch.siteId }, reason: `Created for WO ${wo.code}` });
  return batch;
}

export async function transitionBatch(ctx: AuthContext, id: string, input: z.infer<typeof BatchTransitionSchema>) {
  if (!can(ctx, "production.batch.transition")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id } });
  if (!batch) throw new NotFoundError("ManufacturingBatch");
  assertSiteAccess(ctx, batch.siteId);
  assertBatchTransition(batch.status, input.to); // D7
  const updateData: Prisma.ManufacturingBatchUpdateInput = { status: input.to };
  if (input.to === "IN_PRODUCTION") updateData.startedAt = new Date();
  if (input.to === "COMPLETED") updateData.completedAt = new Date();
  const updated = await db.manufacturingBatch.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "production.batch.transition", entityType: "ManufacturingBatch", entityId: id, previousState: { status: batch.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}

// ===========================================================================
// Device Lots (site-owned, split from a batch, D1 1:N)
// ===========================================================================

export async function listDeviceLots(ctx: AuthContext, batchId: string) {
  if (!can(ctx, "production.devicelot.read")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("ManufacturingBatch");
  assertSiteAccess(ctx, batch.siteId);
  return db.deviceLot.findMany({ where: { batchId }, orderBy: { code: "asc" } });
}

export async function createDeviceLot(ctx: AuthContext, batchId: string, input: z.infer<typeof CreateDeviceLotSchema>) {
  if (!can(ctx, "production.devicelot.create")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("ManufacturingBatch");
  assertSiteAccess(ctx, batch.siteId);
  const existing = await db.deviceLot.findUnique({ where: { siteId_code: { siteId: batch.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Device Lot code already exists at this site");
  const dl = await db.deviceLot.create({ data: { code: input.code, batchId, siteId: batch.siteId, quantity: input.quantity, unit: input.unit, status: "CREATED", isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "production.devicelot.create", entityType: "DeviceLot", entityId: dl.id, newState: { code: dl.code, batchId, quantity: dl.quantity }, reason: `Split from batch ${batch.code}` });
  return dl;
}

export async function transitionDeviceLot(ctx: AuthContext, id: string, input: z.infer<typeof DeviceLotTransitionSchema>) {
  if (!can(ctx, "production.devicelot.transition")) throw new ForbiddenError();
  const dl = await db.deviceLot.findUnique({ where: { id } });
  if (!dl) throw new NotFoundError("DeviceLot");
  assertSiteAccess(ctx, dl.siteId);
  assertDlTransition(dl.status, input.to); // D7
  const updated = await db.deviceLot.update({ where: { id }, data: { status: input.to } });
  await audit({ actorUserId: ctx.user.id, action: "production.devicelot.transition", entityType: "DeviceLot", entityId: id, previousState: { status: dl.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}

// ===========================================================================
// Operation Executions (site-owned via batch, D4 Operator=Employee + Logger=User)
// ===========================================================================

export async function createExecution(ctx: AuthContext, batchId: string, input: z.infer<typeof CreateOperationExecutionSchema>) {
  if (!can(ctx, "production.execution.create")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("ManufacturingBatch");
  assertSiteAccess(ctx, batch.siteId);
  if (!["IN_PRODUCTION", "ON_HOLD"].includes(batch.status)) {
    throw new StateTransitionError(`Cannot log execution for batch in status ${batch.status}`);
  }
  const op = await db.operation.findUnique({ where: { id: input.operationId } });
  if (!op) throw new NotFoundError("Operation");
  const emp = await db.employee.findUnique({ where: { id: input.operatorEmployeeId } });
  if (!emp) throw new NotFoundError("Employee (operator)");
  if (input.workCenterId) {
    const wc = await db.workCenter.findUnique({ where: { id: input.workCenterId } });
    if (!wc) throw new NotFoundError("WorkCenter");
  }
  const exec = await db.operationExecution.create({ data: { batchId, operationId: input.operationId, workCenterId: input.workCenterId ?? null, startedAt: input.startedAt, completedAt: input.completedAt ?? null, status: input.status, operatorEmployeeId: input.operatorEmployeeId, loggedByUserId: ctx.user.id, parameters: (input.parameters ?? null) as never, notes: input.notes ?? null } });
  await audit({ actorUserId: ctx.user.id, action: "production.execution.create", entityType: "OperationExecution", entityId: exec.id, newState: { batchId, operationId: input.operationId, operatorEmployeeId: input.operatorEmployeeId }, reason: `Logged for batch ${batch.code}` });
  return exec;
}

// ===========================================================================
// Material Consumption (TRANSACTIONAL, D5: decrement available, reject over-consumption, genealogy)
// ===========================================================================

export async function createConsumption(ctx: AuthContext, batchId: string, input: z.infer<typeof CreateConsumptionSchema>) {
  if (!can(ctx, "production.consumption.create")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("ManufacturingBatch");
  assertSiteAccess(ctx, batch.siteId);
  if (!["IN_PRODUCTION", "ON_HOLD"].includes(batch.status)) {
    throw new StateTransitionError(`Cannot consume material for batch in status ${batch.status}`);
  }
  const lot = await db.materialLot.findUnique({ where: { id: input.materialLotId } });
  if (!lot) throw new NotFoundError("MaterialLot");
  assertSiteAccess(ctx, lot.siteId);
  assertConsumptionQuantity(input.quantity, lot.quantityAvailable.toString()); // D5: reject over-consumption

  // TRANSACTIONAL: decrement available + create consumption record in one transaction.
  const consumption = await db.$transaction(async (tx) => {
    // Re-read the lot inside the transaction with a lock (SQLite: the UPDATE itself serializes).
    const freshLot = await tx.materialLot.findUniqueOrThrow({ where: { id: lot.id } });
    const available = parseFloat(freshLot.quantityAvailable.toString());
    const qty = parseFloat(input.quantity);
    if (qty > available) {
      throw new StateTransitionError(`Over-consumption (concurrent): requested ${qty} but only ${available} available`);
    }
    const updatedLot = await tx.materialLot.update({ where: { id: lot.id }, data: { quantityAvailable: available - qty } });
    const c = await tx.materialConsumption.create({ data: { batchId, materialLotId: lot.id, quantity: input.quantity, unit: input.unit, recordedByUserId: ctx.user.id, notes: input.notes ?? null } });
    return { consumption: c, newAvailable: updatedLot.quantityAvailable };
  });
  await audit({ actorUserId: ctx.user.id, action: "production.consumption.create", entityType: "MaterialConsumption", entityId: consumption.consumption.id, newState: { batchId, materialLotId: lot.id, quantity: input.quantity, newAvailable: consumption.newAvailable }, reason: `Consumed for batch ${batch.code}` });
  return consumption.consumption;
}

// ===========================================================================
// Material Reservation (D5: update quantityReserved, not consumed)
// ===========================================================================

export async function createReservation(ctx: AuthContext, workOrderId: string, input: z.infer<typeof CreateReservationSchema>) {
  if (!can(ctx, "production.reservation.create")) throw new ForbiddenError();
  const wo = await db.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) throw new NotFoundError("WorkOrder");
  assertSiteAccess(ctx, wo.siteId);
  const lot = await db.materialLot.findUnique({ where: { id: input.materialLotId } });
  if (!lot) throw new NotFoundError("MaterialLot");
  assertSiteAccess(ctx, lot.siteId);
  assertReservationQuantity(input.quantityReserved, lot.quantityAvailable.toString(), lot.quantityReserved.toString(), lot.quantityReceived.toString()); // D5

  const reservation = await db.$transaction(async (tx) => {
    const freshLot = await tx.materialLot.findUniqueOrThrow({ where: { id: lot.id } });
    const available = parseFloat(freshLot.quantityAvailable.toString());
    const reserved = parseFloat(freshLot.quantityReserved.toString());
    const received = parseFloat(freshLot.quantityReceived.toString());
    const qty = parseFloat(input.quantityReserved);
    if (available + reserved + qty > received) {
      throw new StateTransitionError(`Reservation exceeds capacity (concurrent): available ${available} + reserved ${reserved} + new ${qty} > received ${received}`);
    }
    await tx.materialLot.update({ where: { id: lot.id }, data: { quantityReserved: reserved + qty } });
    return tx.materialReservation.create({ data: { workOrderId, materialLotId: lot.id, quantityReserved: input.quantityReserved, unit: input.unit, status: "ACTIVE" } });
  });
  await audit({ actorUserId: ctx.user.id, action: "production.reservation.create", entityType: "MaterialReservation", entityId: reservation.id, newState: { workOrderId, materialLotId: lot.id, quantityReserved: input.quantityReserved }, reason: `Reserved for WO ${wo.code}` });
  return reservation;
}

// ===========================================================================
// Scrap + Rework (D8: record events with quantity + reason; full investigation in Phase 6)
// ===========================================================================

export async function createScrap(ctx: AuthContext, batchId: string, input: z.infer<typeof CreateScrapSchema>) {
  if (!can(ctx, "production.scrap.create")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("ManufacturingBatch");
  assertSiteAccess(ctx, batch.siteId);
  if (input.deviceLotId) {
    const dl = await db.deviceLot.findUnique({ where: { id: input.deviceLotId } });
    if (!dl || dl.batchId !== batchId) throw new ValidationError("Device Lot does not belong to this batch");
  }
  const scrap = await db.productionScrap.create({ data: { batchId, deviceLotId: input.deviceLotId ?? null, quantity: input.quantity, unit: input.unit, reason: input.reason, recordedByUserId: ctx.user.id } });
  await audit({ actorUserId: ctx.user.id, action: "production.scrap.create", entityType: "ProductionScrap", entityId: scrap.id, newState: { batchId, quantity: input.quantity, reason: input.reason }, reason: `Scrap for batch ${batch.code}` });
  return scrap;
}

export async function createRework(ctx: AuthContext, batchId: string, input: z.infer<typeof CreateReworkSchema>) {
  if (!can(ctx, "production.rework.create")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new NotFoundError("ManufacturingBatch");
  assertSiteAccess(ctx, batch.siteId);
  if (input.deviceLotId) {
    const dl = await db.deviceLot.findUnique({ where: { id: input.deviceLotId } });
    if (!dl || dl.batchId !== batchId) throw new ValidationError("Device Lot does not belong to this batch");
  }
  const rework = await db.productionRework.create({ data: { batchId, deviceLotId: input.deviceLotId ?? null, quantity: input.quantity, unit: input.unit, reason: input.reason, recordedByUserId: ctx.user.id } });
  await audit({ actorUserId: ctx.user.id, action: "production.rework.create", entityType: "ProductionRework", entityId: rework.id, newState: { batchId, quantity: input.quantity, reason: input.reason }, reason: `Rework for batch ${batch.code}` });
  return rework;
}

// ===========================================================================
// Shifts (site-owned, basic)
// ===========================================================================

export async function listShifts(ctx: AuthContext) {
  if (!can(ctx, "production.shift.read")) throw new ForbiddenError();
  const where: Prisma.ShiftWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  return db.shift.findMany({ where, orderBy: { startTime: "asc" }, include: { site: { select: { code: true, name: true } } } });
}

export async function createShift(ctx: AuthContext, input: z.infer<typeof CreateShiftSchema>) {
  if (!can(ctx, "production.shift.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const existing = await db.shift.findUnique({ where: { siteId_name: { siteId: input.siteId, name: input.name } } });
  if (existing) throw new ConflictError("Shift name already exists at this site");
  const shift = await db.shift.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "production.shift.create", entityType: "Shift", entityId: shift.id, newState: { name: shift.name, siteId: shift.siteId } });
  return shift;
}

// ===========================================================================
// Genealogy queries (foundation for Phase 4; minimal in Phase 3)
// ===========================================================================

// "Which Material Lots were consumed to manufacture this Device Lot?" (via batch)
export async function getDeviceLotGenealogy(ctx: AuthContext, deviceLotId: string) {
  if (!can(ctx, "production.devicelot.read")) throw new ForbiddenError();
  const dl = await db.deviceLot.findUnique({ where: { id: deviceLotId }, include: { batch: { include: { workOrder: { include: { productRevision: { include: { product: true, bom: { include: { lines: { include: { material: true } } } }, routing: { include: { operations: true } } } } } }, consumptions: { include: { materialLot: { include: { material: true, supplier: true } } } } } } } });
  if (!dl) throw new NotFoundError("DeviceLot");
  assertSiteAccess(ctx, dl.siteId);
  return dl;
}
