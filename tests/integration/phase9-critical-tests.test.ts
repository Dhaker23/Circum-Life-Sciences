// Phase 9 critical tests: T-CR-01/02/03, T-PKG-01, T-STER-01/02, T-BR-01/02, T-ISOL-09, T-AI-GUARD-06 + regression.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetTestDb, disconnectTestDb, getTestDb } from "./test-db";
import { evaluateMonitoringResult, assertExcursionTransition, assertPackagingTransition, assertSterTransition, assertBatchReviewTransition } from "@/modules/phase9/domain";
import { StateTransitionError } from "@/lib/errors";

let db: Awaited<ReturnType<typeof getTestDb>>;

beforeAll(async () => {
  await resetTestDb();
  db = getTestDb();
  const site = await db.site.create({ data: { code: "T-SITE-A", name: "A", isDemo: true, status: "ACTIVE" } });
  const siteB = await db.site.create({ data: { code: "T-SITE-B", name: "B", isDemo: true, status: "ACTIVE" } });
  const product = await db.product.create({ data: { code: "T-PROD-01", name: "P", productType: "DEVICE", deviceClass: "IIa", isDemo: true } });
  const rev = await db.productRevision.create({ data: { productId: product.id, revisionCode: "REV-A", status: "EFFECTIVE", effectiveFrom: new Date(), isDemo: true } });
  const wo = await db.workOrder.create({ data: { code: "WO-A", productRevisionId: rev.id, siteId: site.id, plannedQuantity: "100", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  const batch = await db.manufacturingBatch.create({ data: { code: "BAT-A", workOrderId: wo.id, productRevisionId: rev.id, siteId: site.id, plannedQuantity: "100", unit: "pcs", status: "READY_FOR_REVIEW", isDemo: true } });
  await db.deviceLot.create({ data: { code: "DL-A", batchId: batch.id, siteId: site.id, quantity: "50", unit: "pcs", status: "COMPLETED", isDemo: true } });
  const cr = await db.cleanroom.create({ data: { code: "CR-A", name: "Cleanroom A", siteId: site.id, classification: "ISO 7", isDemo: true } });
  await db.monitoringPoint.create({ data: { cleanroomId: cr.id, code: "MP-A", name: "Particles", parameter: "Particle Count", unit: "CFU/m3", alertLimit: 100, actionLimit: 1000, isDemo: true } });
  await db.cleanroom.create({ data: { code: "CR-B", name: "Cleanroom B", siteId: siteB.id, isDemo: true } });
  await db.equipment.create({ data: { code: "EQ-A", name: "Molder", equipmentType: "Molding", siteId: site.id, isDemo: true } });
});
afterAll(async () => { await disconnectTestDb(); });

// T-CR-01: Cleanroom + MonitoringPoint
describe("T-CR-01: Cleanroom + MonitoringPoint CRUD", () => {
  it("DB: Cleanroom exists with MonitoringPoint", async () => {
    const cr = await db.cleanroom.findFirstOrThrow({ where: { code: "CR-A" }, include: { monitoringPoints: true } });
    expect(cr.monitoringPoints.length).toBeGreaterThan(0);
    expect(cr.monitoringPoints[0].alertLimit.toString()).toBe("100");
    expect(cr.monitoringPoints[0].actionLimit.toString()).toBe("1000");
  });
});

// T-CR-02: MonitoringResult auto-evaluation
describe("T-CR-02: MonitoringResult auto-evaluation", () => {
  it("NORMAL: value < alertLimit", () => { expect(evaluateMonitoringResult(50, 100, 1000)).toBe("NORMAL"); });
  it("ALERT: value > alertLimit but <= actionLimit", () => { expect(evaluateMonitoringResult(500, 100, 1000)).toBe("ALERT"); });
  it("ACTION_EXCEEDANCE: value > actionLimit", () => { expect(evaluateMonitoringResult(5000, 100, 1000)).toBe("ACTION_EXCEEDANCE"); });
});

// T-CR-03: Excursion lifecycle
describe("T-CR-03: Excursion lifecycle", () => {
  it("OPEN -> INVESTIGATING valid", () => { expect(() => assertExcursionTransition("OPEN", "INVESTIGATING")).not.toThrow(); });
  it("OPEN -> CLOSED valid", () => { expect(() => assertExcursionTransition("OPEN", "CLOSED")).not.toThrow(); });
  it("CLOSED -> anything invalid", () => { expect(() => assertExcursionTransition("CLOSED", "OPEN")).toThrow(StateTransitionError); });
  it("DB: Excursion created when result exceeds limits", async () => {
    const site = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const mp = await db.monitoringPoint.findFirstOrThrow();
    const mr = await db.monitoringResult.create({ data: { code: "MR-EXC", monitoringPointId: mp.id, siteId: site.id, value: 5000, unit: "CFU/m3", resultStatus: "ACTION_EXCEEDANCE", isDemo: true } });
    const exc = await db.excursion.create({ data: { monitoringResultId: mr.id, cleanroomId: mp.cleanroomId, siteId: site.id, excursionType: "ACTION", isDemo: true } });
    expect(exc.excursionType).toBe("ACTION");
    expect(exc.status).toBe("OPEN");
  });
});

// T-PKG-01: Packaging state machine
describe("T-PKG-01: PackagingRecord state machine", () => {
  it("IN_PROGRESS -> COMPLETED valid", () => { expect(() => assertPackagingTransition("IN_PROGRESS", "COMPLETED")).not.toThrow(); });
  it("IN_PROGRESS -> FAILED valid", () => { expect(() => assertPackagingTransition("IN_PROGRESS", "FAILED")).not.toThrow(); });
  it("COMPLETED -> anything invalid", () => { expect(() => assertPackagingTransition("COMPLETED", "IN_PROGRESS")).toThrow(StateTransitionError); });
});

// T-STER-01: Sterilization state machine
describe("T-STER-01: SterilizationLot state machine", () => {
  it("SCHEDULED -> IN_PROGRESS valid", () => { expect(() => assertSterTransition("SCHEDULED", "IN_PROGRESS")).not.toThrow(); });
  it("IN_PROGRESS -> COMPLETED valid", () => { expect(() => assertSterTransition("IN_PROGRESS", "COMPLETED")).not.toThrow(); });
  it("COMPLETED -> RELEASED valid", () => { expect(() => assertSterTransition("COMPLETED", "RELEASED")).not.toThrow(); });
  it("COMPLETED -> REJECTED valid", () => { expect(() => assertSterTransition("COMPLETED", "REJECTED")).not.toThrow(); });
  it("RELEASED terminal", () => { expect(() => assertSterTransition("RELEASED", "COMPLETED")).toThrow(StateTransitionError); });
  it("SCHEDULED -> RELEASED invalid (must pass IN_PROGRESS + COMPLETED)", () => { expect(() => assertSterTransition("SCHEDULED", "RELEASED")).toThrow(StateTransitionError); });
});

// T-STER-02: Sterilization release is human-only
describe("T-STER-02: Sterilization release is human-only", () => {
  it("sterilization.release permission exists with human-only", async () => {
    const { PERMISSION_CATALOG } = await import("@/lib/permissions");
    const perm = PERMISSION_CATALOG.find((p) => p.key === "sterilization.release");
    expect(perm).toBeTruthy();
    expect(perm?.description).toContain("human-only");
  });
});

// T-BR-01: Batch Review state machine
describe("T-BR-01: Batch Review state machine", () => {
  it("READY_FOR_REVIEW -> QA_REVIEW valid", () => { expect(() => assertBatchReviewTransition("READY_FOR_REVIEW", "QA_REVIEW")).not.toThrow(); });
  it("QA_REVIEW -> APPROVED valid", () => { expect(() => assertBatchReviewTransition("QA_REVIEW", "APPROVED")).not.toThrow(); });
  it("QA_REVIEW -> HOLD valid", () => { expect(() => assertBatchReviewTransition("QA_REVIEW", "HOLD")).not.toThrow(); });
  it("QA_REVIEW -> REWORK valid", () => { expect(() => assertBatchReviewTransition("QA_REVIEW", "REWORK")).not.toThrow(); });
  it("QA_REVIEW -> REJECT valid", () => { expect(() => assertBatchReviewTransition("QA_REVIEW", "REJECT")).not.toThrow(); });
  it("READY_FOR_REVIEW -> APPROVED invalid (must pass QA_REVIEW)", () => { expect(() => assertBatchReviewTransition("READY_FOR_REVIEW", "APPROVED")).toThrow(StateTransitionError); });
  it("APPROVED terminal", () => { expect(() => assertBatchReviewTransition("APPROVED", "QA_REVIEW")).toThrow(StateTransitionError); });
});

// T-BR-02: Batch disposition is human-only
describe("T-BR-02: Batch disposition is human-only", () => {
  it("batchreview.disposition permission exists with human-only", async () => {
    const { PERMISSION_CATALOG } = await import("@/lib/permissions");
    const perm = PERMISSION_CATALOG.find((p) => p.key === "batchreview.disposition");
    expect(perm).toBeTruthy();
    expect(perm?.description).toContain("human-only");
  });
});

// T-ISOL-09: Cross-site isolation
describe("T-ISOL-09: Cross-site Phase 9 isolation", () => {
  it("Site A cleanroom not visible from Site B", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const siteB = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-B" } });
    const crA = await db.cleanroom.findMany({ where: { siteId: siteA.id } });
    const crB = await db.cleanroom.findMany({ where: { siteId: siteB.id } });
    expect(crA.find((c) => c.code === "CR-A")).toBeTruthy();
    expect(crB.find((c) => c.code === "CR-A")).toBeUndefined();
  });
});

// T-AI-GUARD-06: AI governance
describe("T-AI-GUARD-06: AI governance (Phase 9)", () => {
  it("sterilization.release + batchreview.disposition are human-only", async () => {
    const { PERMISSION_CATALOG } = await import("@/lib/permissions");
    const humanOnly = PERMISSION_CATALOG.filter((p) => p.key === "sterilization.release" || p.key === "batchreview.disposition");
    expect(humanOnly.length).toBe(2);
    humanOnly.forEach((p) => expect(p.description).toContain("human-only"));
  });
});

// Extra: state-machine bypass
describe("Extra: state-machine bypass rejected", () => {
  it("Excursion CLOSED -> OPEN rejected", () => expect(() => assertExcursionTransition("CLOSED", "OPEN")).toThrow(StateTransitionError));
  it("Packaging COMPLETED -> IN_PROGRESS rejected", () => expect(() => assertPackagingTransition("COMPLETED", "IN_PROGRESS")).toThrow(StateTransitionError));
  it("Sterilization SCHEDULED -> RELEASED rejected", () => expect(() => assertSterTransition("SCHEDULED", "RELEASED")).toThrow(StateTransitionError));
  it("Batch READY_FOR_REVIEW -> APPROVED rejected", () => expect(() => assertBatchReviewTransition("READY_FOR_REVIEW", "APPROVED")).toThrow(StateTransitionError));
});

// Regression: audit immutability
describe("Regression: audit immutability", () => {
  it("INSERT succeeds, UPDATE/DELETE rejected", async () => {
    const ev = await db.auditEvent.create({ data: { action: "test.p9.regression", entityType: "Test", outcome: "SUCCESS" } });
    expect(ev.id).toBeTruthy();
    await expect(db.$executeRawUnsafe(`UPDATE "AuditEvent" SET outcome='FAILURE' WHERE action='test.p9.regression'`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE action='test.p9.regression'`)).rejects.toThrow();
  });
});
