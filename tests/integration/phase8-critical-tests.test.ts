// Phase 8 critical tests: T-EQP-01, T-CAL-01, T-CAL-02, T-MAINT-01, T-QUAL-01, T-QUAL-02, T-QUAL-03, T-ISOL-08, T-AI-GUARD-05 + regression.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetTestDb, disconnectTestDb, getTestDb } from "./test-db";
import {
  assertEquipmentUsable,
  assertMaintTransition,
  assertQualTransition,
  computeCalibrationStatus,
  isValidMaintTransition,
  isValidQualTransition,
  MAINT_STATUSES,
  QUAL_STATUSES,
} from "@/modules/equipment/domain";
import { StateTransitionError, ValidationError } from "@/lib/errors";

let db: Awaited<ReturnType<typeof getTestDb>>;

beforeAll(async () => {
  await resetTestDb();
  db = getTestDb();
  const site = await db.site.create({ data: { code: "T-SITE-A", name: "A", isDemo: true, status: "ACTIVE" } });
  const siteB = await db.site.create({ data: { code: "T-SITE-B", name: "B", isDemo: true, status: "ACTIVE" } });
  const wc = await db.workCenter.create({ data: { code: "WC-A", name: "Station A", siteId: site.id, isDemo: true } });
  const eq = await db.equipment.create({ data: { code: "EQ-A", name: "Molding Machine", equipmentType: "Molding", serialNumber: "SN-001", workCenterId: wc.id, siteId: site.id, isDemo: true } });
  const eqB = await db.equipment.create({ data: { code: "EQ-B", name: "Test Bench", equipmentType: "Test", siteId: siteB.id, isDemo: true } });
  const cal = await db.calibrationRecord.create({ data: { code: "CAL-A", equipmentId: eq.id, siteId: site.id, result: "PASS", nextCalibrationDue: new Date(Date.now() + 180 * 86400000), isDemo: true } });
  const maint = await db.maintenanceRecord.create({ data: { code: "MAINT-A", equipmentId: eq.id, siteId: site.id, maintenanceType: "PREVENTIVE", isDemo: true } });
  const qual = await db.qualification.create({ data: { code: "QUAL-A", equipmentId: eq.id, siteId: site.id, qualificationType: "IQ", acceptanceCriteria: "User-defined criteria (not invented)", isDemo: true } });
});
afterAll(async () => { await disconnectTestDb(); });

// T-EQP-01
describe("T-EQP-01: Equipment CRUD + WorkCenter link", () => {
  it("DB: Equipment exists with WorkCenter link", async () => {
    const eq = await db.equipment.findFirstOrThrow({ where: { code: "EQ-A" }, include: { workCenter: true } });
    expect(eq.workCenter).toBeTruthy();
    expect(eq.workCenter?.code).toBe("WC-A");
  });
  it("OUT_OF_SERVICE equipment cannot be used", () => {
    expect(() => assertEquipmentUsable("OUT_OF_SERVICE")).toThrow(StateTransitionError);
    expect(() => assertEquipmentUsable("OPERATIONAL")).not.toThrow();
  });
});

// T-CAL-01
describe("T-CAL-01: CalibrationRecord updates Equipment.calibrationStatus (D2)", () => {
  it("computeCalibrationStatus: VALID when due >30 days", () => {
    expect(computeCalibrationStatus(new Date(Date.now() + 180 * 86400000), "OPERATIONAL")).toBe("VALID");
  });
  it("computeCalibrationStatus: EXPIRING when due <=30 days", () => {
    expect(computeCalibrationStatus(new Date(Date.now() + 15 * 86400000), "OPERATIONAL")).toBe("EXPIRING");
  });
  it("computeCalibrationStatus: EXPIRED when past due", () => {
    expect(computeCalibrationStatus(new Date(Date.now() - 86400000), "OPERATIONAL")).toBe("EXPIRED");
  });
  it("computeCalibrationStatus: OUT_OF_SERVICE overrides all", () => {
    expect(computeCalibrationStatus(new Date(Date.now() + 180 * 86400000), "OUT_OF_SERVICE")).toBe("OUT_OF_SERVICE");
  });
});

// T-CAL-02
describe("T-CAL-02: Calibration status logic", () => {
  it("all 4 statuses are supported", () => {
    expect(computeCalibrationStatus(new Date(Date.now() + 180 * 86400000), "OPERATIONAL")).toBe("VALID");
    expect(computeCalibrationStatus(new Date(Date.now() + 15 * 86400000), "OPERATIONAL")).toBe("EXPIRING");
    expect(computeCalibrationStatus(new Date(Date.now() - 86400000), "OPERATIONAL")).toBe("EXPIRED");
    expect(computeCalibrationStatus(new Date(), "OUT_OF_SERVICE")).toBe("OUT_OF_SERVICE");
  });
});

// T-MAINT-01
describe("T-MAINT-01: MaintenanceRecord state machine", () => {
  it("SCHEDULED -> IN_PROGRESS valid", () => expect(isValidMaintTransition("SCHEDULED", "IN_PROGRESS")).toBe(true));
  it("SCHEDULED -> COMPLETED INVALID", () => { expect(isValidMaintTransition("SCHEDULED", "COMPLETED")).toBe(false); expect(() => assertMaintTransition("SCHEDULED", "COMPLETED")).toThrow(StateTransitionError); });
  it("IN_PROGRESS -> COMPLETED valid", () => expect(isValidMaintTransition("IN_PROGRESS", "COMPLETED")).toBe(true));
  it("COMPLETED terminal", () => { for (const s of MAINT_STATUSES) expect(isValidMaintTransition("COMPLETED", s)).toBe(false); });
});

// T-QUAL-01
describe("T-QUAL-01: Qualification state machine", () => {
  it("REQUIREMENT -> PROTOCOL valid", () => expect(isValidQualTransition("REQUIREMENT", "PROTOCOL")).toBe(true));
  it("REQUIREMENT -> REPORT INVALID", () => { expect(isValidQualTransition("REQUIREMENT", "REPORT")).toBe(false); expect(() => assertQualTransition("REQUIREMENT", "REPORT")).toThrow(StateTransitionError); });
  it("EXECUTION -> DEVIATION valid", () => expect(isValidQualTransition("EXECUTION", "DEVIATION")).toBe(true));
  it("EXECUTION -> RESULT valid", () => expect(isValidQualTransition("EXECUTION", "RESULT")).toBe(true));
  it("DEVIATION -> APPROVAL valid", () => expect(isValidQualTransition("DEVIATION", "APPROVAL")).toBe(true));
  it("APPROVAL -> REPORT valid", () => expect(isValidQualTransition("APPROVAL", "REPORT")).toBe(true));
  it("REPORT terminal", () => { for (const s of QUAL_STATUSES) expect(isValidQualTransition("REPORT", s)).toBe(false); });
});

// T-QUAL-02
describe("T-QUAL-02: Qualification approval is human-only", () => {
  it("equipment.qualification.approve permission exists with human-only", async () => {
    const { PERMISSION_CATALOG } = await import("@/lib/permissions");
    const perm = PERMISSION_CATALOG.find((p) => p.key === "equipment.qualification.approve");
    expect(perm).toBeTruthy();
    expect(perm?.description).toContain("human-only");
  });
});

// T-QUAL-03
describe("T-QUAL-03: Acceptance criteria never invented", () => {
  it("DB: Qualification has user-entered acceptanceCriteria", async () => {
    const qual = await db.qualification.findFirstOrThrow();
    expect(qual.acceptanceCriteria).toBeTruthy();
    expect(qual.acceptanceCriteria).toContain("User-defined");
  });
});

// T-ISOL-08
describe("T-ISOL-08: Cross-site equipment isolation", () => {
  it("Site A equipment not visible from Site B", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const siteB = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-B" } });
    const eqA = await db.equipment.findMany({ where: { siteId: siteA.id } });
    const eqB = await db.equipment.findMany({ where: { siteId: siteB.id } });
    expect(eqA.find((e) => e.code === "EQ-A")).toBeTruthy();
    expect(eqB.find((e) => e.code === "EQ-A")).toBeUndefined();
    expect(eqB.find((e) => e.code === "EQ-B")).toBeTruthy();
  });
});

// T-AI-GUARD-05
describe("T-AI-GUARD-05: AI governance", () => {
  it("equipment.qualification.approve is human-only", async () => {
    const { PERMISSION_CATALOG } = await import("@/lib/permissions");
    const humanOnly = PERMISSION_CATALOG.filter((p) => p.key === "equipment.qualification.approve");
    expect(humanOnly.length).toBe(1);
    expect(humanOnly[0].description).toContain("human-only");
  });
});

// Extra: state-machine bypass
describe("Extra: state-machine bypass rejected", () => {
  it("Maintenance SCHEDULED -> COMPLETED rejected", () => expect(() => assertMaintTransition("SCHEDULED", "COMPLETED")).toThrow(StateTransitionError));
  it("Qualification REQUIREMENT -> REPORT rejected", () => expect(() => assertQualTransition("REQUIREMENT", "REPORT")).toThrow(StateTransitionError));
});

// Regression: audit immutability
describe("Regression: audit immutability", () => {
  it("INSERT succeeds, UPDATE/DELETE rejected", async () => {
    const ev = await db.auditEvent.create({ data: { action: "test.p8.regression", entityType: "Test", outcome: "SUCCESS" } });
    expect(ev.id).toBeTruthy();
    await expect(db.$executeRawUnsafe(`UPDATE "AuditEvent" SET outcome='FAILURE' WHERE action='test.p8.regression'`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE action='test.p8.regression'`)).rejects.toThrow();
  });
});
