// Phase 7 domain: state machines + guards + zod for Document Control, Training, Supplier Audits.
// D2: Doc immutable when Effective. D6: No auto-RBAC from competency. D7: No auto qualification change.
import { z } from "zod";
import { StateTransitionError, ValidationError } from "@/lib/errors";

// ---- ControlledDocument state machine (D2) ----
export const DOC_STATUSES = ["DRAFT", "REVIEW", "APPROVED", "EFFECTIVE", "SUPERSEDED", "OBSOLETE"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];
const DOC_TRANSITIONS: Record<DocStatus, DocStatus[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["DRAFT", "APPROVED"],
  APPROVED: ["EFFECTIVE"],
  EFFECTIVE: ["SUPERSEDED"],
  SUPERSEDED: ["OBSOLETE"],
  OBSOLETE: [],
};
export function isValidDocTransition(from: DocStatus, to: DocStatus): boolean {
  return DOC_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertDocTransition(from: string, to: string): void {
  if (!DOC_STATUSES.includes(from as DocStatus)) throw new ValidationError(`Invalid doc status: ${from}`);
  if (!DOC_STATUSES.includes(to as DocStatus)) throw new ValidationError(`Invalid doc status: ${to}`);
  if (!isValidDocTransition(from as DocStatus, to as DocStatus)) throw new StateTransitionError(`Cannot transition document from ${from} to ${to}`);
}
export function isDocEditable(status: string): boolean { return status === "DRAFT"; }
export function assertDocEditable(status: string): void {
  if (!isDocEditable(status)) throw new StateTransitionError(`Document is immutable in status ${status} (D2)`);
}

// ---- TrainingRecord state machine ----
export const TRAINING_STATUSES = ["SCHEDULED", "COMPLETED", "EXPIRED"] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];
const TRAINING_TRANSITIONS: Record<TrainingStatus, TrainingStatus[]> = {
  SCHEDULED: ["COMPLETED"],
  COMPLETED: ["EXPIRED"],
  EXPIRED: [],
};
export function isValidTrainingTransition(from: TrainingStatus, to: TrainingStatus): boolean {
  return TRAINING_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertTrainingTransition(from: string, to: string): void {
  if (!TRAINING_STATUSES.includes(from as TrainingStatus)) throw new ValidationError(`Invalid training status: ${from}`);
  if (!TRAINING_STATUSES.includes(to as TrainingStatus)) throw new ValidationError(`Invalid training status: ${to}`);
  if (!isValidTrainingTransition(from as TrainingStatus, to as TrainingStatus)) throw new StateTransitionError(`Cannot transition training record from ${from} to ${to}`);
}

// ---- SupplierAudit state machine ----
export const AUDIT_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CLOSED"] as const;
export type AuditStatus = (typeof AUDIT_STATUSES)[number];
const AUDIT_TRANSITIONS: Record<AuditStatus, AuditStatus[]> = {
  SCHEDULED: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: ["CLOSED"],
  CLOSED: [],
};
export function isValidAuditTransition(from: AuditStatus, to: AuditStatus): boolean {
  return AUDIT_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertAuditTransition(from: string, to: string): void {
  if (!AUDIT_STATUSES.includes(from as AuditStatus)) throw new ValidationError(`Invalid audit status: ${from}`);
  if (!AUDIT_STATUSES.includes(to as AuditStatus)) throw new ValidationError(`Invalid audit status: ${to}`);
  if (!isValidAuditTransition(from as AuditStatus, to as AuditStatus)) throw new StateTransitionError(`Cannot transition supplier audit from ${from} to ${to}`);
}

// ---- Zod schemas ----
export const CreateDocumentSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  title: z.string().min(1).max(200),
  documentType: z.enum(["SOP", "WORK_INSTRUCTION", "SPECIFICATION", "PROTOCOL", "REPORT", "FORM", "OTHER"]).default("SOP"),
  version: z.string().min(1).max(20),
  filePath: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
});
export const DocTransitionSchema = z.object({ to: z.enum(DOC_STATUSES), reason: z.string().min(1).max(500) });

export const CreateRequiredTrainingSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  documentId: z.string().cuid().optional(),
  validityPeriodMonths: z.number().int().min(1).max(120).optional(),
});
export const CreateTrainingRecordSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  employeeId: z.string().cuid(),
  requiredTrainingId: z.string().cuid().optional(),
  siteId: z.string().cuid(),
  notes: z.string().max(2000).optional(),
});
export const TrainingTransitionSchema = z.object({ to: z.enum(TRAINING_STATUSES), reason: z.string().min(1).max(500) });
export const CreateAssessmentSchema = z.object({
  result: z.enum(["PASS", "FAIL"]),
  score: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});
export const CreateCompetencySchema = z.object({
  employeeId: z.string().cuid(),
  requiredTrainingId: z.string().cuid().optional(),
  trainingRecordId: z.string().cuid().optional(),
  competencyLevel: z.enum(["AUTHORIZED", "CONDITIONAL", "NOT_AUTHORIZED"]).default("AUTHORIZED"),
  expiresAt: z.coerce.date().optional(),
});

export const CreateSupplierAuditSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  supplierId: z.string().cuid(),
  siteId: z.string().cuid(),
  auditType: z.enum(["INITIAL", "PERIODIC", "FOR_CAUSE", "FOLLOW_UP"]).default("PERIODIC"),
  scheduledDate: z.coerce.date().optional(),
});
export const AuditTransitionSchema = z.object({
  to: z.enum(AUDIT_STATUSES),
  reason: z.string().min(1).max(500),
  findings: z.string().max(5000).optional(),
  result: z.enum(["PASS", "CONDITIONAL_PASS", "FAIL"]).optional(),
  qualificationImpact: z.enum(["NO_CHANGE", "UPGRADE_TO_APPROVED", "DOWNGRADE_TO_CONDITIONAL", "DISQUALIFY"]).optional(),
  capaId: z.string().cuid().optional(),
});
