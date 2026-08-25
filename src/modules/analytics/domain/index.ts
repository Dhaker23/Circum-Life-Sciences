// Phase 11 Analytics domain.
// CRITICAL ARCHITECTURE (owner rule): Phase 11 is a READ-ONLY presentation layer.
// Every KPI must trace to either (a) a Phase 10 computation result, or (b) a direct
// trusted-data aggregate. The UI must NEVER become a second source of truth.
//
// Data-flow seam (codebase-design):
//   Trusted Data (Phase 1-9) + DowntimeEvent/VSM (Phase 10)
//     -> Phase 10 Computation Services (computeOee, computeLeanMetrics, evaluateVsm)
//       -> Phase 11 Analytics Service (this module: aggregation, bucketing, rollup)
//         -> Analytics API (ok/fail envelope)
//           -> Dashboard / Reports / Export UI
//
// D1: live on-demand computation ONLY (no AnalyticsSnapshot — owner preferred simpler architecture).
// D3: delivery = null + warning (no shipment source).
// D4: critical problems = open NCR/Deviation/CAPA with open RiskAssessment RPN >= threshold (default 15).
// D5: overdue actions = union of calibration/maintenance/training (authoritative dueDate);
//     CAPA/ChangeControl have NO dueDate -> reported as "limited" (NOT invented).
// D6: recurrence = group by (subjectType, subjectId); effectiveness = CAPA outcome + post-closure recurrence.
// D7: corporate = aggregate-only, server-side enforced, audited.
// D11: 4 perms; AI gets analytics.read ONLY.
// D13: NO AI feature in Phase 11.
// D14: site-local timezone authoritative; UTC for corporate; ISO Mon-Sun weeks.
// D15: 90-day on-demand cap; do NOT silently truncate.

import { z } from "zod";

// ============================================================================
// KPI SOURCE-OF-TRUTH MAPPING (mandatory documentation; owner rule)
// Every KPI below traces to a Phase 10 computation result or a trusted-data aggregate.
// No KPI is computed client-side. No KPI is invented.
// ============================================================================

export const KPI_SOURCES = {
  // === Production dashboard ===
  plannedTotal: { source: "WorkOrder.plannedQuantity", phase: "3", computation: "SUM over WorkOrders in range at site" },
  actualTotal: { source: "ManufacturingBatch.actualQuantity", phase: "3", computation: "SUM over completed batches in range" },
  variance: { source: "Computed", phase: "11", computation: "actualTotal - plannedTotal" },

  // === OEE dashboard (PASSTHROUGH of Phase 10 computeOee — NO reimplementation) ===
  oee: { source: "computeOee() -> OeeResult.oee", phase: "10", computation: "Availability x Performance x Quality" },
  availability: { source: "computeOee() -> OeeResult.availability", phase: "10", computation: "(Planned Time - Downtime) / Planned Time" },
  performance: { source: "computeOee() -> OeeResult.performance", phase: "10", computation: "Ideal Duration / Run Time" },
  quality: { source: "computeOee() -> OeeResult.quality", phase: "10", computation: "Good Count / Total Count" },

  // === Quality dashboard ===
  rejectRate: { source: "ProductionScrap.quantity + ProductionRework.quantity + ManufacturingBatch.actualQuantity", phase: "3-4", computation: "(Scrap + Rework) / Total" },
  fpy: { source: "computeLeanMetrics() -> LeanMetricsResult.fpy", phase: "10", computation: "Good Count / Total Count" },
  openNcrs: { source: "NCR where status not in (CLOSED, CANCELLED)", phase: "4", computation: "COUNT at site" },
  openDeviations: { source: "Deviation where status not in (CLOSED, REJECTED)", phase: "4", computation: "COUNT at site" },
  openCapas: { source: "CAPA where status != CLOSED", phase: "4", computation: "COUNT at site" },
  testPassCount: { source: "TestResult where status in (REVIEWED, DISPOSITIONED) and disposition = PASS_RELEASE", phase: "5", computation: "COUNT at site in range" },
  testFailCount: { source: "TestResult where disposition in (FAIL_HOLD, FAIL_REJECT)", phase: "5", computation: "COUNT at site in range" },

  // === Downtime dashboard (PASSTHROUGH of Phase 10 paretoDowntime) ===
  downtimePareto: { source: "computeLeanMetrics() -> LeanMetricsResult.paretoDowntime", phase: "10", computation: "DowntimeEvent grouped by category, sorted by total duration" },
  totalDowntimeMinutes: { source: "DowntimeEvent.durationMinutes (CLOSED)", phase: "10", computation: "SUM at site in range" },

  // === Bottleneck dashboard (PASSTHROUGH of Phase 10 bottlenecks) ===
  bottlenecks: { source: "computeLeanMetrics() -> LeanMetricsResult.bottlenecks", phase: "10", computation: "Equipment ranked by avg cycle time" },

  // === Critical problems (D4) ===
  criticalProblems: {
    source: "NCR/Deviation/CAPA (open) + RiskAssessment (open, RPN >= threshold)",
    phase: "4",
    computation: "Open quality record that is the subject of an open RiskAssessment with RPN >= 15 (configurable)",
  },

  // === Overdue actions (D5) ===
  overdueCalibration: { source: "CalibrationRecord.nextCalibrationDue < now() AND equipment OPERATIONAL", phase: "8", computation: "Authoritative due date" },
  overdueMaintenance: { source: "MaintenanceRecord.scheduledDate < now() AND status != COMPLETED", phase: "8", computation: "Authoritative due date" },
  overdueTraining: { source: "TrainingRecord.expiresAt < now() OR (status = SCHEDULED AND trainedAt + validityPeriod < now())", phase: "7", computation: "Authoritative due date" },
  // CAPA + ChangeControl: NO authoritative dueDate -> reported as "limited" (D5: do NOT invent)

  // === Recurrence / effectiveness (D6) ===
  recurrence: { source: "NCR/Deviation grouped by (concernsEntityType, concernsEntityId)", phase: "4", computation: "Subjects with >1 occurrence in range" },
  actionEffectiveness: { source: "CAPA.effectivenessVerification + post-closure NCR/Deviation on same subject", phase: "4", computation: "CAPA outcome + recurrence-since-close" },

  // === Delivery (D3 — NO source) ===
  deliveryPerformance: { source: "NONE — no shipment/delivery entity in Phase 1-10", phase: "N/A", computation: "Returns null + warning (deferred)" },

  // === VSM (PASSTHROUGH of Phase 10 evaluateVsm) ===
  vsmEvaluation: { source: "evaluateVsm() -> VsmEvaluation", phase: "10", computation: "SUM of VsmNode leadTime/valueAdded" },
} as const;

// ============================================================================
// Date-range presets (D14: site-local timezone; D15: 90-day cap)
// ============================================================================

export const DATE_PRESETS = ["SHIFT", "DAY", "WEEK", "MONTH", "CUSTOM"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const GRANULARITIES = ["HOUR", "DAY", "WEEK", "MONTH"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

// D15: 90-day on-demand computation cap. Longer ranges require explicit acknowledgement.
export const ON_DEMAND_MAX_DAYS = 90;
// D4: critical-problems RPN threshold (configurable; default 15).
export const CRITICAL_RPN_THRESHOLD = 15;

// ============================================================================
// Result types
// ============================================================================

// Every analytics response carries: the value(s), the source provenance, warnings, and a data-state.
// The data-state lets the UI distinguish calculated / unavailable / incomplete / warning (owner rule).
export type DataState = "calculated" | "unavailable" | "incomplete" | "warning";

export interface AnalyticsMeta {
  dataState: DataState;
  sources: Record<string, string>; // KPI key -> provenance string (from KPI_SOURCES)
  warnings: string[];
  computedAt: string; // ISO timestamp
  range: { fromDate: string; toDate: string };
  siteId: string;
}

export interface ProductionDashboard {
  plannedTotal: number;
  actualTotal: number;
  variance: number;
  byDay: Array<{ date: string; planned: number; actual: number }>;
  meta: AnalyticsMeta;
}

export interface OeeDashboard {
  // Passthrough of Phase 10 OeeResult (NO reimplementation)
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  sources: {
    plannedTimeMinutes: number;
    downtimeMinutes: number;
    runTimeMinutes: number;
    idealDurationMinutes: number;
    totalCount: number;
    goodCount: number;
    scrapCount: number;
    reworkCount: number;
  };
  meta: AnalyticsMeta;
}

export interface QualityDashboard {
  rejectRate: number | null;
  fpy: number | null;
  scrapRate: number | null;
  reworkRate: number | null;
  openNcrs: number;
  openDeviations: number;
  openCapas: number;
  testPassCount: number;
  testFailCount: number;
  meta: AnalyticsMeta;
}

export interface DowntimeDashboard {
  pareto: Array<{ category: string; totalDurationMinutes: number; count: number; cumulativePercent: number }>;
  totalDowntimeMinutes: number;
  meta: AnalyticsMeta;
}

export interface BottleneckDashboard {
  bottlenecks: Array<{ workCenterCode: string; equipmentCode: string; oee: number | null; avgCycleTime: number | null }>;
  meta: AnalyticsMeta;
}

export interface CriticalProblemsDashboard {
  threshold: number;
  items: Array<{
    type: "NCR" | "DEVIATION" | "CAPA";
    id: string;
    code: string;
    status: string;
    rpn: number;
    riskAssessmentId: string;
    riskAssessmentCode: string;
    associationPath: string; // transparency: how this item was linked to the high-RPN risk
    openedAt: string;
  }>;
  meta: AnalyticsMeta;
}

export interface OverdueActionsDashboard {
  items: Array<{
    type: "CALIBRATION" | "MAINTENANCE" | "TRAINING";
    id: string;
    code: string;
    dueDate: string;
    daysOverdue: number;
    detail: string;
  }>;
  // D5: CAPA + ChangeControl have NO authoritative dueDate -> reported as limited (NOT invented)
  limitations: Array<{ type: "CAPA" | "CHANGE_CONTROL"; reason: string }>;
  meta: AnalyticsMeta;
}

export interface DeliveryDashboard {
  value: null; // D3: always null — no shipment source
  meta: AnalyticsMeta;
}

export interface TrendReport {
  buckets: Array<{
    bucketStart: string;
    bucketEnd: string;
    values: Record<string, number | null>;
    source: "live"; // D1: always live (no snapshots)
    warnings: string[];
  }>;
  meta: AnalyticsMeta;
}

export interface RecurrenceReport {
  items: Array<{
    subjectType: string;
    subjectId: string;
    subjectLabel: string;
    occurrences: number;
    dates: string[];
    linkedCapaIds: string[];
  }>;
  meta: AnalyticsMeta;
}

export interface ActionEffectivenessReport {
  items: Array<{
    capaId: string;
    capaCode: string;
    closedAt: string | null;
    effectivenessOutcome: string | null;
    recurrenceSinceClose: boolean;
    recurrenceCount: number;
  }>;
  meta: AnalyticsMeta;
}

export interface EquipmentPerformanceReport {
  items: Array<{
    equipmentId: string;
    equipmentCode: string;
    equipmentName: string;
    oee: number | null;
    availability: number | null;
    performance: number | null;
    quality: number | null;
    runTimeMinutes: number;
  }>;
  meta: AnalyticsMeta;
}

export interface VsmView {
  vsm: {
    id: string;
    code: string;
    name: string;
    siteId: string | null;
    status: string;
  };
  nodes: Array<{
    id: string;
    sequence: number;
    nodeType: string;
    name: string;
    leadTimeMinutes: number | null;
    valueAddedMinutes: number | null;
  }>;
  edges: Array<{ id: string; fromNodeId: string; toNodeId: string }>;
  evaluation: {
    totalLeadTimeMinutes: number;
    totalValueAddedMinutes: number;
    totalNonValueAddedMinutes: number;
    valueAddedRatio: number;
    nodeCount: number;
  };
  meta: AnalyticsMeta;
}

export interface CorporateSummary {
  aggregate: Record<string, number | null>;
  contributingSiteCount: number;
  note: string;
  meta: AnalyticsMeta & { audited: true };
}

// ============================================================================
// Zod schemas (input validation)
// ============================================================================

const siteIdField = z.string().cuid();
const dateField = z.coerce.date();

export const DashboardQuerySchema = z.object({
  siteId: siteIdField,
  fromDate: dateField,
  toDate: dateField,
  equipmentId: z.string().cuid().optional(),
  workCenterId: z.string().cuid().optional(),
  productId: z.string().cuid().optional(),
}).refine((d) => d.toDate > d.fromDate, { message: "toDate must be after fromDate" });

export const TrendQuerySchema = z.object({
  siteId: siteIdField,
  fromDate: dateField,
  toDate: dateField,
  granularity: z.enum(GRANULARITIES),
  equipmentId: z.string().cuid().optional(),
}).refine((d) => d.toDate > d.fromDate, { message: "toDate must be after fromDate" });

export const CriticalQuerySchema = z.object({
  siteId: siteIdField,
  threshold: z.number().int().min(1).max(25).optional(), // default CRITICAL_RPN_THRESHOLD
});

export const OverdueQuerySchema = z.object({
  siteId: siteIdField,
});

export const EquipmentPerfQuerySchema = z.object({
  siteId: siteIdField,
  fromDate: dateField,
  toDate: dateField,
}).refine((d) => d.toDate > d.fromDate, { message: "toDate must be after fromDate" });

export const RecurrenceQuerySchema = z.object({
  siteId: siteIdField,
  fromDate: dateField,
  toDate: dateField,
}).refine((d) => d.toDate > d.fromDate, { message: "toDate must be after fromDate" });

export const CorporateQuerySchema = z.object({
  fromDate: dateField,
  toDate: dateField,
  metricKeys: z.array(z.string()).min(1),
}).refine((d) => d.toDate > d.fromDate, { message: "toDate must be after fromDate" });

export const ExportQuerySchema = z.object({
  reportType: z.enum([
    "production", "oee", "quality", "downtime", "bottlenecks",
    "critical-problems", "overdue-actions", "delivery",
    "oee-trend", "quality-trend", "downtime-pareto",
    "equipment-performance", "recurrence", "action-effectiveness",
  ]),
  params: z.record(z.string(), z.unknown()),
  format: z.enum(["csv"]).default("csv"),
});

// Helper: enforce D15 90-day cap. Throws if range exceeds cap.
export function assertRangeCap(fromDate: Date, toDate: Date, label = "analytics"): void {
  const days = (toDate.getTime() - fromDate.getTime()) / 86400000;
  if (days > ON_DEMAND_MAX_DAYS) {
    throw new ValidationError(
      `${label} on-demand range exceeds ${ON_DEMAND_MAX_DAYS}-day cap (requested ${Math.ceil(days)} days). Reduce the range or request a snapshot-enabled report.`,
    );
  }
}

import { ValidationError } from "@/lib/errors";
