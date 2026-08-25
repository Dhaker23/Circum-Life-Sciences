// Phase 4 quality domain: state machines + guards + polymorphic validation + zod.
// D1: NCR (unplanned) != Deviation (planned). D2: Investigation != CAPA (CAPA source polymorphic).
// D3-D6: state machines. D5: CAPA closure requires human effectiveness verification.
// D6: Change implementation requires human approval. D7: RPN = severity x probability.
// D8: polymorphic linkage (entityType + entityId), service-validated.
// PRD section 9: AI MUST NEVER close CAPA / approve deviations / approve changes.
import { z } from "zod";
import { StateTransitionError, ValidationError } from "@/lib/errors";

// ---- NCR state machine (D3) ----
export const NCR_STATUSES = ["DRAFT", "CONTAINMENT", "INVESTIGATION", "DISPOSITION", "CLOSED", "CANCELLED"] as const;
export type NcrStatus = (typeof NCR_STATUSES)[number];
const NCR_TRANSITIONS: Record<NcrStatus, NcrStatus[]> = {
  DRAFT: ["CONTAINMENT", "CANCELLED"],
  CONTAINMENT: ["INVESTIGATION", "DISPOSITION", "CANCELLED"],
  INVESTIGATION: ["DISPOSITION", "CONTAINMENT"],
  DISPOSITION: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};
export function isValidNcrTransition(from: NcrStatus, to: NcrStatus): boolean {
  return NCR_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertNcrTransition(from: string, to: string): void {
  if (!NCR_STATUSES.includes(from as NcrStatus)) throw new ValidationError(`Invalid NCR status: ${from}`);
  if (!NCR_STATUSES.includes(to as NcrStatus)) throw new ValidationError(`Invalid NCR status: ${to}`);
  if (!isValidNcrTransition(from as NcrStatus, to as NcrStatus)) {
    throw new StateTransitionError(`Cannot transition NCR from ${from} to ${to}`);
  }
}

// ---- Deviation state machine (D4) ----
export const DEVIATION_STATUSES = ["DRAFT", "ASSESSMENT", "INVESTIGATION", "REVIEW", "CLOSED", "REJECTED"] as const;
export type DeviationStatus = (typeof DEVIATION_STATUSES)[number];
const DEVIATION_TRANSITIONS: Record<DeviationStatus, DeviationStatus[]> = {
  DRAFT: ["ASSESSMENT", "REJECTED"],
  ASSESSMENT: ["INVESTIGATION", "REVIEW", "REJECTED"],
  INVESTIGATION: ["REVIEW"],
  REVIEW: ["CLOSED", "REJECTED"],
  CLOSED: [],
  REJECTED: [],
};
export function isValidDeviationTransition(from: DeviationStatus, to: DeviationStatus): boolean {
  return DEVIATION_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertDeviationTransition(from: string, to: string): void {
  if (!DEVIATION_STATUSES.includes(from as DeviationStatus)) throw new ValidationError(`Invalid deviation status: ${from}`);
  if (!DEVIATION_STATUSES.includes(to as DeviationStatus)) throw new ValidationError(`Invalid deviation status: ${to}`);
  if (!isValidDeviationTransition(from as DeviationStatus, to as DeviationStatus)) {
    throw new StateTransitionError(`Cannot transition deviation from ${from} to ${to}`);
  }
}

// ---- Investigation status (D2) ----
export const INVESTIGATION_STATUSES = ["IN_PROGRESS", "CONCLUDED"] as const;
export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];
export function assertInvestigationConclude(from: string): void {
  if (from !== "IN_PROGRESS") throw new StateTransitionError(`Cannot conclude an investigation in status ${from}`);
}

// ---- CAPA state machine (D5) ----
export const CAPA_STATUSES = ["OPEN", "ACTION_PLAN", "IMPLEMENTATION", "EFFECTIVENESS", "CLOSED"] as const;
export type CapaStatus = (typeof CAPA_STATUSES)[number];
const CAPA_TRANSITIONS: Record<CapaStatus, CapaStatus[]> = {
  OPEN: ["ACTION_PLAN"],
  ACTION_PLAN: ["IMPLEMENTATION"],
  IMPLEMENTATION: ["EFFECTIVENESS"],
  EFFECTIVENESS: ["CLOSED"],
  CLOSED: [],
};
export function isValidCapaTransition(from: CapaStatus, to: CapaStatus): boolean {
  return CAPA_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertCapaTransition(from: string, to: string): void {
  if (!CAPA_STATUSES.includes(from as CapaStatus)) throw new ValidationError(`Invalid CAPA status: ${from}`);
  if (!CAPA_STATUSES.includes(to as CapaStatus)) throw new ValidationError(`Invalid CAPA status: ${to}`);
  if (!isValidCapaTransition(from as CapaStatus, to as CapaStatus)) {
    throw new StateTransitionError(`Cannot transition CAPA from ${from} to ${to}`);
  }
}
// D5 guard: CAPA closure requires effectiveness verification + human verifier.
export function assertCapaClosureAllowed(capa: {
  effectivenessVerification: string | null;
  effectivenessVerifiedByUserId: string | null;
}): void {
  if (!capa.effectivenessVerification || capa.effectivenessVerification.trim() === "") {
    throw new StateTransitionError("CAPA cannot be closed: effectiveness verification evidence is required (PRD section 9)");
  }
  if (!capa.effectivenessVerifiedByUserId) {
    throw new StateTransitionError("CAPA cannot be closed: a human must verify effectiveness (PRD section 9: AI MUST NEVER close CAPA)");
  }
}

// ---- Change Control state machine (D6) ----
export const CHANGE_STATUSES = ["REQUEST", "IMPACT", "RISK", "APPROVAL", "IMPLEMENTATION", "VERIFICATION", "EFFECTIVENESS", "CLOSED", "REJECTED"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];
const CHANGE_TRANSITIONS: Record<ChangeStatus, ChangeStatus[]> = {
  REQUEST: ["IMPACT", "REJECTED"],
  IMPACT: ["RISK", "REJECTED"],
  RISK: ["APPROVAL", "REJECTED"],
  APPROVAL: ["IMPLEMENTATION", "REJECTED"],
  IMPLEMENTATION: ["VERIFICATION"],
  VERIFICATION: ["EFFECTIVENESS"],
  EFFECTIVENESS: ["CLOSED"],
  CLOSED: [],
  REJECTED: [],
};
export function isValidChangeTransition(from: ChangeStatus, to: ChangeStatus): boolean {
  return CHANGE_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertChangeTransition(from: string, to: string): void {
  if (!CHANGE_STATUSES.includes(from as ChangeStatus)) throw new ValidationError(`Invalid change control status: ${from}`);
  if (!CHANGE_STATUSES.includes(to as ChangeStatus)) throw new ValidationError(`Invalid change control status: ${to}`);
  if (!isValidChangeTransition(from as ChangeStatus, to as ChangeStatus)) {
    throw new StateTransitionError(`Cannot transition change control from ${from} to ${to}`);
  }
}
// D6 guard: implementation requires human approval.
export function assertChangeImplementationApproved(change: {
  approvedByUserId: string | null;
  approvedAt: Date | null;
}): void {
  if (!change.approvedByUserId || !change.approvedAt) {
    throw new StateTransitionError("Change control cannot proceed to implementation without human approval (PRD section 9: AI MUST NEVER approve a change)");
  }
}

// ---- Risk (D7/D12) ----
export function computeRpn(severity: number, probability: number): number {
  if (severity < 1 || severity > 5) throw new ValidationError("Severity must be 1-5");
  if (probability < 1 || probability > 5) throw new ValidationError("Probability must be 1-5");
  return severity * probability;
}

// ---- Polymorphic entity validation (D8) ----
export const NCR_CONCERNS_ENTITY_TYPES = ["BATCH", "DEVICE_LOT", "MATERIAL_LOT", "WORK_ORDER", "OPERATION_EXECUTION", "PRODUCT_REVISION", "MATERIAL", "SUPPLIER"] as const;
export const DEVIATION_APPLIES_TO_ENTITY_TYPES = ["ROUTING", "OPERATION", "BOM", "BOM_LINE", "BATCH", "PRODUCT_REVISION"] as const;
export const CAPA_SOURCE_TYPES = ["NCR", "INVESTIGATION", "AUDIT", "TREND", "COMPLAINT", "OTHER"] as const;
export const RISK_SUBJECT_TYPES = ["PRODUCT", "PROCESS", "EQUIPMENT", "BATCH", "DEVIATION", "CHANGE"] as const;

// ---- Zod schemas ----
export const CreateNcrSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  siteId: z.string().cuid(),
  concernsEntityType: z.enum(NCR_CONCERNS_ENTITY_TYPES),
  concernsEntityId: z.string().cuid(),
  description: z.string().min(1).max(2000),
  severity: z.enum(["MINOR", "MAJOR", "CRITICAL"]).default("MAJOR"),
});
export const NcrTransitionSchema = z.object({
  to: z.enum(NCR_STATUSES),
  reason: z.string().min(1).max(500),
  containmentAction: z.string().max(2000).optional(),
  disposition: z.enum(["USE_AS_IS", "REWORK", "REGRADE", "SCRAP", "RETURN_TO_SUPPLIER"]).optional(),
  closureNotes: z.string().max(2000).optional(),
});
export const CreateDeviationSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  siteId: z.string().cuid(),
  appliesToEntityType: z.enum(DEVIATION_APPLIES_TO_ENTITY_TYPES),
  appliesToEntityId: z.string().cuid(),
  description: z.string().min(1).max(2000),
  justification: z.string().min(1).max(2000),
  impactAssessment: z.string().max(2000).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
});
export const DeviationTransitionSchema = z.object({
  to: z.enum(DEVIATION_STATUSES),
  reason: z.string().min(1).max(500),
  impactAssessment: z.string().max(2000).optional(),
});
export const CreateInvestigationSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  siteId: z.string().cuid(),
  sourceType: z.enum(["NCR", "DEVIATION"]),
  sourceNcrId: z.string().cuid().nullish(),
  sourceDeviationId: z.string().cuid().nullish(),
  methodology: z.string().min(1).max(2000),
});
export const ConcludeInvestigationSchema = z.object({
  findings: z.string().min(1).max(5000),
  rootCause: z.string().min(1).max(2000),
  reason: z.string().min(1).max(500),
});
export const CreateCapaSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  siteId: z.string().cuid(),
  sourceType: z.enum(CAPA_SOURCE_TYPES),
  sourceId: z.string().cuid(),
  investigationId: z.string().cuid().nullish(),
  type: z.enum(["CORRECTIVE", "PREVENTIVE", "BOTH"]).default("CORRECTIVE"),
  actionPlan: z.string().min(1).max(5000),
});
export const CapaTransitionSchema = z.object({
  to: z.enum(CAPA_STATUSES),
  reason: z.string().min(1).max(500),
  effectivenessVerification: z.string().max(5000).optional(),
});
export const CreateChangeSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  siteId: z.string().cuid(),
  changeType: z.enum(["PRODUCT", "PROCESS", "DOCUMENT", "EQUIPMENT", "OTHER"]),
  description: z.string().min(1).max(2000),
  reason: z.string().min(1).max(2000),
  impactAssessment: z.string().max(2000).optional(),
});
export const ChangeTransitionSchema = z.object({
  to: z.enum(CHANGE_STATUSES),
  reason: z.string().min(1).max(500),
  impactAssessment: z.string().max(2000).optional(),
  implementationPlan: z.string().max(5000).optional(),
  verificationPlan: z.string().max(5000).optional(),
  effectivenessVerification: z.string().max(5000).optional(),
});
export const CreateRiskSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  siteId: z.string().cuid(),
  subjectType: z.enum(RISK_SUBJECT_TYPES),
  subjectId: z.string().cuid(),
  hazard: z.string().min(1).max(2000),
  severity: z.number().int().min(1).max(5),
  probability: z.number().int().min(1).max(5),
  mitigations: z.string().min(1).max(5000),
  residualRisk: z.string().max(2000).optional(),
});
export const UpdateRiskSchema = z.object({
  hazard: z.string().max(2000).optional(),
  severity: z.number().int().min(1).max(5).optional(),
  probability: z.number().int().min(1).max(5).optional(),
  mitigations: z.string().max(5000).optional(),
  residualRisk: z.string().max(2000).nullish(),
  status: z.enum(["OPEN", "MITIGATED", "CLOSED"]).optional(),
});
