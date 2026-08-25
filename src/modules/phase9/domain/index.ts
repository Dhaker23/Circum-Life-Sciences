// Phase 9 domain: state machines + auto-evaluation + guards + zod.
// D2: Cleanroom limits never hard-coded. D4: Sterilization release human-only.
// D5: Batch disposition human-only. D8: AI never release/disposition.
import { z } from "zod";
import { StateTransitionError, ValidationError } from "@/lib/errors";

// Cleanroom auto-evaluation (D2: uses configured limits, never hard-coded)
export function evaluateMonitoringResult(value: number, alertLimit: number, actionLimit: number): string {
  if (value > actionLimit) return "ACTION_EXCEEDANCE";
  if (value > alertLimit) return "ALERT";
  return "NORMAL";
}

// Excursion state machine
export const EXCURSION_STATUSES = ["OPEN", "INVESTIGATING", "CLOSED"] as const;
const EXC_TRANSITIONS: Record<string, string[]> = { OPEN: ["INVESTIGATING", "CLOSED"], INVESTIGATING: ["CLOSED"], CLOSED: [] };
export function assertExcursionTransition(from: string, to: string): void {
  if (!EXC_TRANSITIONS[from]?.includes(to)) throw new StateTransitionError(`Cannot transition excursion from ${from} to ${to}`);
}

// Packaging state machine
export const PACKAGING_STATUSES = ["IN_PROGRESS", "COMPLETED", "FAILED"] as const;
const PKG_TRANSITIONS: Record<string, string[]> = { IN_PROGRESS: ["COMPLETED", "FAILED"], COMPLETED: [], FAILED: [] };
export function assertPackagingTransition(from: string, to: string): void {
  if (!PKG_TRANSITIONS[from]?.includes(to)) throw new StateTransitionError(`Cannot transition packaging from ${from} to ${to}`);
}

// Sterilization state machine (D4: RELEASED is human-only)
export const STER_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "RELEASED", "REJECTED"] as const;
const STER_TRANSITIONS: Record<string, string[]> = { SCHEDULED: ["IN_PROGRESS"], IN_PROGRESS: ["COMPLETED"], COMPLETED: ["RELEASED", "REJECTED"], RELEASED: [], REJECTED: [] };
export function assertSterTransition(from: string, to: string): void {
  if (!STER_TRANSITIONS[from]?.includes(to)) throw new StateTransitionError(`Cannot transition sterilization from ${from} to ${to}`);
}

// Batch Review state machine (D5: extends ManufacturingBatch)
export const BATCH_REVIEW_STATUSES = ["READY_FOR_REVIEW", "QA_REVIEW", "APPROVED", "HOLD", "REWORK", "REJECT"] as const;
const BR_TRANSITIONS: Record<string, string[]> = {
  READY_FOR_REVIEW: ["QA_REVIEW"],
  QA_REVIEW: ["APPROVED", "HOLD", "REWORK", "REJECT"],
  APPROVED: [], HOLD: ["QA_REVIEW"], REWORK: [], REJECT: [],
};
export function assertBatchReviewTransition(from: string, to: string): void {
  if (!BR_TRANSITIONS[from]?.includes(to)) throw new StateTransitionError(`Cannot transition batch from ${from} to ${to}`);
}

// Zod schemas
export const CreateCleanroomSchema = z.object({ code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/), name: z.string().min(1).max(200), siteId: z.string().cuid(), classification: z.string().max(50).optional() });
export const CreateMonitoringPointSchema = z.object({ cleanroomId: z.string().cuid(), code: z.string().min(1).max(40), name: z.string().min(1).max(200), parameter: z.string().min(1).max(200), unit: z.string().min(1).max(50), alertLimit: z.string().regex(/^\d+(\.\d+)?$/), actionLimit: z.string().regex(/^\d+(\.\d+)?$/) });
export const CreateMonitoringResultSchema = z.object({ code: z.string().min(2).max(40), monitoringPointId: z.string().cuid(), siteId: z.string().cuid(), value: z.string().regex(/^\d+(\.\d+)?$/), unit: z.string().min(1).max(50), notes: z.string().max(2000).optional() });
export const ExcursionTransitionSchema = z.object({ to: z.enum(EXCURSION_STATUSES), reason: z.string().min(1).max(500) });
export const CreatePackagingSchema = z.object({ code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/), siteId: z.string().cuid(), targetEntityType: z.enum(["DEVICE_LOT", "BATCH"]), targetEntityId: z.string().cuid(), packagingConfiguration: z.string().max(2000).optional(), equipmentId: z.string().cuid().optional(), operatorEmployeeId: z.string().cuid().optional(), notes: z.string().max(2000).optional() });
export const PackagingTransitionSchema = z.object({ to: z.enum(PACKAGING_STATUSES), reason: z.string().min(1).max(500), inspectionResult: z.enum(["PASS", "FAIL", "CONDITIONAL"]).optional() });
export const CreateSterilizationSchema = z.object({ code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/), siteId: z.string().cuid(), processType: z.enum(["ETO", "GAMMA", "BETA", "X_RAY"]), sterilizationLotCode: z.string().max(100).optional(), equipmentId: z.string().cuid().optional(), cycleNumber: z.string().max(50).optional() });
export const SterTransitionSchema = z.object({ to: z.enum(STER_STATUSES), reason: z.string().min(1).max(500) });
export const SterReleaseSchema = z.object({ releaseNotes: z.string().max(2000).optional() });
export const LinkDeviceLotSchema = z.object({ deviceLotId: z.string().cuid() });
export const BatchReviewTransitionSchema = z.object({ to: z.enum(["QA_REVIEW"]), reason: z.string().min(1).max(500) });
export const BatchDispositionSchema = z.object({ disposition: z.enum(["APPROVED", "HOLD", "REWORK", "REJECT"]), reviewFindings: z.string().max(5000).optional(), dispositionNotes: z.string().max(2000).optional() });
