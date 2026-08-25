// Phase 5 laboratory domain: state machines + auto-evaluation + guards + zod.
// D1: Inspection (shop-floor) != Lab Test (formal). D3: TestMethod != Specification.
// D5 (CRITICAL): EVALUATION != DISPOSITION. Auto-eval (PASS/FAIL/NOT_EVALUABLE) does NOT auto-disposition.
// D7: Spec immutable when EFFECTIVE. D9: eval auditable. D11: sample quantity invariants.
// PRD section 5: Never invent specifications. AI must never approve specs or disposition results (section 9).
import { z } from "zod";
import { StateTransitionError, ValidationError } from "@/lib/errors";

// ---- Specification state machine (D7) ----
export const SPEC_STATUSES = ["DRAFT", "APPROVED", "EFFECTIVE", "SUPERSEDED"] as const;
export type SpecStatus = (typeof SPEC_STATUSES)[number];
const SPEC_TRANSITIONS: Record<SpecStatus, SpecStatus[]> = {
  DRAFT: ["APPROVED"],
  APPROVED: ["EFFECTIVE"],
  EFFECTIVE: ["SUPERSEDED"],
  SUPERSEDED: [],
};
export function isValidSpecTransition(from: SpecStatus, to: SpecStatus): boolean {
  return SPEC_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertSpecTransition(from: string, to: string): void {
  if (!SPEC_STATUSES.includes(from as SpecStatus)) throw new ValidationError(`Invalid spec status: ${from}`);
  if (!SPEC_STATUSES.includes(to as SpecStatus)) throw new ValidationError(`Invalid spec status: ${to}`);
  if (!isValidSpecTransition(from as SpecStatus, to as SpecStatus)) {
    throw new StateTransitionError(`Cannot transition specification from ${from} to ${to}`);
  }
}
// D7: immutable when EFFECTIVE or SUPERSEDED
export function isSpecEditable(status: string): boolean {
  return status === "DRAFT";
}
export function assertSpecEditable(status: string): void {
  if (!isSpecEditable(status)) {
    throw new StateTransitionError(`Specification is immutable in status ${status} (D7). Any change requires a new controlled version.`);
  }
}

// ---- Test Method state machine (same as Spec) ----
export const METHOD_STATUSES = SPEC_STATUSES;
export type MethodStatus = SpecStatus;
export function assertMethodTransition(from: string, to: string): void { assertSpecTransition(from, to); }
export function isMethodEditable(status: string): boolean { return isSpecEditable(status); }

// ---- Sample state machine (D4) ----
export const SAMPLE_STATUSES = ["DRAWN", "RECEIVED_IN_LAB", "IN_TEST", "CONSUMED", "RETAINED"] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];
const SAMPLE_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  DRAWN: ["RECEIVED_IN_LAB"],
  RECEIVED_IN_LAB: ["IN_TEST"],
  IN_TEST: ["CONSUMED", "RETAINED"],
  CONSUMED: [],
  RETAINED: [],
};
export function isValidSampleTransition(from: SampleStatus, to: SampleStatus): boolean {
  return SAMPLE_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertSampleTransition(from: string, to: string): void {
  if (!SAMPLE_STATUSES.includes(from as SampleStatus)) throw new ValidationError(`Invalid sample status: ${from}`);
  if (!SAMPLE_STATUSES.includes(to as SampleStatus)) throw new ValidationError(`Invalid sample status: ${to}`);
  if (!isValidSampleTransition(from as SampleStatus, to as SampleStatus)) {
    throw new StateTransitionError(`Cannot transition sample from ${from} to ${to}`);
  }
}

// ---- Test Result state machine (D5) ----
export const RESULT_STATUSES = ["SAMPLE_RECEIVED", "IN_PROGRESS", "RESULT_ENTERED", "REVIEWED", "DISPOSITIONED"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];
const RESULT_TRANSITIONS: Record<ResultStatus, ResultStatus[]> = {
  SAMPLE_RECEIVED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESULT_ENTERED"],
  RESULT_ENTERED: ["REVIEWED"],
  REVIEWED: ["DISPOSITIONED"],
  DISPOSITIONED: [],
};
export function isValidResultTransition(from: ResultStatus, to: ResultStatus): boolean {
  return RESULT_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertResultTransition(from: string, to: string): void {
  if (!RESULT_STATUSES.includes(from as ResultStatus)) throw new ValidationError(`Invalid test result status: ${from}`);
  if (!RESULT_STATUSES.includes(to as ResultStatus)) throw new ValidationError(`Invalid test result status: ${to}`);
  if (!isValidResultTransition(from as ResultStatus, to as ResultStatus)) {
    throw new StateTransitionError(`Cannot transition test result from ${from} to ${to}`);
  }
}

// ---- Inspection state machine (D6) ----
export const INSP_STATUSES = ["PENDING", "PASSED", "FAILED", "CONDITIONAL"] as const;
export type InspStatus = (typeof INSP_STATUSES)[number];
const INSP_TRANSITIONS: Record<InspStatus, InspStatus[]> = {
  PENDING: ["PASSED", "FAILED", "CONDITIONAL"],
  PASSED: [],
  FAILED: [],
  CONDITIONAL: [],
};
export function isValidInspTransition(from: InspStatus, to: InspStatus): boolean {
  return INSP_TRANSITIONS[from]?.includes(to) ?? false;
}
export function assertInspTransition(from: string, to: string): void {
  if (!INSP_STATUSES.includes(from as InspStatus)) throw new ValidationError(`Invalid inspection status: ${from}`);
  if (!INSP_STATUSES.includes(to as InspStatus)) throw new ValidationError(`Invalid inspection status: ${to}`);
  if (!isValidInspTransition(from as InspStatus, to as InspStatus)) {
    throw new StateTransitionError(`Cannot transition inspection from ${from} to ${to}`);
  }
}

// ---- D5 CRITICAL: Disposition guard (human-only) ----
export const DISPOSITIONS = ["PASS_RELEASE", "FAIL_HOLD", "FAIL_REJECT", "CONDITIONAL_RELEASE"] as const;
export function assertDispositionAllowed(result: {
  status: string;
  reviewedByUserId: string | null;
}): void {
  if (result.status !== "REVIEWED") {
    throw new StateTransitionError(`Cannot disposition a test result in status ${result.status} (must be REVIEWED first, D5)`);
  }
  if (!result.reviewedByUserId) {
    throw new StateTransitionError("Cannot disposition: human review is required before disposition (D5)");
  }
}

// ---- D9: Auto-evaluation (PASS/FAIL/NOT_EVALUABLE) — NOT disposition ----
export const EVALUATION_RESULTS = ["PASS", "FAIL", "NOT_EVALUABLE"] as const;
export type EvaluationResult = (typeof EVALUATION_RESULTS)[number];

export function evaluateAgainstSpec(
  measuredValue: string | null | undefined,
  criterionType: string,
  criterionValue: string,
): EvaluationResult {
  if (measuredValue === null || measuredValue === undefined || measuredValue.trim() === "") {
    return "NOT_EVALUABLE";
  }
  // For PASS_FAIL and TEXT_MATCH, compare strings directly (don't require numeric parsing)
  if (criterionType === "PASS_FAIL" || criterionType === "TEXT_MATCH") {
    return measuredValue.trim().toLowerCase() === criterionValue.trim().toLowerCase() ? "PASS" : "FAIL";
  }
  const value = parseFloat(measuredValue);
  if (isNaN(value)) {
    return "NOT_EVALUABLE";
  }
  switch (criterionType) {
    case "NUMERIC_MIN": {
      const min = parseFloat(criterionValue.replace(/[^\d.-]/g, ""));
      if (isNaN(min)) return "NOT_EVALUABLE";
      return value >= min ? "PASS" : "FAIL";
    }
    case "NUMERIC_MAX": {
      const max = parseFloat(criterionValue.replace(/[^\d.-]/g, ""));
      if (isNaN(max)) return "NOT_EVALUABLE";
      return value <= max ? "PASS" : "FAIL";
    }
    case "NUMERIC_RANGE": {
      const parts = criterionValue.split(/[-.]{2,}|\s*to\s*|\s*-\s*/).filter((s) => s.trim());
      if (parts.length < 2) return "NOT_EVALUABLE";
      const min = parseFloat(parts[0].replace(/[^\d.-]/g, ""));
      const max = parseFloat(parts[1].replace(/[^\d.-]/g, ""));
      if (isNaN(min) || isNaN(max)) return "NOT_EVALUABLE";
      return value >= min && value <= max ? "PASS" : "FAIL";
    }
    default:
      return "NOT_EVALUABLE";
  }
}

// ---- D11: Sample quantity invariants ----
export function assertSampleQuantityInvariant(collected: string | null, consumed: string, remaining: string | null): void {
  const c = collected ? parseFloat(collected) : null;
  const con = parseFloat(consumed);
  const rem = remaining ? parseFloat(remaining) : null;
  if (c !== null && con > c) throw new ValidationError("quantityConsumed cannot exceed quantityCollected");
  if (rem !== null && c !== null && rem > c) throw new ValidationError("quantityRemaining cannot exceed quantityCollected");
  if (c !== null && rem !== null && con > c - rem + con) throw new ValidationError("consumed + remaining cannot exceed collected");
}

// ---- Zod schemas ----
export const CreateSpecificationSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1).max(200),
  parameter: z.string().min(1).max(200),
  unit: z.string().max(50).optional(),
  criterionType: z.enum(["PASS_FAIL", "NUMERIC_RANGE", "NUMERIC_MIN", "NUMERIC_MAX", "TEXT_MATCH"]).default("PASS_FAIL"),
  criterionValue: z.string().min(1).max(500),
});
export const SpecTransitionSchema = z.object({ to: z.enum(SPEC_STATUSES), reason: z.string().min(1).max(500) });
export const CreateTestMethodSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  equipmentType: z.string().max(200).optional(),
  documentRef: z.string().max(500).optional(),
});
export const MethodTransitionSchema = z.object({ to: z.enum(METHOD_STATUSES), reason: z.string().min(1).max(500) });
export const LinkMethodSpecSchema = z.object({ specificationId: z.string().cuid() });
export const CreateSampleSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  siteId: z.string().cuid(),
  sourceEntityType: z.enum(["BATCH", "DEVICE_LOT", "MATERIAL_LOT"]),
  sourceEntityId: z.string().cuid(),
  quantityCollected: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  unit: z.string().max(20).optional(),
});
export const SampleTransitionSchema = z.object({ to: z.enum(SAMPLE_STATUSES), reason: z.string().min(1).max(500) });
export const CreateTestResultSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  siteId: z.string().cuid(),
  sampleId: z.string().cuid(),
  testMethodId: z.string().cuid().nullish(),
  specificationId: z.string().cuid(),
});
export const ResultTransitionSchema = z.object({
  to: z.enum(RESULT_STATUSES),
  reason: z.string().min(1).max(500),
  measuredValue: z.string().max(500).optional(),
  unit: z.string().max(20).optional(),
});
export const DispositionSchema = z.object({
  disposition: z.enum(DISPOSITIONS),
  reason: z.string().min(1).max(500),
  dispositionNotes: z.string().max(2000).optional(),
  ncrId: z.string().cuid().optional(),
});
export const CreateInspectionSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  siteId: z.string().cuid(),
  inspectionType: z.enum(["IN_PROCESS", "FINAL", "RECEIVING"]).default("IN_PROCESS"),
  sourceEntityType: z.enum(["BATCH", "DEVICE_LOT", "MATERIAL_LOT", "OPERATION_EXECUTION"]),
  sourceEntityId: z.string().cuid(),
  specificationId: z.string().cuid().optional(),
  inspectorEmployeeId: z.string().cuid().optional(),
  measuredValue: z.string().max(500).optional(),
  unit: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});
export const InspectionTransitionSchema = z.object({
  to: z.enum(INSP_STATUSES),
  reason: z.string().min(1).max(500),
});
