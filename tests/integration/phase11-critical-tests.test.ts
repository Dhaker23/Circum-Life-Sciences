// Phase 11 critical tests: T-ANALYTICS, T-CRIT, T-OVERDUE, T-RECURRENCE, T-EFFECTIVENESS,
// T-DELIVERY, T-ISOL-11, T-AI-GUARD-08, T-AUDIT-11, T-EXPORT-01, T-CORPORATE-01, T-SOURCE-01.
// Verifies: KPI source-of-truth (no reimplementation), site isolation, corporate aggregation
// authorization, AI governance, export integrity, D3/D4/D5/D6 domain decisions.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetTestDb, disconnectTestDb } from "./test-db";
import { db } from "@/lib/db"; // use @/lib/db's client so service-layer writes are visible
import { buildAuthContext, can } from "@/lib/rbac";
import type { AuthContext } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";
import * as analyticsSvc from "@/modules/analytics/service";
import { KPI_SOURCES, ON_DEMAND_MAX_DAYS, CRITICAL_RPN_THRESHOLD, assertRangeCap } from "@/modules/analytics/domain";

let siteA: { id: string };
let siteB: { id: string };
let userSiteA: { id: string; email: string };
let userSiteB: { id: string; email: string };
let userSuperAdmin: { id: string; email: string };
let userExecutive: { id: string; email: string };
let userAI: { id: string; email: string };
let ctxSiteA: AuthContext;
let ctxSiteB: AuthContext;
let ctxSuperAdmin: AuthContext;
let ctxExecutive: AuthContext;
let ctxAI: AuthContext;

async function seed() {
  // Permissions
  const perms = {
    analyticsRead: await db.permission.create({ data: { key: "analytics.read", module: "analytics" } }),
    analyticsExport: await db.permission.create({ data: { key: "analytics.export", module: "analytics" } }),
    analyticsCorporate: await db.permission.create({ data: { key: "analytics.corporate.read", module: "analytics" } }),
    analyticsSnapshot: await db.permission.create({ data: { key: "analytics.snapshot.create", module: "analytics" } }),
    leanRead: await db.permission.create({ data: { key: "lean.read", module: "lean" } }),
    orgSiteRead: await db.permission.create({ data: { key: "org.site.read", module: "org" } }),
  };
  // Roles
  const roleQm = await db.role.create({ data: { systemKey: "quality_manager", name: "QM", isSystem: true, status: "ACTIVE" } });
  const roleSuperAdmin = await db.role.create({ data: { systemKey: "super_admin", name: "SA", isSystem: true, status: "ACTIVE" } });
  const roleExec = await db.role.create({ data: { systemKey: "executive_viewer", name: "Exec", isSystem: true, status: "ACTIVE" } });
  const roleAI = await db.role.create({ data: { systemKey: "quality_engineer", name: "AI", isSystem: true, status: "ACTIVE" } });
  // Grants
  for (const p of [perms.analyticsRead, perms.analyticsExport, perms.leanRead, perms.orgSiteRead]) await db.rolePermission.create({ data: { roleId: roleQm.id, permissionId: p.id } });
  for (const p of Object.values(perms)) await db.rolePermission.create({ data: { roleId: roleSuperAdmin.id, permissionId: p.id } });
  for (const p of [perms.analyticsRead, perms.analyticsCorporate, perms.leanRead, perms.orgSiteRead]) await db.rolePermission.create({ data: { roleId: roleExec.id, permissionId: p.id } });
  for (const p of [perms.analyticsRead, perms.leanRead]) await db.rolePermission.create({ data: { roleId: roleAI.id, permissionId: p.id } });
  // Sites
  siteA = await db.site.create({ data: { code: "A", name: "Site A", isDemo: true, status: "ACTIVE", timezone: "Africa/Lagos" } });
  siteB = await db.site.create({ data: { code: "B", name: "Site B", isDemo: true, status: "ACTIVE", timezone: "Europe/Zurich" } });
  // Users
  userSiteA = await db.user.create({ data: { email: "a@demo", name: "A", passwordHash: "x", status: "ACTIVE" } });
  userSiteB = await db.user.create({ data: { email: "b@demo", name: "B", passwordHash: "x", status: "ACTIVE" } });
  userSuperAdmin = await db.user.create({ data: { email: "sa@demo", name: "SA", passwordHash: "x", status: "ACTIVE" } });
  userExecutive = await db.user.create({ data: { email: "ex@demo", name: "EX", passwordHash: "x", status: "ACTIVE" } });
  userAI = await db.user.create({ data: { email: "ai@demo", name: "AI", passwordHash: "x", status: "ACTIVE" } });
  // Assignments
  await db.assignment.create({ data: { userId: userSiteA.id, roleId: roleQm.id, siteId: siteA.id, status: "ACTIVE" } });
  await db.assignment.create({ data: { userId: userSiteB.id, roleId: roleQm.id, siteId: siteB.id, status: "ACTIVE" } });
  await db.assignment.create({ data: { userId: userSuperAdmin.id, roleId: roleSuperAdmin.id, siteId: null, status: "ACTIVE" } });
  await db.assignment.create({ data: { userId: userExecutive.id, roleId: roleExec.id, siteId: null, status: "ACTIVE" } });
  await db.assignment.create({ data: { userId: userAI.id, roleId: roleAI.id, siteId: siteA.id, status: "ACTIVE" } });
}

async function ctxFor(userId: string): Promise<AuthContext> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, name: true, preferredLocale: true, status: true } });
  const assignments = await db.assignment.findMany({
    where: { userId, status: "ACTIVE" },
    include: { role: { include: { permissions: { include: { permission: { select: { key: true } } } } } } },
  });
  const normalized = assignments.map((a) => ({
    id: a.id, siteId: a.siteId, departmentId: a.departmentId, moduleScope: a.moduleScope,
    status: a.status, validFrom: a.validFrom, validUntil: a.validUntil,
    role: { id: a.role.id, systemKey: a.role.systemKey, permissions: a.role.permissions.map((rp) => ({ key: rp.permission.key })) },
  }));
  return buildAuthContext(user, normalized as unknown as AuthContext["assignments"]);
}

async function seedProductionData(siteId: string) {
  const product = await db.product.create({ data: { code: `PROD-${siteId.slice(-4)}`, name: "P", productType: "DEVICE", deviceClass: "IIa", isDemo: true } });
  const rev = await db.productRevision.create({ data: { productId: product.id, revisionCode: "R1", status: "EFFECTIVE", effectiveFrom: new Date(), isDemo: true } });
  const wo = await db.workOrder.create({ data: { code: `WO-${siteId.slice(-4)}`, productRevisionId: rev.id, siteId, plannedQuantity: "100", unit: "pcs", status: "COMPLETED", isDemo: true } });
  const batch = await db.manufacturingBatch.create({ data: { code: `BAT-${siteId.slice(-4)}`, workOrderId: wo.id, productRevisionId: rev.id, siteId, plannedQuantity: "100", actualQuantity: "90", unit: "pcs", status: "COMPLETED", completedAt: new Date(), isDemo: true } });
  const wc = await db.workCenter.create({ data: { code: `WC-${siteId.slice(-4)}`, name: "WC", siteId, isDemo: true } });
  const eq = await db.equipment.create({ data: { code: `EQ-${siteId.slice(-4)}`, name: "Eq", equipmentType: "Molding", siteId, workCenterId: wc.id, isDemo: true } });
  const emp = await db.employee.create({ data: { employeeCode: `EMP-${siteId.slice(-4)}`, firstName: "T", lastName: "E", fullName: "T E", siteId, isDemo: true } });
  const shift = await db.shift.create({ data: { siteId, name: "Day", startTime: "08:00", endTime: "16:00", isDemo: true } });
  const routing = await db.routing.create({ data: { productRevisionId: rev.id, status: "EFFECTIVE" } });
  const op = await db.operation.create({ data: { routingId: routing.id, sequence: 10, name: "Mold", estimatedDurationMinutes: 60, workCenterId: wc.id } });
  await db.operationExecution.create({ data: { batchId: batch.id, operationId: op.id, workCenterId: wc.id, startedAt: new Date(Date.now() - 7200000), completedAt: new Date(Date.now() - 6600000), status: "COMPLETED", operatorEmployeeId: emp.id } });
  await db.productionScrap.create({ data: { batchId: batch.id, quantity: "5", unit: "pcs", reason: "Defect" } });
  await db.downtimeEvent.create({ data: { code: `DT-${siteId.slice(-4)}`, equipmentId: eq.id, siteId, downtimeCategory: "CHANGEOVER", reason: "Change", startTime: new Date(Date.now() - 3600000), endTime: new Date(Date.now() - 3000000), durationMinutes: 10, status: "CLOSED", isDemo: true } });
  return { product, rev, wo, batch, wc, eq, emp, shift };
}

beforeAll(async () => {
  await resetTestDb();
  // Reconnect @/lib/db's PrismaClient to the freshly-reset test DB (resetTestDb deletes/recreates the file;
  // @/lib/db's singleton may hold a stale connection to the old file handle)
  await db.$disconnect();
  await db.$connect();
  await seed();
  ctxSiteA = await ctxFor(userSiteA.id);
  ctxSiteB = await ctxFor(userSiteB.id);
  ctxSuperAdmin = await ctxFor(userSuperAdmin.id);
  ctxExecutive = await ctxFor(userExecutive.id);
  ctxAI = await ctxFor(userAI.id);
  await seedProductionData(siteA.id);
  await seedProductionData(siteB.id);
});
afterAll(async () => { await disconnectTestDb(); });

// Extend toDate slightly into the future so data created during tests (createdAt: now) is included.
const range = { fromDate: new Date(Date.now() - 7 * 86400000), toDate: new Date(Date.now() + 86400000) };

// ===========================================================================
// T-SOURCE-01: KPI source-of-truth mapping is documented (no invention)
// ===========================================================================
describe("T-SOURCE-01: KPI source-of-truth mapping", () => {
  it("every KPI has a documented source, phase, and computation", () => {
    expect(KPI_SOURCES.oee.source).toContain("computeOee");
    expect(KPI_SOURCES.availability.source).toContain("computeOee");
    expect(KPI_SOURCES.fpy.source).toContain("computeLeanMetrics");
    expect(KPI_SOURCES.downtimePareto.source).toContain("computeLeanMetrics");
    expect(KPI_SOURCES.bottlenecks.source).toContain("computeLeanMetrics");
    expect(KPI_SOURCES.vsmEvaluation.source).toContain("evaluateVsm");
    expect(KPI_SOURCES.deliveryPerformance.source).toContain("NONE");
  });
  it("ON_DEMAND_MAX_DAYS is 90 (D15)", () => { expect(ON_DEMAND_MAX_DAYS).toBe(90); });
  it("CRITICAL_RPN_THRESHOLD is 15 (D4)", () => { expect(CRITICAL_RPN_THRESHOLD).toBe(15); });
  it("assertRangeCap rejects >90 days (D15)", () => {
    expect(() => assertRangeCap(new Date("2024-01-01"), new Date("2024-05-01"))).toThrow();
  });
  it("assertRangeCap accepts <=90 days", () => {
    expect(() => assertRangeCap(new Date(Date.now() - 30 * 86400000), new Date())).not.toThrow();
  });
});

// ===========================================================================
// T-ANALYTICS-01: OEE dashboard consumes Phase 10 computeOee (no reimplementation)
// ===========================================================================
describe("T-ANALYTICS-01: OEE dashboard passes through Phase 10 computeOee", () => {
  it("returns availability/performance/quality/oee + sources + warnings", async () => {
    const r = await analyticsSvc.getOeeDashboard(ctxSiteA, { siteId: siteA.id, ...range });
    expect(r).toHaveProperty("availability");
    expect(r).toHaveProperty("performance");
    expect(r).toHaveProperty("quality");
    expect(r).toHaveProperty("oee");
    expect(r).toHaveProperty("sources.plannedTimeMinutes");
    expect(r).toHaveProperty("sources.downtimeMinutes");
    expect(r).toHaveProperty("meta.warnings");
    expect(r.meta.sources.oee).toContain("computeOee");
  });
});

// T-ANALYTICS-02: Production dashboard planned vs actual
describe("T-ANALYTICS-02: Production dashboard planned vs actual", () => {
  it("returns plannedTotal, actualTotal, variance, byDay", async () => {
    const r = await analyticsSvc.getProductionDashboard(ctxSiteA, { siteId: siteA.id, ...range });
    expect(typeof r.plannedTotal).toBe("number");
    expect(typeof r.actualTotal).toBe("number");
    expect(r.variance).toBe(r.actualTotal - r.plannedTotal);
    expect(Array.isArray(r.byDay)).toBe(true);
  });
});

// T-ANALYTICS-03: Quality dashboard consumes Phase 10 computeLeanMetrics
describe("T-ANALYTICS-03: Quality dashboard uses Phase 10 FPY/scrapRate", () => {
  it("returns fpy, scrapRate, reworkRate from computeLeanMetrics + open counts", async () => {
    const r = await analyticsSvc.getQualityDashboard(ctxSiteA, { siteId: siteA.id, ...range });
    expect(r).toHaveProperty("fpy");
    expect(r).toHaveProperty("scrapRate");
    expect(r).toHaveProperty("reworkRate");
    expect(typeof r.openNcrs).toBe("number");
    expect(typeof r.openCapas).toBe("number");
    expect(r.meta.sources.fpy).toContain("computeLeanMetrics");
  });
});

// T-ANALYTICS-04: Downtime dashboard Pareto with cumulative %
describe("T-ANALYTICS-04: Downtime dashboard Pareto", () => {
  it("returns pareto with cumulativePercent", async () => {
    const r = await analyticsSvc.getDowntimeDashboard(ctxSiteA, { siteId: siteA.id, ...range });
    expect(Array.isArray(r.pareto)).toBe(true);
    if (r.pareto.length > 0) {
      expect(r.pareto[0]).toHaveProperty("cumulativePercent");
      expect(r.pareto[0].cumulativePercent).toBeGreaterThan(0);
    }
  });
});

// T-ANALYTICS-05: Zero-denominator → null (no NaN/Infinity)
describe("T-ANALYTICS-05: Zero-denominator returns null", () => {
  it("OEE with no data returns null components (not NaN)", async () => {
    // Site B has data; create a fresh empty site to test null behavior
    const emptySite = await db.site.create({ data: { code: "EMPTY", name: "Empty", isDemo: true, status: "ACTIVE" } });
    await db.assignment.create({ data: { userId: userSuperAdmin.id, roleId: (await db.role.findFirstOrThrow({ where: { systemKey: "super_admin" } })).id, siteId: null, status: "ACTIVE" } });
    const r = await analyticsSvc.getOeeDashboard(ctxSuperAdmin, { siteId: emptySite.id, ...range });
    expect(r.oee).toBeNull();
    expect(r.availability).toBeNull();
    expect([r.performance, r.quality].every((v) => v === null || typeof v === "number")).toBe(true);
    expect(r.meta.warnings.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// T-DELIVERY-01: Delivery returns null + warning (D3 — no invention)
// ===========================================================================
describe("T-DELIVERY-01: Delivery dashboard returns null + warning (D3)", () => {
  it("value is null and dataState is unavailable", async () => {
    const r = await analyticsSvc.getDeliveryDashboard(ctxSiteA, { siteId: siteA.id, ...range });
    expect(r.value).toBeNull();
    expect(r.meta.dataState).toBe("unavailable");
    expect(r.meta.warnings[0]).toContain("shipment");
  });
});

// ===========================================================================
// T-CRIT-01: Critical problems (D4 — RPN >= 15)
// ===========================================================================
describe("T-CRIT-01: Critical problems via RiskAssessment RPN", () => {
  it("returns open NCR/Deviation/CAPA linked to open high-RPN RiskAssessment", async () => {
    // Create a deviation + high-RPN risk at siteA
    const dev = await db.deviation.create({ data: { code: "DEV-CRIT", siteId: siteA.id, appliesToEntityType: "BATCH", appliesToEntityId: "test-batch", description: "Critical deviation", justification: "test", status: "INVESTIGATION", isDemo: true } });
    await db.riskAssessment.create({ data: { code: "RISK-CRIT", siteId: siteA.id, subjectType: "DEVIATION", subjectId: dev.id, hazard: "H", severity: 4, probability: 4, riskPriorityNumber: 16, mitigations: "M", status: "OPEN", isDemo: true } });
    const r = await analyticsSvc.getCriticalProblemsDashboard(ctxSiteA, { siteId: siteA.id });
    expect(r.threshold).toBe(15);
    expect(r.items.some((i) => i.type === "DEVIATION" && i.rpn >= 15)).toBe(true);
    expect(r.items.every((i) => i.associationPath.length > 0)).toBe(true); // transparency
  });
  it("configurable threshold works", async () => {
    const r = await analyticsSvc.getCriticalProblemsDashboard(ctxSiteA, { siteId: siteA.id, threshold: 20 });
    expect(r.threshold).toBe(20);
    expect(r.items.every((i) => i.rpn >= 20)).toBe(true);
  });
});

// ===========================================================================
// T-OVERDUE-01: Overdue actions (D5 — authoritative dueDate only)
// ===========================================================================
describe("T-OVERDUE-01: Overdue actions with authoritative dueDate", () => {
  it("returns calibration/maintenance/training items with dueDate", async () => {
    // Create an overdue calibration at siteA
    const eq = await db.equipment.findFirstOrThrow({ where: { siteId: siteA.id } });
    await db.calibrationRecord.create({ data: { code: "CAL-OVERDUE", equipmentId: eq.id, siteId: siteA.id, result: "PASS", calibratedAt: new Date(Date.now() - 400 * 86400000), nextCalibrationDue: new Date(Date.now() - 10 * 86400000), isDemo: true } });
    const r = await analyticsSvc.getOverdueActionsDashboard(ctxSiteA, { siteId: siteA.id });
    expect(r.items.some((i) => i.type === "CALIBRATION")).toBe(true);
    expect(r.items.every((i) => i.daysOverdue >= 0)).toBe(true);
  });
  it("D5: CAPA + ChangeControl reported as limited (NOT invented)", async () => {
    const r = await analyticsSvc.getOverdueActionsDashboard(ctxSiteA, { siteId: siteA.id });
    expect(r.limitations.some((l) => l.type === "CAPA")).toBe(true);
    expect(r.limitations.some((l) => l.type === "CHANGE_CONTROL")).toBe(true);
    expect(r.limitations.every((l) => l.reason.includes("no authoritative dueDate"))).toBe(true);
  });
});

// ===========================================================================
// T-RECURRENCE-01: Recurrence groups by subject (D6)
// ===========================================================================
describe("T-RECURRENCE-01: Recurrence by subject", () => {
  it("groups NCRs by (concernsEntityType, concernsEntityId); >1 = recurrence", async () => {
    // Create 2 NCRs on the same subject at siteA
    const eq = await db.equipment.findFirstOrThrow({ where: { siteId: siteA.id } });
    await db.nCR.create({ data: { code: "NCR-REC-1", siteId: siteA.id, concernsEntityType: "EQUIPMENT", concernsEntityId: eq.id, description: "d1", severity: "MAJOR", status: "DRAFT", isDemo: true } });
    await db.nCR.create({ data: { code: "NCR-REC-2", siteId: siteA.id, concernsEntityType: "EQUIPMENT", concernsEntityId: eq.id, description: "d2", severity: "MAJOR", status: "DRAFT", isDemo: true } });
    const r = await analyticsSvc.getRecurrenceReport(ctxSiteA, { siteId: siteA.id, ...range });
    expect(r.items.some((i) => i.occurrences >= 2)).toBe(true);
  });
});

// T-EFFECTIVENESS-01: Action effectiveness (D6)
describe("T-EFFECTIVENESS-01: Action effectiveness", () => {
  it("returns closed CAPAs with effectiveness outcome + recurrence flag", async () => {
    // Create a closed CAPA at siteA
    await db.cAPA.create({ data: { code: "CAPA-EFF", siteId: siteA.id, sourceType: "OTHER", sourceId: "manual", actionPlan: "Plan", status: "CLOSED", closedAt: new Date(Date.now() - 86400000), effectivenessVerification: "Effective", isDemo: true } });
    const r = await analyticsSvc.getActionEffectivenessReport(ctxSiteA, { siteId: siteA.id, ...range });
    expect(r.items.some((i) => i.capaCode === "CAPA-EFF")).toBe(true);
    const item = r.items.find((i) => i.capaCode === "CAPA-EFF")!;
    expect(item.effectivenessOutcome).toBe("Effective");
    expect(typeof item.recurrenceSinceClose).toBe("boolean");
  });
});

// ===========================================================================
// T-ISOL-11: Site isolation (CRITICAL)
// ===========================================================================
describe("T-ISOL-11: Cross-site analytics isolation", () => {
  it("siteA user cannot query siteB data", async () => {
    await expect(analyticsSvc.getProductionDashboard(ctxSiteA, { siteId: siteB.id, ...range })).rejects.toThrow(ForbiddenError);
  });
  it("siteB user cannot query siteA data", async () => {
    await expect(analyticsSvc.getOeeDashboard(ctxSiteB, { siteId: siteA.id, ...range })).rejects.toThrow(ForbiddenError);
  });
  it("super_admin can query any site", async () => {
    const r = await analyticsSvc.getProductionDashboard(ctxSuperAdmin, { siteId: siteA.id, ...range });
    expect(r).toBeDefined();
  });
  it("production dashboard at siteA does not include siteB work orders", async () => {
    const r = await analyticsSvc.getProductionDashboard(ctxSiteA, { siteId: siteA.id, ...range });
    // siteA has 1 WO with plannedQuantity 100; siteB has its own
    expect(r.plannedTotal).toBe(100); // only siteA's data
  });
});

// ===========================================================================
// T-CORPORATE-01: Corporate aggregation (D7 — aggregate-only, server-side enforced)
// ===========================================================================
describe("T-CORPORATE-01: Corporate aggregation authorization + aggregate-only", () => {
  it("siteA user (no analytics.corporate.read) is denied", async () => {
    await expect(analyticsSvc.getCorporateSummary(ctxSiteA, { ...range, metricKeys: ["oee"] })).rejects.toThrow(ForbiddenError);
  });
  it("executive_viewer with analytics.corporate.read can access", async () => {
    const r = await analyticsSvc.getCorporateSummary(ctxExecutive, { ...range, metricKeys: ["openNcrs"] });
    expect(r).toHaveProperty("aggregate");
    expect(r).toHaveProperty("contributingSiteCount");
    expect(r.meta.audited).toBe(true);
  });
  it("super_admin can access corporate", async () => {
    const r = await analyticsSvc.getCorporateSummary(ctxSuperAdmin, { ...range, metricKeys: ["openNcrs", "totalDowntimeMinutes"] });
    expect(r.contributingSiteCount).toBeGreaterThan(0);
  });
  it("corporate aggregate does not expose per-site rows to non-super_admin", async () => {
    // Executive sees only aggregate + count, not per-site breakdown
    const r = await analyticsSvc.getCorporateSummary(ctxExecutive, { ...range, metricKeys: ["openNcrs"] });
    expect(r.note.toLowerCase()).toContain("aggregate");
    // The response must not contain a per-site array
    expect(JSON.stringify(r)).not.toMatch(/siteId.*siteA/); // no per-site leak
  });
  it("corporate access is audited", async () => {
    const beforeCount = await db.auditEvent.count({ where: { action: "analytics.corporate.read" } });
    await analyticsSvc.getCorporateSummary(ctxExecutive, { ...range, metricKeys: ["openNcrs"] });
    const afterCount = await db.auditEvent.count({ where: { action: "analytics.corporate.read" } });
    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});

// ===========================================================================
// T-AI-GUARD-08: AI governance (analytics.read only; no export/corporate/snapshot)
// ===========================================================================
describe("T-AI-GUARD-08: AI gets analytics.read ONLY", () => {
  it("AI can read analytics (analytics.read)", () => {
    expect(can(ctxAI, "analytics.read")).toBe(true);
  });
  it("AI cannot export (analytics.export denied)", () => {
    expect(can(ctxAI, "analytics.export")).toBe(false);
  });
  it("AI cannot access corporate (analytics.corporate.read denied)", () => {
    expect(can(ctxAI, "analytics.corporate.read")).toBe(false);
  });
  it("AI cannot create snapshots (analytics.snapshot.create denied)", () => {
    expect(can(ctxAI, "analytics.snapshot.create")).toBe(false);
  });
  it("AI reading analytics at its site works", async () => {
    const r = await analyticsSvc.getOeeDashboard(ctxAI, { siteId: siteA.id, ...range });
    expect(r).toBeDefined();
  });
  it("AI cannot access corporate summary (service-level denial)", async () => {
    await expect(analyticsSvc.getCorporateSummary(ctxAI, { ...range, metricKeys: ["oee"] })).rejects.toThrow(ForbiddenError);
  });
  it("AI cannot export (service-level denial)", async () => {
    await expect(analyticsSvc.exportReportCsv(ctxAI, { reportType: "oee", params: { siteId: siteA.id, ...range }, format: "csv" })).rejects.toThrow(ForbiddenError);
  });
});

// ===========================================================================
// T-EXPORT-01: Export uses same analytics service results (no independent calc)
// ===========================================================================
describe("T-EXPORT-01: Export CSV integrity", () => {
  it("export returns CSV with tamper-evident row hashes", async () => {
    const r = await analyticsSvc.exportReportCsv(ctxSuperAdmin, { reportType: "oee", params: { siteId: siteA.id, fromDate: range.fromDate.toISOString(), toDate: range.toDate.toISOString() }, format: "csv" });
    expect(r.csv).toContain("rowHash");
    expect(r.csv).toContain("oee");
    expect(r.filename).toContain("circum-oee-");
  });
  it("export is audited", async () => {
    const before = await db.auditEvent.count({ where: { action: "analytics.export" } });
    await analyticsSvc.exportReportCsv(ctxSuperAdmin, { reportType: "quality", params: { siteId: siteA.id, fromDate: range.fromDate.toISOString(), toDate: range.toDate.toISOString() }, format: "csv" });
    const after = await db.auditEvent.count({ where: { action: "analytics.export" } });
    expect(after).toBeGreaterThan(before);
  });
  it("export respects site isolation (siteA user exporting siteB denied)", async () => {
    await expect(analyticsSvc.exportReportCsv(ctxSiteA, { reportType: "oee", params: { siteId: siteB.id, fromDate: range.fromDate.toISOString(), toDate: range.toDate.toISOString() }, format: "csv" })).rejects.toThrow(ForbiddenError);
  });
});

// ===========================================================================
// T-VSM-01: VSM view consumes Phase 10 evaluateVsm
// ===========================================================================
describe("T-VSM-01: VSM view passes through Phase 10 evaluateVsm", () => {
  it("returns vsm + nodes + edges + evaluation", async () => {
    const vsm = await db.valueStreamMap.create({ data: { code: "VSM-TEST", name: "Test", siteId: siteA.id, status: "ACTIVE", isDemo: true } });
    const n1 = await db.vsmNode.create({ data: { vsmId: vsm.id, sequence: 1, nodeType: "PROCESS", name: "Step1", leadTimeMinutes: 30, valueAddedMinutes: 20 } });
    const n2 = await db.vsmNode.create({ data: { vsmId: vsm.id, sequence: 2, nodeType: "INVENTORY", name: "Buffer", leadTimeMinutes: 60, valueAddedMinutes: 0 } });
    await db.vsmEdge.create({ data: { fromNodeId: n1.id, toNodeId: n2.id } });
    const r = await analyticsSvc.getVsmView(ctxSiteA, vsm.id);
    expect(r.nodes.length).toBe(2);
    expect(r.edges.length).toBe(1);
    expect(r.evaluation.totalLeadTimeMinutes).toBe(90);
    expect(r.evaluation.totalValueAddedMinutes).toBe(20);
    expect(r.meta.sources.vsmEvaluation).toContain("evaluateVsm");
  });
});

// ===========================================================================
// T-TREND-01: Trend report uses live per-bucket computation (D1 — no snapshots)
// ===========================================================================
describe("T-TREND-01: Trend report live computation", () => {
  it("every bucket has source = 'live' (no snapshots)", async () => {
    const r = await analyticsSvc.getOeeTrend(ctxSiteA, { siteId: siteA.id, ...range, granularity: "DAY" });
    expect(r.buckets.length).toBeGreaterThan(0);
    expect(r.buckets.every((b) => b.source === "live")).toBe(true);
  });
  it("quality trend returns fpy/scrapRate/reworkRate per bucket", async () => {
    const r = await analyticsSvc.getQualityTrend(ctxSiteA, { siteId: siteA.id, ...range, granularity: "DAY" });
    expect(r.buckets.every((b) => "fpy" in b.values && "scrapRate" in b.values)).toBe(true);
  });
});
