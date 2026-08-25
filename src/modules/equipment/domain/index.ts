// Phase 8 equipment domain: state machines + calibration status logic + guards + zod.
// D2: calibrationStatus stored on Equipment. D4: Qualification state machine.
// D5: No auto-actions. PRD §5: Never invent acceptance criteria.
import { z } from "zod";
import { StateTransitionError, ValidationError } from "@/lib/errors";

// ---- Maintenance state machine (D5) ----
export const MAINT_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED"] as const;
export type MaintStatus = (typeof MAINT_STATUSES)[number];
const MAINT_TRANSITIONS: Record<MaintStatus, MaintStatus[]> = {
  SCHEDULED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
};
export function isValidMaintTransition(from: MaintStatus, to: MaintStatus): boolean {
  return MAINT_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertMaintTransition(from: string, to: string): void {
  if (!MAINT_STATUSES.includes(from as MaintStatus)) throw new ValidationError(`Invalid maintenance status: ${from}`);
  if (!MAINT_STATUSES.includes(to as MaintStatus)) throw new ValidationError(`Invalid maintenance status: ${to}`);
  if (!isValidMaintTransition(from as MaintStatus, to as MaintStatus)) throw new StateTransitionError(`Cannot transition maintenance from ${from} to ${to}`);
}

// ---- Qualification state machine (D4) ----
export const QUAL_STATUSES = ["REQUIREMENT", "PROTOCOL", "EXECUTION", "RESULT", "DEVIATION", "APPROVAL", "REPORT"] as const;
export type QualStatus = (typeof QUAL_STATUSES)[number];
const QUAL_TRANSITIONS: Record<QualStatus, QualStatus[]> = {
  REQUIREMENT: ["PROTOCOL"],
  PROTOCOL: ["EXECUTION"],
  EXECUTION: ["RESULT", "DEVIATION"],
  RESULT: ["APPROVAL"],
  DEVIATION: ["APPROVAL"],
  APPROVAL: ["REPORT"],
  REPORT: [],
};
export function isValidQualTransition(from: QualStatus, to: QualStatus): boolean {
  return QUAL_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertQualTransition(from: string, to: string): void {
  if (!QUAL_STATUSES.includes(from as QualStatus)) throw new ValidationError(`Invalid qualification status: ${from}`);
  if (!QUAL_STATUSES.includes(to as QualStatus)) throw new ValidationError(`Invalid qualification status: ${to}`);
  if (!isValidQualTransition(from as QualStatus, to as QualStatus)) throw new StateTransitionError(`Cannot transition qualification from ${from} to ${to}`);
}

// ---- Calibration status logic (D2) ----
export const CALIBRATION_STATUSES = ["VALID", "EXPIRING", "EXPIRED", "OUT_OF_SERVICE"] as const;
export function computeCalibrationStatus(nextCalibrationDue: Date, operationalStatus: string): string {
  if (operationalStatus === "OUT_OF_SERVICE") return "OUT_OF_SERVICE";
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (nextCalibrationDue < now) return "EXPIRED";
  if (nextCalibrationDue <= thirtyDaysFromNow) return "EXPIRING";
  return "VALID";
}

// ---- OUT_OF_SERVICE guard (owner constraint: equipment must not be silently usable) ----
export function assertEquipmentUsable(operationalStatus: string): void {
  if (operationalStatus === "OUT_OF_SERVICE") {
    throw new StateTransitionError("Equipment is OUT_OF_SERVICE and cannot be used for new OperationExecution records");
  }
}

// ---- Zod schemas ----
export const CreateEquipmentSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1).max(200),
  equipmentType: z.string().min(1).max(200),
  serialNumber: z.string().max(100).optional(),
  manufacturer: z.string().max(200).optional(),
  model: z.string().max(100).optional(),
  workCenterId: z.string().cuid().optional(),
  siteId: z.string().cuid(),
});
export const UpdateEquipmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  operationalStatus: z.enum(["OPERATIONAL", "MAINTENANCE", "OUT_OF_SERVICE"]).optional(),
});
export const CreateMaintenanceSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  equipmentId: z.string().cuid(),
  siteId: z.string().cuid(),
  maintenanceType: z.enum(["PREVENTIVE", "CORRECTIVE", "PREDICTIVE"]).default("PREVENTIVE"),
  scheduledDate: z.coerce.date().optional(),
});
export const MaintTransitionSchema = z.object({ to: z.enum(MAINT_STATUSES), reason: z.string().min(1).max(500), findings: z.string().max(5000).optional() });
export const CreateCalibrationSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  equipmentId: z.string().cuid(),
  siteId: z.string().cuid(),
  standard: z.string().max(200).optional(),
  result: z.enum(["PASS", "FAIL"]),
  nextCalibrationDue: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});
export const CreateQualificationSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  equipmentId: z.string().cuid(),
  siteId: z.string().cuid(),
  qualificationType: z.enum(["IQ", "OQ", "PQ"]),
  protocol: z.string().max(5000).optional(),
  acceptanceCriteria: z.string().max(5000).optional(),
});
export const QualTransitionSchema = z.object({
  to: z.enum(QUAL_STATUSES),
  reason: z.string().min(1).max(500),
  executionResult: z.string().max(5000).optional(),
  deviationId: z.string().cuid().optional(),
  reportRef: z.string().max(500).optional(),
});
