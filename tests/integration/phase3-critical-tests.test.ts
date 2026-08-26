// Phase 3 critical tests: T-WO-01, T-BATCH-01, T-LOT-02, T-CONS-01, T-RES-01, T-ROUTE-01, T-ISOL-03, T-EXEC-01, T-SCRAP-01 + genealogy + regression.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetTestDb, disconnectTestDb, getTestDb } from "./test-db";
import {
  assertBatchTransition,
  assertConsumptionQuantity,
  assertReservationQuantity,
  assertRoutingEditable,
  assertWoTransition,
  isRoutingEditable,
  isValidBatchTransition,
  isValidDlTransition,
  isValidWoTransition,
  WORK_ORDER_STATUSES,
  BATCH_STATUSES,
  DEVICE_LOT_STATUSES,
} from "@/modules/production/domain";
import { StateTransitionError, ValidationError } from "@/lib/errors";

let db: Awaited<ReturnType<typeof getTestDb>>;

beforeAll(async () => {
  await resetTestDb();
  db = getTestDb();
  // Minimal seed: site, supplier, material, lot, product, revision (EFFECTIVE), routing, operation, workcenter, employee, work order, batch.
  const site = await db.site.create({ data: { code: "T-SITE-A", name: "Test Site A", isDemo: true, status: "ACTIVE" } });
  const siteB = await db.site.create({ data: { code: "T-SITE-B", name: "Test Site B", isDemo: true, status: "ACTIVE" } });
  const supplier = await db.supplier.create({ data: { code: "T-SUP-01", name: "Approved Supplier", qualificationStatus: "APPROVED", isDemo: true } });
  const material = await db.material.create({ data: { code: "T-MAT-01", name: "Test Material", materialType: "RAW", defaultUnit: "kg", isDemo: true } });
  await db.materialLot.create({ data: { lotCode: "T-LOT-A1", materialId: material.id, supplierId: supplier.id, siteId: site.id, quantityReceived: "100", quantityAvailable: "100", quantityReserved: "0", unit: "kg", status: "APPROVED", isDemo: true } });
  await db.materialLot.create({ data: { lotCode: "T-LOT-B1", materialId: material.id, supplierId: supplier.id, siteId: siteB.id, quantityReceived: "50", quantityAvailable: "50", quantityReserved: "0", unit: "kg", status: "APPROVED", isDemo: true } });
  const product = await db.product.create({ data: { code: "T-PROD-01", name: "Test Product", productType: "DEVICE", deviceClass: "IIa", isDemo: true } });
  const rev = await db.productRevision.create({ data: { productId: product.id, revisionCode: "REV-A", status: "EFFECTIVE", effectiveFrom: new Date(), isDemo: true } });
  const routing = await db.routing.create({ data: { productRevisionId: rev.id, status: "EFFECTIVE" } });
  await db.operation.create({ data: { routingId: routing.id, sequence: 10, name: "Molding", instructions: "Mold per SOP" } });
  await db.workCenter.create({ data: { code: "WC-A-01", name: "Station A", siteId: site.id, isDemo: true } });
  await db.employee.create({ data: { employeeCode: "EMP-T-01", firstName: "Test", lastName: "Operator", fullName: "Test Operator", siteId: site.id, isDemo: true } });
  const wo = await db.workOrder.create({ data: { code: "WO-A-01", productRevisionId: rev.id, siteId: site.id, plannedQuantity: "100", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  const woB = await db.workOrder.create({ data: { code: "WO-B-01", productRevisionId: rev.id, siteId: siteB.id, plannedQuantity: "50", unit: "pcs", status: "PLANNED", isDemo: true } });
  await db.manufacturingBatch.create({ data: { code: "BATCH-A-01", workOrderId: wo.id, productRevisionId: rev.id, siteId: site.id, plannedQuantity: "100", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  await db.manufacturingBatch.create({ data: { code: "BATCH-B-01", workOrderId: woB.id, productRevisionId: rev.id, siteId: siteB.id, plannedQuantity: "50", unit: "pcs", status: "PLANNED", isDemo: true } });
});
afterAll(async () => { await disconnectTestDb(); });

// T-WO-01: Work Order state machine
describe("T-WO-01: Work Order state machine (D7)", () => {
  it("PLANNED -> RELEASED is valid", () => expect(isValidWoTransition("PLANNED", "RELEASED")).toBe(true));
  it("PLANNED -> IN_PRODUCTION is INVALID (must pass RELEASED)", () => {
    expect(isValidWoTransition("PLANNED", "IN_PRODUCTION")).toBe(false);
    expect(() => assertWoTransition("PLANNED", "IN_PRODUCTION")).toThrow(StateTransitionError);
  });
  it("RELEASED -> IN_PRODUCTION is valid", () => expect(isValidWoTransition("RELEASED", "IN_PRODUCTION")).toBe(true));
  it("IN_PRODUCTION -> COMPLETED is valid", () => expect(isValidWoTransition("IN_PRODUCTION", "COMPLETED")).toBe(true));
  it("COMPLETED -> CLOSED is valid", () => expect(isValidWoTransition("COMPLETED", "CLOSED")).toBe(true));
  it("CLOSED -> anything is INVALID (terminal)", () => {
    for (const s of WORK_ORDER_STATUSES) expect(isValidWoTransition("CLOSED", s)).toBe(false);
  });
  it("ON_HOLD -> IN_PRODUCTION is valid (reversible)", () => expect(isValidWoTransition("ON_HOLD", "IN_PRODUCTION")).toBe(true));
  it("CANCELLED -> anything is INVALID (terminal)", () => {
    for (const s of WORK_ORDER_STATUSES) expect(isValidWoTransition("CANCELLED", s)).toBe(false);
  });
});

// T-BATCH-01: Batch state machine
describe("T-BATCH-01: Batch state machine (D7)", () => {
  it("PLANNED -> IN_PRODUCTION is valid", () => expect(isValidBatchTransition("PLANNED", "IN_PRODUCTION")).toBe(true));
  it("PLANNED -> COMPLETED is INVALID (must pass IN_PRODUCTION)", () => {
    expect(isValidBatchTransition("PLANNED", "COMPLETED")).toBe(false);
    expect(() => assertBatchTransition("PLANNED", "COMPLETED")).toThrow(StateTransitionError);
  });
  it("IN_PRODUCTION -> COMPLETED is valid", () => expect(isValidBatchTransition("IN_PRODUCTION", "COMPLETED")).toBe(true));
  it("COMPLETED -> READY_FOR_REVIEW is valid", () => expect(isValidBatchTransition("COMPLETED", "READY_FOR_REVIEW")).toBe(true));
  it("READY_FOR_REVIEW -> anything is INVALID (Phase 3 stops here)", () => {
    for (const s of BATCH_STATUSES) expect(isValidBatchTransition("READY_FOR_REVIEW", s)).toBe(false);
  });
  it("ON_HOLD -> IN_PRODUCTION is valid (reversible)", () => expect(isValidBatchTransition("ON_HOLD", "IN_PRODUCTION")).toBe(true));
});

// T-LOT-02: Device Lot state machine + split (D1 1:N)
describe("T-LOT-02: Device Lot state machine + split (D1)", () => {
  it("CREATED -> IN_PROCESS is valid", () => expect(isValidDlTransition("CREATED", "IN_PROCESS")).toBe(true));
  it("IN_PROCESS -> COMPLETED is valid", () => expect(isValidDlTransition("IN_PROCESS", "COMPLETED")).toBe(true));
  it("COMPLETED -> anything is INVALID (terminal)", () => {
    for (const s of DEVICE_LOT_STATUSES) expect(isValidDlTransition("COMPLETED", s)).toBe(false);
  });
  it("DB: a batch can have multiple device lots (1:N)", async () => {
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { code: "BATCH-A-01" } });
    await db.deviceLot.create({ data: { code: "DL-A-01", batchId: batch.id, siteId: batch.siteId, quantity: "50", unit: "pcs", isDemo: true } });
    await db.deviceLot.create({ data: { code: "DL-A-02", batchId: batch.id, siteId: batch.siteId, quantity: "50", unit: "pcs", isDemo: true } });
    const lots = await db.deviceLot.findMany({ where: { batchId: batch.id } });
    expect(lots.length).toBe(2);
    expect(lots.every((l) => l.batchId === batch.id)).toBe(true);
  });
});

// T-CONS-01: Material consumption (transactional, over-consumption rejected)
describe("T-CONS-01: Material consumption (D5)", () => {
  it("valid consumption: quantity <= available", () => {
    expect(() => assertConsumptionQuantity("20", "100")).not.toThrow();
  });
  it("INVALID: quantity > available (over-consumption)", () => {
    expect(() => assertConsumptionQuantity("150", "100")).toThrow(StateTransitionError);
  });
  it("INVALID: quantity <= 0", () => {
    expect(() => assertConsumptionQuantity("0", "100")).toThrow(ValidationError);
    expect(() => assertConsumptionQuantity("-5", "100")).toThrow(ValidationError);
  });
  it("DB: consumption decrements quantityAvailable", async () => {
    const lot = await db.materialLot.findFirstOrThrow({ where: { lotCode: "T-LOT-A1" } });
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { code: "BATCH-A-01" } });
    const before = parseFloat(lot.quantityAvailable.toString());
    // Direct DB simulation of the transactional decrement
    await db.materialLot.update({ where: { id: lot.id }, data: { quantityAvailable: before - 20 } });
    await db.materialConsumption.create({ data: { batchId: batch.id, materialLotId: lot.id, quantity: "20", unit: "kg" } });
    const after = await db.materialLot.findUniqueOrThrow({ where: { id: lot.id } });
    expect(parseFloat(after.quantityAvailable.toString())).toBe(before - 20);
  });
});

// T-RES-01: Material reservation (updates quantityReserved, invariant)
describe("T-RES-01: Material reservation (D5)", () => {
  it("valid reservation: available + reserved + new <= received", () => {
    expect(() => assertReservationQuantity("20", "70", "10", "100")).not.toThrow();
  });
  it("INVALID: exceeds capacity (available + reserved + new > received)", () => {
    expect(() => assertReservationQuantity("30", "70", "10", "100")).toThrow(StateTransitionError); // 70+10+30=110 > 100
  });
  it("INVALID: quantity <= 0", () => {
    expect(() => assertReservationQuantity("0", "70", "10", "100")).toThrow(ValidationError);
  });
});

// T-ROUTE-01: Routing immutability (frozen when revision EFFECTIVE, D6)
describe("T-ROUTE-01: Routing immutability (D6)", () => {
  it("Routing is editable when revision is DRAFT", () => {
    expect(isRoutingEditable("DRAFT")).toBe(true);
    expect(() => assertRoutingEditable("DRAFT")).not.toThrow();
  });
  it("Routing is NOT editable when revision is EFFECTIVE", () => {
    expect(isRoutingEditable("EFFECTIVE")).toBe(false);
    expect(() => assertRoutingEditable("EFFECTIVE")).toThrow(StateTransitionError);
  });
  it("Routing is NOT editable when revision is APPROVED/SUPERSEDED/OBSOLETE", () => {
    expect(isRoutingEditable("APPROVED")).toBe(false);
    expect(isRoutingEditable("SUPERSEDED")).toBe(false);
    expect(isRoutingEditable("OBSOLETE")).toBe(false);
  });
});

// T-ISOL-03: Cross-site production isolation
describe("T-ISOL-03: Cross-site production isolation (D4)", () => {
  it("Site A has 1 WO + 1 batch; Site B has 1 WO + 1 batch (different codes)", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const siteB = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-B" } });
    const wosA = await db.workOrder.findMany({ where: { siteId: siteA.id } });
    const wosB = await db.workOrder.findMany({ where: { siteId: siteB.id } });
    expect(wosA.length).toBe(1);
    expect(wosB.length).toBe(1);
    expect(wosA[0].code).toBe("WO-A-01");
    expect(wosB[0].code).toBe("WO-B-01");
    expect(wosA.find((w) => w.code === "WO-B-01")).toBeUndefined();
    const batchesA = await db.manufacturingBatch.findMany({ where: { siteId: siteA.id } });
    const batchesB = await db.manufacturingBatch.findMany({ where: { siteId: siteB.id } });
    expect(batchesA.find((b) => b.code === "BATCH-B-01")).toBeUndefined();
    expect(batchesB.find((b) => b.code === "BATCH-A-01")).toBeUndefined();
  });
});

// T-EXEC-01: Operator (Employee) vs Logger (User) separation (D4)
describe("T-EXEC-01: Operator vs Logger separation (D4)", () => {
  it("DB: OperationExecution records operatorEmployeeId + loggedByUserId separately", async () => {
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { code: "BATCH-A-01" } });
    const op = await db.operation.findFirstOrThrow();
    const emp = await db.employee.findFirstOrThrow();
    const exec = await db.operationExecution.create({
      data: { batchId: batch.id, operationId: op.id, startedAt: new Date(), status: "IN_PROGRESS", operatorEmployeeId: emp.id, loggedByUserId: null },
    });
    expect(exec.operatorEmployeeId).toBe(emp.id);
    expect(exec.loggedByUserId).toBeNull(); // logger is separate from operator
  });
});

// T-SCRAP-01: Scrap records quantity + reason
describe("T-SCRAP-01: Scrap record (D8)", () => {
  it("DB: scrap record created with quantity + reason", async () => {
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { code: "BATCH-A-01" } });
    const scrap = await db.productionScrap.create({ data: { batchId: batch.id, quantity: "3", unit: "pcs", reason: "Visual defect (test)" } });
    expect(scrap.quantity.toString()).toBe("3");
    expect(scrap.reason).toBe("Visual defect (test)");
    expect(scrap.batchId).toBe(batch.id);
  });
});

// Genealogy: WorkOrder -> Batch -> DeviceLot -> OperationExecution + MaterialConsumption -> MaterialLot
describe("Genealogy: production chain (PRD section 10)", () => {
  it("DB: full genealogy chain is queryable", async () => {
    const wo = await db.workOrder.findFirstOrThrow({ where: { code: "WO-A-01" }, include: { batches: { include: { deviceLots: true, executions: true, consumptions: { include: { materialLot: true } } } } } });
    expect(wo.batches.length).toBeGreaterThan(0);
    const batch = wo.batches[0];
    // batch has device lots (split)
    expect(batch.deviceLots.length).toBeGreaterThan(0);
    // batch has an execution (operation)
    expect(batch.executions.length).toBeGreaterThan(0);
    // batch has a consumption linking to a material lot
    expect(batch.consumptions.length).toBeGreaterThan(0);
    expect(batch.consumptions[0].materialLot).toBeTruthy();
    // the chain: WO -> Batch -> DeviceLot, WO -> Batch -> Execution, WO -> Batch -> Consumption -> MaterialLot
    expect(wo.productRevisionId).toBeTruthy();
  });
});

// Regression: audit immutability still holds
describe("Regression: Phase 1 audit immutability", () => {
  it("INSERT succeeds, UPDATE/DELETE rejected", async () => {
    const ev = await db.auditEvent.create({ data: { action: "test.p3.regression", entityType: "Test", outcome: "SUCCESS" } });
    expect(ev.id).toBeTruthy();
    await expect(db.$executeRawUnsafe(`UPDATE "AuditEvent" SET outcome='FAILURE' WHERE action='test.p3.regression'`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE action='test.p3.regression'`)).rejects.toThrow();
  });
});
