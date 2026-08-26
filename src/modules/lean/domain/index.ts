// Phase 10 Lean domain: downtime state machine + VSM + zod + OEE types.
// D3: OEE computed on-demand. D6: downtime category free-text. D7: AI read-only.
// Metric sources (documented, not invented):
//   Planned Time = Shift.startTime to Shift.endTime (minutes per shift)
//   Run Time = Σ(OperationExecution.completedAt - startedAt)
//   Ideal Duration = Σ(Operation.estimatedDurationMinutes)
//   Total Count = Σ(ManufacturingBatch.actualQuantity)
//   Scrap = Σ(ProductionScrap.quantity)
//   Rework = Σ(ProductionRework.quantity)
import { z } from "zod";
import { StateTransitionError } from "@/lib/errors";

// Downtime state machine
export const DOWNTIME_STATUSES = ["OPEN", "CLOSED"] as const;
export function assertDowntimeTransition(from: string, to: string): void {
  if (from === "OPEN" && to === "CLOSED") return;
  if (from === "CLOSED") throw new StateTransitionError("DowntimeEvent is already CLOSED (terminal)");
  throw new StateTransitionError(`Cannot transition downtime from ${from} to ${to}`);
}

// OEE result type (computed, not stored)
export interface OeeResult {
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
  warnings: string[];
}

// Lean metrics result type
export interface LeanMetricsResult {
  taktTime: number | null;
  cycleTime: number | null;
  fpy: number | null;
  scrapRate: number | null;
  reworkRate: number | null;
  mtbf: number | null;
  mttr: number | null;
  paretoDowntime: Array<{ category: string; totalDurationMinutes: number; count: number }>;
  paretoScrap: Array<{ reason: string; totalQuantity: number; count: number }>;
  bottlenecks: Array<{ workCenterCode: string; equipmentCode: string; oee: number | null; avgCycleTime: number | null }>;
  sources: Record<string, string>;
  warnings: string[];
}

// VSM evaluation result
export interface VsmEvaluation {
  totalLeadTimeMinutes: number;
  totalValueAddedMinutes: number;
  totalNonValueAddedMinutes: number;
  valueAddedRatio: number;
  nodeCount: number;
}

// Zod schemas
export const CreateDowntimeSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  equipmentId: z.string().cuid(),
  siteId: z.string().cuid(),
  workCenterId: z.string().cuid().optional(),
  downtimeCategory: z.string().min(1).max(100),
  reason: z.string().min(1).max(500),
  startTime: z.coerce.date(),
  shiftId: z.string().cuid().optional(),
});
export const CloseDowntimeSchema = z.object({
  endTime: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});
export const OeeQuerySchema = z.object({
  equipmentId: z.string().cuid().optional(),
  workCenterId: z.string().cuid().optional(),
  siteId: z.string().cuid(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
});
export const MetricsQuerySchema = z.object({
  siteId: z.string().cuid(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  equipmentId: z.string().cuid().optional(),
});
export const CreateVsmSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1).max(200),
  siteId: z.string().cuid().nullable().optional(),
  description: z.string().max(2000).optional(),
});
export const CreateVsmNodeSchema = z.object({
  vsmId: z.string().cuid(),
  sequence: z.number().int().min(0),
  nodeType: z.enum(["SUPPLIER", "MATERIAL", "PROCESS", "INVENTORY", "CUSTOMER"]),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  leadTimeMinutes: z.number().int().min(0).optional(),
  valueAddedMinutes: z.number().int().min(0).optional(),
});
export const CreateVsmEdgeSchema = z.object({
  fromNodeId: z.string().cuid(),
  toNodeId: z.string().cuid(),
  description: z.string().max(2000).optional(),
});
