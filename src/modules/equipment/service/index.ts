// Phase 8 equipment service: Equipment, Maintenance, Calibration, Qualification.
// D2: calibrationStatus updated on calibration create. D5: no auto-actions.
// D6: OUT_OF_SERVICE guard on OperationExecution. D7: site-scoped.
// AI must never approve qualifications (PRD §9).
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ConflictError, ForbiddenError, NotFoundError, StateTransitionError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import { assertMaintTransition, assertQualTransition, computeCalibrationStatus, CreateEquipmentSchema, UpdateEquipmentSchema, CreateMaintenanceSchema, MaintTransitionSchema, CreateCalibrationSchema, CreateQualificationSchema, QualTransitionSchema } from "../domain";
import type z from "zod";

export async function listEquipment(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "equipment.read")) throw new ForbiddenError();
  const where: any = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.equipment.findMany({ where, orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { workCenter: { select: { code: true, name: true } }, site: { select: { code: true } }, _count: { select: { maintenanceRecords: true, calibrationRecords: true, qualifications: true } } } }),
    db.equipment.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
export async function createEquipment(ctx: AuthContext, input: z.infer<typeof CreateEquipmentSchema>) {
  if (!can(ctx, "equipment.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  if (input.workCenterId) {
    const wc = await db.workCenter.findUnique({ where: { id: input.workCenterId } });
    if (!wc || wc.siteId !== input.siteId) throw new StateTransitionError("WorkCenter must be at the same site as Equipment (D7)");
  }
  const existing = await db.equipment.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Equipment code already exists at this site");
  const eq = await db.equipment.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "equipment.create", entityType: "Equipment", entityId: eq.id, newState: { code: eq.code, name: eq.name, equipmentType: eq.equipmentType } });
  return eq;
}
export async function updateEquipment(ctx: AuthContext, id: string, input: z.infer<typeof UpdateEquipmentSchema>) {
  if (!can(ctx, "equipment.update")) throw new ForbiddenError();
  const eq = await db.equipment.findUnique({ where: { id } });
  if (!eq) throw new NotFoundError("Equipment");
  assertSiteAccess(ctx, eq.siteId);
  const updateData: any = { ...input };
  if (input.operationalStatus === "OUT_OF_SERVICE") updateData.calibrationStatus = "OUT_OF_SERVICE";
  else if (input.operationalStatus === "OPERATIONAL") {
    // Recompute calibration status based on latest calibration
    const latestCal = await db.calibrationRecord.findFirst({ where: { equipmentId: id }, orderBy: { calibratedAt: "desc" } });
    if (latestCal) updateData.calibrationStatus = computeCalibrationStatus(latestCal.nextCalibrationDue, input.operationalStatus);
    else updateData.calibrationStatus = "VALID";
  }
  const updated = await db.equipment.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "equipment.update", entityType: "Equipment", entityId: id, previousState: { operationalStatus: eq.operationalStatus, calibrationStatus: eq.calibrationStatus }, newState: { operationalStatus: updated.operationalStatus, calibrationStatus: updated.calibrationStatus } });
  return updated;
}
export async function createMaintenance(ctx: AuthContext, input: z.infer<typeof CreateMaintenanceSchema>) {
  if (!can(ctx, "equipment.maintenance.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) throw new NotFoundError("Equipment");
  assertSiteAccess(ctx, eq.siteId);
  if (eq.siteId !== input.siteId) throw new ForbiddenError("Cross-site: equipment is at a different site");
  const existing = await db.maintenanceRecord.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Maintenance code already exists at this site");
  const mr = await db.maintenanceRecord.create({ data: { ...input, performedByUserId: ctx.user.id, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "equipment.maintenance.create", entityType: "MaintenanceRecord", entityId: mr.id, newState: { code: mr.code, equipmentId: input.equipmentId, maintenanceType: input.maintenanceType } });
  return mr;
}
export async function transitionMaintenance(ctx: AuthContext, id: string, input: z.infer<typeof MaintTransitionSchema>) {
  if (!can(ctx, "equipment.maintenance.transition")) throw new ForbiddenError();
  const mr = await db.maintenanceRecord.findUnique({ where: { id } });
  if (!mr) throw new NotFoundError("MaintenanceRecord");
  assertSiteAccess(ctx, mr.siteId);
  assertMaintTransition(mr.status, input.to);
  const updateData: any = { status: input.to };
  if (input.to === "IN_PROGRESS") updateData.startedAt = new Date();
  if (input.to === "COMPLETED") updateData.completedAt = new Date();
  if (input.findings !== undefined) updateData.findings = input.findings;
  const updated = await db.maintenanceRecord.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "equipment.maintenance.transition", entityType: "MaintenanceRecord", entityId: id, previousState: { status: mr.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}
export async function createCalibration(ctx: AuthContext, input: z.infer<typeof CreateCalibrationSchema>) {
  if (!can(ctx, "equipment.calibration.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) throw new NotFoundError("Equipment");
  assertSiteAccess(ctx, eq.siteId);
  if (eq.siteId !== input.siteId) throw new ForbiddenError("Cross-site: equipment is at a different site");
  const existing = await db.calibrationRecord.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Calibration code already exists at this site");
  const cr = await db.calibrationRecord.create({ data: { ...input, performedByUserId: ctx.user.id, isDemo: false } });
  // D2: update Equipment.calibrationStatus based on the new calibration
  const newCalStatus = computeCalibrationStatus(input.nextCalibrationDue, eq.operationalStatus);
  await db.equipment.update({ where: { id: eq.id }, data: { calibrationStatus: newCalStatus } });
  await audit({ actorUserId: ctx.user.id, action: "equipment.calibration.create", entityType: "CalibrationRecord", entityId: cr.id, newState: { code: cr.code, equipmentId: input.equipmentId, result: input.result, newCalibrationStatus: newCalStatus } });
  return cr;
}
export async function createQualification(ctx: AuthContext, input: z.infer<typeof CreateQualificationSchema>) {
  if (!can(ctx, "equipment.qualification.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) throw new NotFoundError("Equipment");
  assertSiteAccess(ctx, eq.siteId);
  if (eq.siteId !== input.siteId) throw new ForbiddenError("Cross-site: equipment is at a different site");
  const existing = await db.qualification.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Qualification code already exists at this site");
  const qual = await db.qualification.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "equipment.qualification.create", entityType: "Qualification", entityId: qual.id, newState: { code: qual.code, equipmentId: input.equipmentId, qualificationType: input.qualificationType } });
  return qual;
}
export async function transitionQualification(ctx: AuthContext, id: string, input: z.infer<typeof QualTransitionSchema>) {
  if (!can(ctx, "equipment.qualification.transition")) throw new ForbiddenError();
  const qual = await db.qualification.findUnique({ where: { id } });
  if (!qual) throw new NotFoundError("Qualification");
  assertSiteAccess(ctx, qual.siteId);
  assertQualTransition(qual.status, input.to);
  const updateData: any = { status: input.to };
  if (input.executionResult !== undefined) updateData.executionResult = input.executionResult;
  if (input.deviationId !== undefined) updateData.deviationId = input.deviationId;
  if (input.reportRef !== undefined) updateData.reportRef = input.reportRef;
  const updated = await db.qualification.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "equipment.qualification.transition", entityType: "Qualification", entityId: id, previousState: { status: qual.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}
export async function approveQualification(ctx: AuthContext, id: string, reason: string) {
  if (!can(ctx, "equipment.qualification.approve")) throw new ForbiddenError(); // human-only (AI MUST NEVER)
  const qual = await db.qualification.findUnique({ where: { id } });
  if (!qual) throw new NotFoundError("Qualification");
  assertSiteAccess(ctx, qual.siteId);
  if (qual.status !== "APPROVAL") throw new StateTransitionError("Qualification can only be approved from APPROVAL status");
  const updated = await db.qualification.update({ where: { id }, data: { status: "REPORT", approvedByUserId: ctx.user.id, approvedAt: new Date() } });
  await audit({ actorUserId: ctx.user.id, action: "equipment.qualification.approve", entityType: "Qualification", entityId: id, previousState: { status: qual.status }, newState: { status: "REPORT", approvedByUserId: ctx.user.id }, reason });
  return updated;
}
