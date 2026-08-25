// Phase 11 Analytics service.
// CRITICAL: This module CONSUMES Phase 10 computation (computeOee, computeLeanMetrics, evaluateVsm).
// It NEVER re-implements OEE/Lean formulas. The UI must not become a second source of truth.
//
// Architecture (owner-approved seam):
//   Trusted Data -> Phase 10 Computation -> THIS SERVICE (aggregation/bucketing) -> API -> UI
//
// Decisions implemented:
//   D1: live on-demand computation only (no AnalyticsSnapshot).
//   D3: delivery = null + warning.
//   D4: critical problems via RiskAssessment RPN >= threshold.
//   D5: overdue via authoritative dueDate only; CAPA/ChangeControl reported as limited.
//   D6: recurrence by (subjectType, subjectId); effectiveness = CAPA outcome + post-closure recurrence.
//   D7: corporate aggregate-only, server-side enforced.
//   D11/D13: AI gets analytics.read only; no AI feature in Phase 11.

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import {
  KPI_SOURCES,
  CRITICAL_RPN_THRESHOLD,
  assertRangeCap,
  type ProductionDashboard,
  type OeeDashboard,
  type QualityDashboard,
  type DowntimeDashboard,
  type BottleneckDashboard,
  type CriticalProblemsDashboard,
  type OverdueActionsDashboard,
  type DeliveryDashboard,
  type TrendReport,
  type RecurrenceReport,
  type ActionEffectivenessReport,
  type EquipmentPerformanceReport,
  type VsmView,
  type CorporateSummary,
  type AnalyticsMeta,
  type Granularity,
} from "../domain";
import type z from "zod";
import { computeOee, computeLeanMetrics, evaluateVsm } from "@/modules/lean/service";

// ============================================================================
// Helpers
// ============================================================================

function buildMeta(
  siteId: string,
  fromDate: Date,
  toDate: Date,
  sources: Record<string, string>,
  warnings: string[],
  dataState: AnalyticsMeta["dataState"] = "calculated",
): AnalyticsMeta {
  return {
    dataState: warnings.length > 0 && dataState === "calculated" ? "warning" : dataState,
    sources,
    warnings,
    computedAt: new Date().toISOString(),
    range: { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() },
    siteId,
  };
}

// The batch statuses that count as "produced" for quality/production aggregates.
const PRODUCED_BATCH_STATUSES = ["COMPLETED", "READY_FOR_REVIEW", "QA_REVIEW", "APPROVED", "HOLD", "REWORK", "REJECT"];

// ============================================================================
// Production dashboard (planned vs actual)
// ============================================================================

export async function getProductionDashboard(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").DashboardQuerySchema>,
): Promise<ProductionDashboard> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "production dashboard");

  // SOURCE: WorkOrder.plannedQuantity (planned)
  const workOrders = await db.workOrder.findMany({
    where: { siteId: input.siteId, createdAt: { gte: input.fromDate, lte: input.toDate } },
    select: { plannedQuantity: true, createdAt: true },
  });
  const plannedTotal = workOrders.reduce((s, w) => s + parseFloat(w.plannedQuantity.toString()), 0);

  // SOURCE: ManufacturingBatch.actualQuantity (actual)
  const batches = await db.manufacturingBatch.findMany({
    where: { siteId: input.siteId, status: { in: PRODUCED_BATCH_STATUSES }, completedAt: { gte: input.fromDate, lte: input.toDate } },
    select: { actualQuantity: true, plannedQuantity: true, completedAt: true },
  });
  const actualTotal = batches.reduce((s, b) => s + parseFloat(b.actualQuantity?.toString() ?? b.plannedQuantity.toString()), 0);

  // Per-day breakdown (by completion date)
  const byDayMap = new Map<string, { planned: number; actual: number }>();
  // init days
  const dayMs = 86400000;
  for (let t = input.fromDate.getTime(); t <= input.toDate.getTime(); t += dayMs) {
    const d = new Date(t).toISOString().slice(0, 10);
    if (!byDayMap.has(d)) byDayMap.set(d, { planned: 0, actual: 0 });
  }
  for (const w of workOrders) {
    const d = w.createdAt.toISOString().slice(0, 10);
    const e = byDayMap.get(d) ?? { planned: 0, actual: 0 };
    e.planned += parseFloat(w.plannedQuantity.toString());
    byDayMap.set(d, e);
  }
  for (const b of batches) {
    if (!b.completedAt) continue;
    const d = b.completedAt.toISOString().slice(0, 10);
    const e = byDayMap.get(d) ?? { planned: 0, actual: 0 };
    e.actual += parseFloat(b.actualQuantity?.toString() ?? b.plannedQuantity.toString());
    byDayMap.set(d, e);
  }
  const byDay = Array.from(byDayMap.entries()).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));

  const warnings: string[] = [];
  if (plannedTotal === 0) warnings.push("No work orders in range; planned total = 0");
  if (actualTotal === 0) warnings.push("No completed batches in range; actual total = 0");

  return {
    plannedTotal,
    actualTotal,
    variance: actualTotal - plannedTotal,
    byDay,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      { plannedTotal: KPI_SOURCES.plannedTotal.source, actualTotal: KPI_SOURCES.actualTotal.source, variance: KPI_SOURCES.variance.source },
      warnings),
  };
}

// ============================================================================
// OEE dashboard (PASSTHROUGH of Phase 10 computeOee — NO reimplementation)
// ============================================================================

export async function getOeeDashboard(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").DashboardQuerySchema>,
): Promise<OeeDashboard> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "OEE dashboard");

  // CONSUME Phase 10 computeOee — the single source of truth for OEE.
  const oeeResult = await computeOee(ctx, {
    siteId: input.siteId,
    fromDate: input.fromDate,
    toDate: input.toDate,
    equipmentId: input.equipmentId,
    workCenterId: input.workCenterId,
  });

  return {
    availability: oeeResult.availability,
    performance: oeeResult.performance,
    quality: oeeResult.quality,
    oee: oeeResult.oee,
    sources: oeeResult.sources,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      {
        oee: KPI_SOURCES.oee.source, availability: KPI_SOURCES.availability.source,
        performance: KPI_SOURCES.performance.source, quality: KPI_SOURCES.quality.source,
      },
      oeeResult.warnings),
  };
}

// ============================================================================
// Quality dashboard
// ============================================================================

export async function getQualityDashboard(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").DashboardQuerySchema>,
): Promise<QualityDashboard> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "quality dashboard");

  // CONSUME Phase 10 computeLeanMetrics for FPY/scrapRate/reworkRate (single source of truth).
  const lean = await computeLeanMetrics(ctx, {
    siteId: input.siteId,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  // Open quality record counts (trusted Phase 4 data)
  const [openNcrs, openDeviations, openCapas] = await Promise.all([
    db.nCR.count({ where: { siteId: input.siteId, status: { notIn: ["CLOSED", "CANCELLED"] } } }),
    db.deviation.count({ where: { siteId: input.siteId, status: { notIn: ["CLOSED", "REJECTED"] } } }),
    db.cAPA.count({ where: { siteId: input.siteId, status: { not: "CLOSED" } } }),
  ]);

  // Test result pass/fail counts (trusted Phase 5 data)
  const [testPassCount, testFailCount] = await Promise.all([
    db.testResult.count({ where: { sample: { siteId: input.siteId }, disposition: "PASS_RELEASE", updatedAt: { gte: input.fromDate, lte: input.toDate } } }),
    db.testResult.count({ where: { sample: { siteId: input.siteId }, disposition: { in: ["FAIL_HOLD", "FAIL_REJECT"] }, updatedAt: { gte: input.fromDate, lte: input.toDate } } }),
  ]);

  const warnings: string[] = [];
  if (lean.fpy === null) warnings.push("FPY unavailable (no completed batches / zero total count)");
  if (testPassCount + testFailCount === 0) warnings.push("No test results in range");

  return {
    rejectRate: lean.scrapRate !== null && lean.reworkRate !== null ? lean.scrapRate + lean.reworkRate : null,
    fpy: lean.fpy,
    scrapRate: lean.scrapRate,
    reworkRate: lean.reworkRate,
    openNcrs, openDeviations, openCapas, testPassCount, testFailCount,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      {
        rejectRate: KPI_SOURCES.rejectRate.source, fpy: KPI_SOURCES.fpy.source,
        openNcrs: KPI_SOURCES.openNcrs.source, openDeviations: KPI_SOURCES.openDeviations.source,
        openCapas: KPI_SOURCES.openCapas.source, testPassCount: KPI_SOURCES.testPassCount.source,
        testFailCount: KPI_SOURCES.testFailCount.source,
      },
      warnings),
  };
}

// ============================================================================
// Downtime dashboard (PASSTHROUGH of Phase 10 paretoDowntime)
// ============================================================================

export async function getDowntimeDashboard(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").DashboardQuerySchema>,
): Promise<DowntimeDashboard> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "downtime dashboard");

  // CONSUME Phase 10 computeLeanMetrics for paretoDowntime (single source of truth).
  const lean = await computeLeanMetrics(ctx, {
    siteId: input.siteId,
    fromDate: input.fromDate,
    toDate: input.toDate,
    equipmentId: input.equipmentId,
  });

  const totalDowntimeMinutes = lean.paretoDowntime.reduce((s, p) => s + p.totalDurationMinutes, 0);
  let cumulative = 0;
  const pareto = lean.paretoDowntime.map((p) => {
    cumulative += p.totalDurationMinutes;
    return {
      category: p.category,
      totalDurationMinutes: p.totalDurationMinutes,
      count: p.count,
      cumulativePercent: totalDowntimeMinutes > 0 ? (cumulative / totalDowntimeMinutes) * 100 : 0,
    };
  });

  const warnings: string[] = [];
  if (pareto.length === 0) warnings.push("No CLOSED downtime events in range");

  return {
    pareto,
    totalDowntimeMinutes,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      { downtimePareto: KPI_SOURCES.downtimePareto.source, totalDowntimeMinutes: KPI_SOURCES.totalDowntimeMinutes.source },
      warnings),
  };
}

// ============================================================================
// Bottleneck dashboard (PASSTHROUGH of Phase 10 bottlenecks)
// ============================================================================

export async function getBottleneckDashboard(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").DashboardQuerySchema>,
): Promise<BottleneckDashboard> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "bottleneck dashboard");

  // CONSUME Phase 10 computeLeanMetrics for bottlenecks (single source of truth).
  const lean = await computeLeanMetrics(ctx, {
    siteId: input.siteId,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  const warnings: string[] = [];
  if (lean.bottlenecks.length === 0) warnings.push("No equipment found at site");

  return {
    bottlenecks: lean.bottlenecks,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      { bottlenecks: KPI_SOURCES.bottlenecks.source },
      warnings),
  };
}

// ============================================================================
// Critical problems dashboard (D4)
// ============================================================================

export async function getCriticalProblemsDashboard(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").CriticalQuerySchema>,
): Promise<CriticalProblemsDashboard> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const threshold = input.threshold ?? CRITICAL_RPN_THRESHOLD;

  // SOURCE: open RiskAssessments with RPN >= threshold at site.
  const risks = await db.riskAssessment.findMany({
    where: { siteId: input.siteId, status: "OPEN", riskPriorityNumber: { gte: threshold } },
    select: { id: true, code: true, subjectType: true, subjectId: true, riskPriorityNumber: true },
  });

  const items: CriticalProblemsDashboard["items"] = [];
  for (const r of risks) {
    // Resolve the subject entity to an open NCR/Deviation/CAPA (D4).
    if (r.subjectType === "DEVIATION") {
      const dev = await db.deviation.findUnique({ where: { id: r.subjectId }, select: { id: true, code: true, status: true, createdAt: true } });
      if (dev && dev.status !== "CLOSED" && dev.status !== "REJECTED") {
        items.push({ type: "DEVIATION", id: dev.id, code: dev.code, status: dev.status, rpn: r.riskPriorityNumber, riskAssessmentId: r.id, riskAssessmentCode: r.code, associationPath: "RiskAssessment.subjectType=DEVIATION -> Deviation (direct)", openedAt: dev.createdAt.toISOString() });
      }
    } else if (r.subjectType === "CHANGE") {
      // ChangeControl is not in our NCR/Dev/CAPA list but may link to a CAPA via the change; skip for D4 scope.
      continue;
    } else {
      // subjectType = BATCH/PRODUCT/PROCESS/EQUIPMENT -> find open NCRs that concern this entity
      const ncrs = await db.nCR.findMany({
        where: { siteId: input.siteId, concernsEntityType: r.subjectType, concernsEntityId: r.subjectId, status: { notIn: ["CLOSED", "CANCELLED"] } },
        select: { id: true, code: true, status: true, createdAt: true },
      });
      for (const n of ncrs) {
        items.push({ type: "NCR", id: n.id, code: n.code, status: n.status, rpn: r.riskPriorityNumber, riskAssessmentId: r.id, riskAssessmentCode: r.code, associationPath: `NCR.concernsEntityType=${r.subjectType} -> subject of open RiskAssessment (RPN ${r.riskPriorityNumber})`, openedAt: n.createdAt.toISOString() });
      }
    }
  }

  // CAPAs whose source is a critical Deviation (sourceType=DEVIATION, sourceId in critical deviations)
  const criticalDeviationIds = items.filter((i) => i.type === "DEVIATION").map((i) => i.id);
  if (criticalDeviationIds.length > 0) {
    const capas = await db.cAPA.findMany({
      where: { siteId: input.siteId, sourceType: "DEVIATION", sourceId: { in: criticalDeviationIds }, status: { not: "CLOSED" } },
      select: { id: true, code: true, status: true, createdAt: true, sourceId: true },
    });
    for (const c of capas) {
      const parentRisk = items.find((i) => i.type === "DEVIATION" && i.id === c.sourceId);
      if (parentRisk) {
        items.push({ type: "CAPA", id: c.id, code: c.code, status: c.status, rpn: parentRisk.rpn, riskAssessmentId: parentRisk.riskAssessmentId, riskAssessmentCode: parentRisk.riskAssessmentCode, associationPath: "CAPA.sourceType=DEVIATION -> critical Deviation -> RiskAssessment", openedAt: c.createdAt.toISOString() });
      }
    }
  }

  const warnings: string[] = [];
  if (items.length === 0) warnings.push(`No open NCR/Deviation/CAPA associated with an open RiskAssessment RPN >= ${threshold}`);

  return {
    threshold,
    items: items.sort((a, b) => b.rpn - a.rpn),
    meta: buildMeta(input.siteId, new Date(), new Date(),
      { criticalProblems: KPI_SOURCES.criticalProblems.source },
      warnings),
  };
}

// ============================================================================
// Overdue actions dashboard (D5 — authoritative dueDate ONLY)
// ============================================================================

export async function getOverdueActionsDashboard(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").OverdueQuerySchema>,
): Promise<OverdueActionsDashboard> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const now = new Date();

  const items: OverdueActionsDashboard["items"] = [];

  // Calibration (authoritative: CalibrationRecord.nextCalibrationDue, equipment OPERATIONAL)
  const calibrations = await db.calibrationRecord.findMany({
    where: { equipment: { siteId: input.siteId }, nextCalibrationDue: { lt: now } },
    include: { equipment: { select: { code: true, name: true, operationalStatus: true } } },
  });
  for (const c of calibrations) {
    if (c.equipment.operationalStatus === "OUT_OF_SERVICE") continue; // already out of service
    items.push({
      type: "CALIBRATION",
      id: c.id,
      code: `CAL-${c.equipment.code}`,
      dueDate: c.nextCalibrationDue.toISOString(),
      daysOverdue: Math.floor((now.getTime() - c.nextCalibrationDue.getTime()) / 86400000),
      detail: `Equipment ${c.equipment.code} (${c.equipment.name}) calibration overdue`,
    });
  }

  // Maintenance (authoritative: MaintenanceRecord.scheduledDate, not COMPLETED)
  const maintenances = await db.maintenanceRecord.findMany({
    where: { equipment: { siteId: input.siteId }, scheduledDate: { lt: now, not: null }, status: { not: "COMPLETED" } },
    include: { equipment: { select: { code: true, name: true } } },
  });
  for (const m of maintenances) {
    if (!m.scheduledDate) continue;
    items.push({
      type: "MAINTENANCE",
      id: m.id,
      code: `MNT-${m.equipment.code}`,
      dueDate: m.scheduledDate.toISOString(),
      daysOverdue: Math.floor((now.getTime() - m.scheduledDate.getTime()) / 86400000),
      detail: `Equipment ${m.equipment.code} (${m.equipment.name}) maintenance overdue`,
    });
  }

  // Training (authoritative: TrainingRecord.expiresAt OR status=SCHEDULED past trainedAt+validity)
  const trainings = await db.trainingRecord.findMany({
    where: { siteId: input.siteId, status: { not: "COMPLETED" } },
    include: { employee: { select: { employeeCode: true, fullName: true } }, requiredTraining: { select: { validityPeriodMonths: true, title: true } } },
  });
  for (const t of trainings) {
    let due: Date | null = t.expiresAt ?? null;
    if (!due && t.requiredTraining?.validityPeriodMonths && t.status === "SCHEDULED") {
      // No explicit expiresAt; if scheduled long ago past validity, flag (best-effort, not invented)
      due = new Date(t.trainedAt.getTime() + t.requiredTraining.validityPeriodMonths * 30 * 86400000);
    }
    if (!due || due >= now) continue;
    items.push({
      type: "TRAINING",
      id: t.id,
      code: t.code,
      dueDate: due.toISOString(),
      daysOverdue: Math.floor((now.getTime() - due.getTime()) / 86400000),
      detail: `Training ${t.code} for ${t.employee.fullName} (${t.requiredTraining?.title ?? "general"}) overdue`,
    });
  }

  items.sort((a, b) => b.daysOverdue - a.daysOverdue);

  // D5: CAPA + ChangeControl have NO authoritative dueDate -> report as limited (do NOT invent)
  const limitations: OverdueActionsDashboard["limitations"] = [
    { type: "CAPA", reason: "CAPA has no authoritative dueDate field; overdue-status cannot be determined without inventing a threshold (D5: not permitted). Open CAPA count is available on the Quality dashboard." },
    { type: "CHANGE_CONTROL", reason: "ChangeControl has no authoritative dueDate field; overdue-status cannot be determined without inventing a threshold (D5: not permitted)." },
  ];

  const warnings: string[] = [];
  if (items.length === 0) warnings.push("No overdue calibration/maintenance/training items at this site");

  return {
    items,
    limitations,
    meta: buildMeta(input.siteId, now, now,
      {
        overdueCalibration: KPI_SOURCES.overdueCalibration.source,
        overdueMaintenance: KPI_SOURCES.overdueMaintenance.source,
        overdueTraining: KPI_SOURCES.overdueTraining.source,
      },
      warnings),
  };
}

// ============================================================================
// Delivery dashboard (D3 — null + warning, NO invention)
// ============================================================================

export async function getDeliveryDashboard(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").DashboardQuerySchema>,
): Promise<DeliveryDashboard> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  // D3: no shipment/delivery source exists in Phase 1-10. Return null + explicit warning.
  return {
    value: null,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      { deliveryPerformance: KPI_SOURCES.deliveryPerformance.source },
      ["Delivery performance requires a shipment/delivery data source not yet implemented in Phase 1-10. KPI unavailable (deferred to a future phase)."],
      "unavailable"),
  };
}

// ============================================================================
// Trend reports (D1: live per-bucket re-computation; NO snapshots)
// ============================================================================

function generateBuckets(fromDate: Date, toDate: Date, granularity: Granularity): Array<{ start: Date; end: Date }> {
  const buckets: Array<{ start: Date; end: Date }> = [];
  const cur = new Date(fromDate);
  while (cur < toDate) {
    const start = new Date(cur);
    let end: Date;
    if (granularity === "HOUR") { end = new Date(cur.getTime() + 3600000); cur.setHours(cur.getHours() + 1); }
    else if (granularity === "DAY") { end = new Date(cur.getTime() + 86400000); cur.setDate(cur.getDate() + 1); }
    else if (granularity === "WEEK") { end = new Date(cur.getTime() + 7 * 86400000); cur.setDate(cur.getDate() + 7); }
    else { end = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); cur.setMonth(cur.getMonth() + 1); }
    if (end > toDate) end = new Date(toDate);
    buckets.push({ start, end });
  }
  return buckets;
}

export async function getOeeTrend(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").TrendQuerySchema>,
): Promise<TrendReport> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "OEE trend");
  const buckets = generateBuckets(input.fromDate, input.toDate, input.granularity);

  // Per-bucket: CONSUME Phase 10 computeOee (single source of truth).
  const bucketResults = await Promise.all(buckets.map(async (b) => {
    try {
      const r = await computeOee(ctx, {
        siteId: input.siteId, fromDate: b.start, toDate: b.end,
        equipmentId: input.equipmentId,
      });
      return {
        bucketStart: b.start.toISOString(),
        bucketEnd: b.end.toISOString(),
        values: { oee: r.oee, availability: r.availability, performance: r.performance, quality: r.quality },
        source: "live" as const,
        warnings: r.warnings,
      };
    } catch { return { bucketStart: b.start.toISOString(), bucketEnd: b.end.toISOString(), values: { oee: null, availability: null, performance: null, quality: null }, source: "live" as const, warnings: ["computation error"] }; }
  }));

  const allWarnings = bucketResults.flatMap((b) => b.warnings).slice(0, 10); // cap warnings
  return {
    buckets: bucketResults,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      { oee: KPI_SOURCES.oee.source },
      allWarnings.length > 0 ? [`Aggregated ${allWarnings.length}+ bucket warnings (truncated)`] : []),
  };
}

export async function getQualityTrend(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").TrendQuerySchema>,
): Promise<TrendReport> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "quality trend");
  const buckets = generateBuckets(input.fromDate, input.toDate, input.granularity);

  const bucketResults = await Promise.all(buckets.map(async (b) => {
    try {
      const r = await computeLeanMetrics(ctx, { siteId: input.siteId, fromDate: b.start, toDate: b.end });
      return {
        bucketStart: b.start.toISOString(),
        bucketEnd: b.end.toISOString(),
        values: { rejectRate: r.scrapRate !== null && r.reworkRate !== null ? r.scrapRate + r.reworkRate : null, fpy: r.fpy, scrapRate: r.scrapRate, reworkRate: r.reworkRate },
        source: "live" as const,
        warnings: r.warnings,
      };
    } catch { return { bucketStart: b.start.toISOString(), bucketEnd: b.end.toISOString(), values: { rejectRate: null, fpy: null, scrapRate: null, reworkRate: null }, source: "live" as const, warnings: ["computation error"] }; }
  }));

  return {
    buckets: bucketResults,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      { fpy: KPI_SOURCES.fpy.source, scrapRate: "ProductionScrap/Total", reworkRate: "ProductionRework/Total" },
      []),
  };
}

// ============================================================================
// Downtime Pareto report (PASSTHROUGH of Phase 10)
// ============================================================================

export async function getDowntimeParetoReport(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").DashboardQuerySchema>,
): Promise<DowntimeDashboard> {
  // Same as downtime dashboard but formatted for report (cumulative percent included)
  return getDowntimeDashboard(ctx, input);
}

// ============================================================================
// Equipment performance report (per-equipment OEE via Phase 10 computeOee)
// ============================================================================

export async function getEquipmentPerformanceReport(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").EquipmentPerfQuerySchema>,
): Promise<EquipmentPerformanceReport> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "equipment performance report");

  const equipment = await db.equipment.findMany({
    where: { siteId: input.siteId },
    select: { id: true, code: true, name: true },
  });

  // Per-equipment: CONSUME Phase 10 computeOee (single source of truth).
  const items = await Promise.all(equipment.map(async (eq) => {
    try {
      const r = await computeOee(ctx, { siteId: input.siteId, fromDate: input.fromDate, toDate: input.toDate, equipmentId: eq.id });
      return {
        equipmentId: eq.id, equipmentCode: eq.code, equipmentName: eq.name,
        oee: r.oee, availability: r.availability, performance: r.performance, quality: r.quality,
        runTimeMinutes: r.sources.runTimeMinutes,
      };
    } catch { return { equipmentId: eq.id, equipmentCode: eq.code, equipmentName: eq.name, oee: null, availability: null, performance: null, quality: null, runTimeMinutes: 0 }; }
  }));

  const warnings: string[] = [];
  if (items.length === 0) warnings.push("No equipment at site");

  return {
    items: items.sort((a, b) => (b.oee ?? -1) - (a.oee ?? -1)),
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      { oee: KPI_SOURCES.oee.source },
      warnings),
  };
}

// ============================================================================
// Recurrence report (D6)
// ============================================================================

export async function getRecurrenceReport(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").RecurrenceQuerySchema>,
): Promise<RecurrenceReport> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "recurrence report");

  // NCRs grouped by (concernsEntityType, concernsEntityId)
  const ncrs = await db.nCR.findMany({
    where: { siteId: input.siteId, createdAt: { gte: input.fromDate, lte: input.toDate } },
    select: { id: true, code: true, concernsEntityType: true, concernsEntityId: true, createdAt: true, status: true },
  });
  const deviations = await db.deviation.findMany({
    where: { siteId: input.siteId, createdAt: { gte: input.fromDate, lte: input.toDate } },
    select: { id: true, code: true, createdAt: true, status: true },
  });

  // Group NCRs by subject
  const subjectMap = new Map<string, { subjectType: string; subjectId: string; occurrences: number; dates: string[]; ncrIds: string[] }>();
  for (const n of ncrs) {
    const key = `${n.concernsEntityType}:${n.concernsEntityId}`;
    const e = subjectMap.get(key) ?? { subjectType: n.concernsEntityType, subjectId: n.concernsEntityId, occurrences: 0, dates: [], ncrIds: [] };
    e.occurrences++; e.dates.push(n.createdAt.toISOString()); e.ncrIds.push(n.id);
    subjectMap.set(key, e);
  }

  // Find linked CAPAs for recurring subjects
  const items: RecurrenceReport["items"] = [];
  for (const [key, v] of subjectMap) {
    if (v.occurrences < 2) continue; // recurrence = >1 occurrence
    // Find CAPAs linked to these NCRs (via CAPA.sourceType=NCR/INVESTIGATION + sourceId)
    const capas = await db.cAPA.findMany({
      where: { siteId: input.siteId, sourceType: { in: ["NCR", "INVESTIGATION"] }, sourceId: { in: v.ncrIds } },
      select: { id: true },
    });
    items.push({
      subjectType: v.subjectType,
      subjectId: v.subjectId,
      subjectLabel: `${v.subjectType} ${v.subjectId.slice(-8)}`,
      occurrences: v.occurrences,
      dates: v.dates.sort(),
      linkedCapaIds: capas.map((c) => c.id),
    });
  }

  items.sort((a, b) => b.occurrences - a.occurrences);
  const warnings: string[] = [];
  if (items.length === 0) warnings.push("No recurring subjects (>1 NCR on same subject) in range");

  return {
    items,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      { recurrence: KPI_SOURCES.recurrence.source },
      warnings),
  };
}

// ============================================================================
// Action effectiveness report (D6)
// ============================================================================

export async function getActionEffectivenessReport(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").RecurrenceQuerySchema>,
): Promise<ActionEffectivenessReport> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  assertRangeCap(input.fromDate, input.toDate, "action-effectiveness report");

  // Closed CAPAs in range
  const capas = await db.cAPA.findMany({
    where: { siteId: input.siteId, status: "CLOSED", closedAt: { gte: input.fromDate, lte: input.toDate } },
    select: { id: true, code: true, closedAt: true, effectivenessVerification: true, sourceType: true, sourceId: true },
  });

  const items: ActionEffectivenessReport["items"] = [];
  for (const c of capas) {
    // Check recurrence: did a new NCR/Deviation occur on the same source subject after closure?
    let recurrenceSinceClose = false;
    let recurrenceCount = 0;
    if (c.closedAt && c.sourceType === "NCR") {
      // The CAPA's source NCR concerns a subject; check for newer NCRs on the same subject after closure.
      const sourceNcr = await db.nCR.findUnique({ where: { id: c.sourceId }, select: { concernsEntityType: true, concernsEntityId: true } });
      if (sourceNcr) {
        const laterNcrs = await db.nCR.count({
          where: { siteId: input.siteId, concernsEntityType: sourceNcr.concernsEntityType, concernsEntityId: sourceNcr.concernsEntityId, createdAt: { gt: c.closedAt } },
        });
        recurrenceCount = laterNcrs;
        recurrenceSinceClose = laterNcrs > 0;
      }
    }
    items.push({
      capaId: c.id, capaCode: c.code, closedAt: c.closedAt?.toISOString() ?? null,
      effectivenessOutcome: c.effectivenessVerification ?? null,
      recurrenceSinceClose, recurrenceCount,
    });
  }

  const warnings: string[] = [];
  if (items.length === 0) warnings.push("No closed CAPAs in range");

  return {
    items,
    meta: buildMeta(input.siteId, input.fromDate, input.toDate,
      { actionEffectiveness: KPI_SOURCES.actionEffectiveness.source },
      warnings),
  };
}

// ============================================================================
// VSM view (consume Phase 10 evaluateVsm; read-only graph data)
// ============================================================================

export async function getVsmView(ctx: AuthContext, vsmId: string): Promise<VsmView> {
  if (!can(ctx, "analytics.read")) throw new ForbiddenError();
  const vsm = await db.valueStreamMap.findUnique({
    where: { id: vsmId },
    include: { nodes: { orderBy: { sequence: "asc" }, include: { edgesFrom: true } } },
  });
  if (!vsm) throw new NotFoundError("ValueStreamMap");
  if (vsm.siteId) assertSiteAccess(ctx, vsm.siteId);
  // D5: global VSM (siteId=null) readable by anyone with analytics.read (structure is user-defined, not production data)

  // CONSUME Phase 10 evaluateVsm (single source of truth for VSM metrics).
  const evaluation = await evaluateVsm(ctx, vsmId);

  // Flatten edges from nodes (ValueStreamMap has no direct edges relation; edges live on VsmNode.edgesFrom)
  const edges = vsm.nodes.flatMap((n) => n.edgesFrom.map((e) => ({ id: e.id, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })));

  return {
    vsm: { id: vsm.id, code: vsm.code, name: vsm.name, siteId: vsm.siteId, status: vsm.status },
    nodes: vsm.nodes.map((n) => ({ id: n.id, sequence: n.sequence, nodeType: n.nodeType, name: n.name, leadTimeMinutes: n.leadTimeMinutes, valueAddedMinutes: n.valueAddedMinutes })),
    edges,
    evaluation,
    meta: buildMeta(vsm.siteId ?? "global", new Date(), new Date(),
      { vsmEvaluation: KPI_SOURCES.vsmEvaluation.source },
      []),
  };
}

// ============================================================================
// Corporate summary (D7 — aggregate-only, server-side enforced, audited)
// ============================================================================

export async function getCorporateSummary(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").CorporateQuerySchema>,
): Promise<CorporateSummary> {
  if (!can(ctx, "analytics.corporate.read")) throw new ForbiddenError();
  assertRangeCap(input.fromDate, input.toDate, "corporate summary");

  // D7: determine authorized sites. Non-super_admin with corporate.read sees aggregate ONLY
  // (per-site rows suppressed). super_admin sees all.
  const authorizedSiteIds = ctx.resolvedSites === "*" ? null : [...ctx.resolvedSites];
  const siteFilter = authorizedSiteIds ? { siteId: { in: authorizedSiteIds } } : {};

  // AUDIT the corporate access (D12)
  await audit({
    actorUserId: ctx.user.id,
    action: "analytics.corporate.read",
    entityType: "CorporateSummary",
    entityId: null,
    newState: { metricKeys: input.metricKeys, siteCount: authorizedSiteIds?.length ?? "all", fromDate: input.fromDate, toDate: input.toDate },
  });

  const aggregate: Record<string, number | null> = {};
  const contributingSites = new Set<string>();

  for (const mk of input.metricKeys) {
    if (mk === "oee" || mk === "availability" || mk === "performance" || mk === "quality") {
      // Aggregate OEE across authorized sites (per-site computeOee, then average)
      const sites = authorizedSiteIds ?? (await db.site.findMany({ where: { status: "ACTIVE" }, select: { id: true } })).map((s) => s.id);
      const perSite: number[] = [];
      for (const sid of sites) {
        try {
          const r = await computeOee(ctx, { siteId: sid, fromDate: input.fromDate, toDate: input.toDate });
          const v = (mk as keyof typeof r) as keyof typeof r;
          if (typeof r[v] === "number") { perSite.push(r[v] as number); contributingSites.add(sid); }
        } catch { /* skip site on error */ }
      }
      aggregate[mk] = perSite.length > 0 ? perSite.reduce((a, b) => a + b, 0) / perSite.length : null;
    } else if (mk === "openNcrs" || mk === "openDeviations" || mk === "openCapas") {
      const model = mk === "openNcrs" ? db.nCR : mk === "openDeviations" ? db.deviation : db.cAPA;
      const statusNot = mk === "openDeviations" ? { notIn: ["CLOSED", "REJECTED"] } : mk === "openNcrs" ? { notIn: ["CLOSED", "CANCELLED"] } : { not: "CLOSED" };
      const count = await (model as any).count({ where: { ...siteFilter, status: statusNot } });
      aggregate[mk] = count;
      // contributing sites for counts = all authorized sites
      if (authorizedSiteIds) authorizedSiteIds.forEach((s) => contributingSites.add(s));
      else (await db.site.findMany({ where: { status: "ACTIVE" }, select: { id: true } })).forEach((s) => contributingSites.add(s.id));
    } else if (mk === "totalDowntimeMinutes") {
      const events = await db.downtimeEvent.findMany({ where: { ...siteFilter, status: "CLOSED", startTime: { gte: input.fromDate }, endTime: { lte: input.toDate } }, select: { durationMinutes: true, siteId: true } });
      events.forEach((e) => { contributingSites.add(e.siteId); });
      aggregate[mk] = events.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    } else {
      aggregate[mk] = null; // unknown metric key
    }
  }

  return {
    aggregate,
    contributingSiteCount: contributingSites.size,
    note: `Aggregate over ${contributingSites.size} authorized site(s). Per-site detail requires site-level authorization. Computed in UTC (D14 corporate canonical reference).`,
    meta: { ...buildMeta("corporate", input.fromDate, input.toDate, { corporate: "aggregated from per-site Phase 10 computations" }, []), audited: true },
  };
}

// ============================================================================
// Export (CSV — same analytics service results; tamper-evident)
// ============================================================================

import { createHash } from "node:crypto";

export async function exportReportCsv(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain").ExportQuerySchema>,
): Promise<{ csv: string; filename: string; reportType: string }> {
  if (!can(ctx, "analytics.export")) throw new ForbiddenError();
  const p = input.params as Record<string, unknown>;
  // AUDIT the export (D12)
  await audit({
    actorUserId: ctx.user.id,
    action: "analytics.export",
    entityType: "Report",
    entityId: input.reportType,
    newState: { format: input.format, params: p },
  });

  // Dispatch to the same service functions the dashboard uses (single source of truth).
  let rows: Record<string, unknown>[] = [];
  const reportType = input.reportType;

  const buildQuery = () => {
    const q: any = {};
    if (p.siteId) q.siteId = p.siteId;
    if (p.fromDate) q.fromDate = new Date(p.fromDate as string);
    if (p.toDate) q.toDate = new Date(p.toDate as string);
    if (p.equipmentId) q.equipmentId = p.equipmentId;
    if (p.workCenterId) q.workCenterId = p.workCenterId;
    return q;
  };

  if (reportType === "production") {
    const r = await getProductionDashboard(ctx, buildQuery());
    rows = r.byDay.map((d) => ({ date: d.date, planned: d.planned, actual: d.actual, variance: d.actual - d.planned }));
  } else if (reportType === "oee") {
    const r = await getOeeDashboard(ctx, buildQuery());
    rows = [{ availability: r.availability, performance: r.performance, quality: r.quality, oee: r.oee, ...r.sources }];
  } else if (reportType === "quality") {
    const r = await getQualityDashboard(ctx, buildQuery());
    rows = [{ rejectRate: r.rejectRate, fpy: r.fpy, scrapRate: r.scrapRate, reworkRate: r.reworkRate, openNcrs: r.openNcrs, openDeviations: r.openDeviations, openCapas: r.openCapas, testPassCount: r.testPassCount, testFailCount: r.testFailCount }];
  } else if (reportType === "downtime" || reportType === "downtime-pareto") {
    const r = await getDowntimeDashboard(ctx, buildQuery());
    rows = r.pareto.map((p) => ({ category: p.category, totalDurationMinutes: p.totalDurationMinutes, count: p.count, cumulativePercent: p.cumulativePercent }));
  } else if (reportType === "bottlenecks") {
    const r = await getBottleneckDashboard(ctx, buildQuery());
    rows = r.bottlenecks.map((b) => ({ workCenterCode: b.workCenterCode, equipmentCode: b.equipmentCode, oee: b.oee, avgCycleTime: b.avgCycleTime }));
  } else if (reportType === "critical-problems") {
    const r = await getCriticalProblemsDashboard(ctx, { siteId: p.siteId as string, threshold: p.threshold as number | undefined });
    rows = r.items.map((i) => ({ type: i.type, code: i.code, status: i.status, rpn: i.rpn, riskAssessmentCode: i.riskAssessmentCode, associationPath: i.associationPath, openedAt: i.openedAt }));
  } else if (reportType === "overdue-actions") {
    const r = await getOverdueActionsDashboard(ctx, { siteId: p.siteId as string });
    rows = r.items.map((i) => ({ type: i.type, code: i.code, dueDate: i.dueDate, daysOverdue: i.daysOverdue, detail: i.detail }));
  } else if (reportType === "delivery") {
    const r = await getDeliveryDashboard(ctx, buildQuery());
    rows = [{ value: r.value, warning: r.meta.warnings[0] ?? "" }];
  } else if (reportType === "oee-trend") {
    const r = await getOeeTrend(ctx, { siteId: p.siteId as string, fromDate: new Date(p.fromDate as string), toDate: new Date(p.toDate as string), granularity: (p.granularity as Granularity) ?? "DAY", equipmentId: p.equipmentId as string | undefined });
    rows = r.buckets.map((b) => ({ bucketStart: b.bucketStart, bucketEnd: b.bucketEnd, ...b.values }));
  } else if (reportType === "quality-trend") {
    const r = await getQualityTrend(ctx, { siteId: p.siteId as string, fromDate: new Date(p.fromDate as string), toDate: new Date(p.toDate as string), granularity: (p.granularity as Granularity) ?? "DAY" });
    rows = r.buckets.map((b) => ({ bucketStart: b.bucketStart, bucketEnd: b.bucketEnd, ...b.values }));
  } else if (reportType === "equipment-performance") {
    const r = await getEquipmentPerformanceReport(ctx, { siteId: p.siteId as string, fromDate: new Date(p.fromDate as string), toDate: new Date(p.toDate as string) });
    rows = r.items.map((i) => ({ equipmentCode: i.equipmentCode, equipmentName: i.equipmentName, oee: i.oee, availability: i.availability, performance: i.performance, quality: i.quality, runTimeMinutes: i.runTimeMinutes }));
  } else if (reportType === "recurrence") {
    const r = await getRecurrenceReport(ctx, { siteId: p.siteId as string, fromDate: new Date(p.fromDate as string), toDate: new Date(p.toDate as string) });
    rows = r.items.map((i) => ({ subjectType: i.subjectType, subjectId: i.subjectId, subjectLabel: i.subjectLabel, occurrences: i.occurrences, dates: i.dates.join(";"), linkedCapaCount: i.linkedCapaIds.length }));
  } else if (reportType === "action-effectiveness") {
    const r = await getActionEffectivenessReport(ctx, { siteId: p.siteId as string, fromDate: new Date(p.fromDate as string), toDate: new Date(p.toDate as string) });
    rows = r.items.map((i) => ({ capaCode: i.capaCode, closedAt: i.closedAt, effectivenessOutcome: i.effectivenessOutcome, recurrenceSinceClose: i.recurrenceSinceClose, recurrenceCount: i.recurrenceCount }));
  } else {
    throw new ValidationError(`Unknown report type: ${reportType}`);
  }

  // Build CSV with tamper-evident row hashes (reuse audit CSV pattern)
  if (rows.length === 0) rows = [{ note: "No data for the selected range/filters" }];
  const headers = Object.keys(rows[0]);
  const lines = [["row", ...headers, "rowHash"].join(",")];
  rows.forEach((r, i) => {
    const row = [String(i + 1), ...headers.map((h) => String(r[h] ?? ""))];
    const rowHash = createHash("sha256").update(row.join("|")).digest("hex").slice(0, 16);
    lines.push([...row, rowHash].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
  });
  return { csv: lines.join("\n"), filename: `circum-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`, reportType };
}
