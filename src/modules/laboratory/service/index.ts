// Phase 5 laboratory service layer.
// D5 CRITICAL: evaluation != disposition. Auto-eval on RESULT_ENTERED; disposition is human-only.
// D7: Spec immutable when EFFECTIVE. D8: polymorphic validation. D9: eval auditable.
// PRD section 5: Never invent specifications. AI must never approve specs or disposition results.
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ConflictError, ForbiddenError, NotFoundError, StateTransitionError, ValidationError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";
import {
  assertDispositionAllowed,
  assertInspTransition,
  assertMethodTransition,
  assertResultTransition,
  assertSampleTransition,
  assertSpecTransition,
  evaluateAgainstSpec,
  CreateInspectionSchema,
  CreateSampleSchema,
  CreateSpecificationSchema,
  CreateTestMethodSchema,
  CreateTestResultSchema,
  DispositionSchema,
  InspectionTransitionSchema,
  LinkMethodSpecSchema,
  MethodTransitionSchema,
  ResultTransitionSchema,
  SampleTransitionSchema,
  SpecTransitionSchema,
} from "../domain";
import type z from "zod";

// ---- Polymorphic validation (D8, same pattern as Phase 4) ----
async function validatePolymorphicRef(siteId: string, entityType: string, entityId: string): Promise<void> {
  let entitySiteId: string | null = null;
  switch (entityType) {
    case "BATCH": { const e = await db.manufacturingBatch.findUnique({ where: { id: entityId }, select: { siteId: true } }); entitySiteId = e?.siteId ?? null; break; }
    case "DEVICE_LOT": { const e = await db.deviceLot.findUnique({ where: { id: entityId }, select: { siteId: true } }); entitySiteId = e?.siteId ?? null; break; }
    case "MATERIAL_LOT": { const e = await db.materialLot.findUnique({ where: { id: entityId }, select: { siteId: true } }); entitySiteId = e?.siteId ?? null; break; }
    case "WORK_ORDER": { const e = await db.workOrder.findUnique({ where: { id: entityId }, select: { siteId: true } }); entitySiteId = e?.siteId ?? null; break; }
    case "OPERATION_EXECUTION": { const e = await db.operationExecution.findUnique({ where: { id: entityId }, include: { batch: { select: { siteId: true } } } }); entitySiteId = e?.batch.siteId ?? null; break; }
    default: throw new ValidationError(`Unsupported entity type: ${entityType}`);
  }
  if (entitySiteId === null) throw new NotFoundError(`Referenced ${entityType} not found`);
  if (entitySiteId !== siteId) throw new ForbiddenError(`Cross-site reference rejected: ${entityType} is at a different site`);
}

// ===========================================================================
// Specification (global, D7)
// ===========================================================================
export async function listSpecifications(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "lab.specification.read")) throw new ForbiddenError();
  const [items, total] = await Promise.all([
    db.specification.findMany({ orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.specification.count(),
  ]);
  return { items, total, page, pageSize };
}
export async function createSpecification(ctx: AuthContext, input: z.infer<typeof CreateSpecificationSchema>) {
  if (!can(ctx, "lab.specification.create")) throw new ForbiddenError();
  const existing = await db.specification.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("Specification code already exists");
  const spec = await db.specification.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "lab.specification.create", entityType: "Specification", entityId: spec.id, newState: { code: spec.code, parameter: spec.parameter, criterionType: spec.criterionType, criterionValue: spec.criterionValue } });
  return spec;
}
export async function transitionSpecification(ctx: AuthContext, id: string, input: z.infer<typeof SpecTransitionSchema>) {
  if (!can(ctx, "lab.specification.transition")) throw new ForbiddenError();
  const spec = await db.specification.findUnique({ where: { id } });
  if (!spec) throw new NotFoundError("Specification");
  assertSpecTransition(spec.status, input.to); // D7
  const updateData: Prisma.SpecificationUpdateInput = { status: input.to };
  if (input.to === "APPROVED") { updateData.approver = { connect: { id: ctx.user.id } }; updateData.approvedAt = new Date(); }
  if (input.to === "EFFECTIVE") updateData.effectiveFrom = new Date();
  const updated = await db.specification.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "lab.specification.transition", entityType: "Specification", entityId: id, previousState: { status: spec.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}
// D7: human-only approval (separate endpoint for explicit human authorization)
export async function approveSpecification(ctx: AuthContext, id: string, reason: string) {
  if (!can(ctx, "lab.specification.approve")) throw new ForbiddenError(); // human-only (AI MUST NEVER approve a spec)
  const spec = await db.specification.findUnique({ where: { id } });
  if (!spec) throw new NotFoundError("Specification");
  if (spec.status !== "DRAFT") throw new StateTransitionError("Specification can only be approved from DRAFT status");
  const updated = await db.specification.update({ where: { id }, data: { status: "APPROVED", approver: { connect: { id: ctx.user.id } }, approvedAt: new Date() } });
  await audit({ actorUserId: ctx.user.id, action: "lab.specification.approve", entityType: "Specification", entityId: id, previousState: { status: spec.status }, newState: { status: "APPROVED", approvedByUserId: ctx.user.id }, reason });
  return updated;
}

// ===========================================================================
// Test Method (global)
// ===========================================================================
export async function listTestMethods(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "lab.testmethod.read")) throw new ForbiddenError();
  const [items, total] = await Promise.all([
    db.testMethod.findMany({ orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { specs: { include: { specification: true } } } }),
    db.testMethod.count(),
  ]);
  return { items, total, page, pageSize };
}
export async function createTestMethod(ctx: AuthContext, input: z.infer<typeof CreateTestMethodSchema>) {
  if (!can(ctx, "lab.testmethod.create")) throw new ForbiddenError();
  const existing = await db.testMethod.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("Test method code already exists");
  const method = await db.testMethod.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "lab.testmethod.create", entityType: "TestMethod", entityId: method.id, newState: { code: method.code, name: method.name } });
  return method;
}
export async function transitionTestMethod(ctx: AuthContext, id: string, input: z.infer<typeof MethodTransitionSchema>) {
  if (!can(ctx, "lab.testmethod.transition")) throw new ForbiddenError();
  const method = await db.testMethod.findUnique({ where: { id } });
  if (!method) throw new NotFoundError("TestMethod");
  assertMethodTransition(method.status, input.to);
  const updated = await db.testMethod.update({ where: { id }, data: { status: input.to } });
  await audit({ actorUserId: ctx.user.id, action: "lab.testmethod.transition", entityType: "TestMethod", entityId: id, previousState: { status: method.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}
export async function linkMethodSpec(ctx: AuthContext, methodId: string, input: z.infer<typeof LinkMethodSpecSchema>) {
  if (!can(ctx, "lab.testmethod.create")) throw new ForbiddenError();
  const method = await db.testMethod.findUnique({ where: { id: methodId } });
  if (!method) throw new NotFoundError("TestMethod");
  const spec = await db.specification.findUnique({ where: { id: input.specificationId } });
  if (!spec) throw new NotFoundError("Specification");
  await db.testMethodSpec.upsert({ where: { testMethodId_specificationId: { testMethodId: methodId, specificationId: input.specificationId } }, update: {}, create: { testMethodId: methodId, specificationId: input.specificationId } });
  await audit({ actorUserId: ctx.user.id, action: "lab.testmethod.linkspec", entityType: "TestMethodSpec", entityId: `${methodId}:${input.specificationId}`, newState: { methodCode: method.code, specCode: spec.code }, reason: "Linked method to specification" });
  return { methodId, specificationId: input.specificationId };
}

// ===========================================================================
// Sample (site-owned, D4, D11)
// ===========================================================================
export async function listSamples(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "lab.sample.read")) throw new ForbiddenError();
  const where: Prisma.SampleWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.sample.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { site: { select: { code: true } }, _count: { select: { testResults: true } } } }),
    db.sample.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
export async function createSample(ctx: AuthContext, input: z.infer<typeof CreateSampleSchema>) {
  if (!can(ctx, "lab.sample.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  await validatePolymorphicRef(input.siteId, input.sourceEntityType, input.sourceEntityId); // D8
  const existing = await db.sample.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Sample code already exists at this site");
  const sample = await db.sample.create({ data: { ...input, quantityRemaining: input.quantityCollected ?? null, drawnByUserId: ctx.user.id, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "lab.sample.create", entityType: "Sample", entityId: sample.id, newState: { code: sample.code, sourceEntityType: sample.sourceEntityType, sourceEntityId: sample.sourceEntityId } });
  return sample;
}
export async function transitionSample(ctx: AuthContext, id: string, input: z.infer<typeof SampleTransitionSchema>) {
  if (!can(ctx, "lab.sample.transition")) throw new ForbiddenError();
  const sample = await db.sample.findUnique({ where: { id } });
  if (!sample) throw new NotFoundError("Sample");
  assertSiteAccess(ctx, sample.siteId);
  assertSampleTransition(sample.status, input.to); // D4
  const updated = await db.sample.update({ where: { id }, data: { status: input.to } });
  await audit({ actorUserId: ctx.user.id, action: "lab.sample.transition", entityType: "Sample", entityId: id, previousState: { status: sample.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}

// ===========================================================================
// Test Result (site-owned, D5: eval != disposition)
// ===========================================================================
export async function listTestResults(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "lab.testresult.read")) throw new ForbiddenError();
  const where: Prisma.TestResultWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.testResult.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { sample: true, specification: true, testMethod: true, ncr: true } }),
    db.testResult.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
export async function createTestResult(ctx: AuthContext, input: z.infer<typeof CreateTestResultSchema>) {
  if (!can(ctx, "lab.testresult.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const sample = await db.sample.findUnique({ where: { id: input.sampleId } });
  if (!sample) throw new NotFoundError("Sample");
  assertSiteAccess(ctx, sample.siteId);
  if (sample.siteId !== input.siteId) throw new ForbiddenError("Cross-site: sample is at a different site");
  const spec = await db.specification.findUnique({ where: { id: input.specificationId } });
  if (!spec) throw new NotFoundError("Specification");
  if (spec.status !== "EFFECTIVE") throw new StateTransitionError("Only EFFECTIVE specifications can be referenced by test results (D7)");
  if (input.testMethodId) {
    const method = await db.testMethod.findUnique({ where: { id: input.testMethodId } });
    if (!method) throw new NotFoundError("TestMethod");
    if (method.status !== "EFFECTIVE") throw new StateTransitionError("Only EFFECTIVE test methods can be referenced");
  }
  const existing = await db.testResult.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Test result code already exists at this site");
  // D9: preserve exact specification reference (the spec ID is stored, not a copy — the spec is immutable when EFFECTIVE)
  const result = await db.testResult.create({ data: { ...input, specificationId: input.specificationId, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "lab.testresult.create", entityType: "TestResult", entityId: result.id, newState: { code: result.code, sampleId: result.sampleId, specificationId: input.specificationId, testMethodId: input.testMethodId ?? null } });
  return result;
}
export async function transitionTestResult(ctx: AuthContext, id: string, input: z.infer<typeof ResultTransitionSchema>) {
  if (!can(ctx, "lab.testresult.transition")) throw new ForbiddenError();
  const result = await db.testResult.findUnique({ where: { id }, include: { specification: true } });
  if (!result) throw new NotFoundError("TestResult");
  assertSiteAccess(ctx, result.siteId);
  assertResultTransition(result.status, input.to); // D5
  const updateData: Prisma.TestResultUpdateInput = { status: input.to };
  // D5/D9: on RESULT_ENTERED, auto-evaluate against spec (but do NOT disposition)
  if (input.to === "RESULT_ENTERED") {
    if (input.measuredValue !== undefined) updateData.measuredValue = input.measuredValue;
    if (input.unit !== undefined) updateData.unit = input.unit;
    updateData.performedBy = { connect: { id: ctx.user.id } };
    updateData.performedAt = new Date();
    // D9: auto-evaluate (PASS/FAIL/NOT_EVALUABLE) — this is NOT disposition
    const evaluated = evaluateAgainstSpec(input.measuredValue ?? result.measuredValue, result.specification.criterionType, result.specification.criterionValue);
    updateData.evaluatedResult = evaluated;
    updateData.evaluatedAt = new Date();
    updateData.evaluationLogic = `auto-eval-v1: criterionType=${result.specification.criterionType}, criterionValue=${result.specification.criterionValue}`;
  }
  if (input.to === "REVIEWED") {
    updateData.reviewedBy = { connect: { id: ctx.user.id } };
    updateData.reviewedAt = new Date();
  }
  const updated = await db.testResult.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "lab.testresult.transition", entityType: "TestResult", entityId: id, previousState: { status: result.status }, newState: { status: input.to, evaluatedResult: updateData.evaluatedResult ?? null }, reason: input.reason });
  return updated;
}
// D5: human-only disposition (AI MUST NEVER disposition)
export async function dispositionTestResult(ctx: AuthContext, id: string, input: z.infer<typeof DispositionSchema>) {
  if (!can(ctx, "lab.testresult.disposition")) throw new ForbiddenError(); // human-only
  const result = await db.testResult.findUnique({ where: { id } });
  if (!result) throw new NotFoundError("TestResult");
  assertSiteAccess(ctx, result.siteId);
  assertDispositionAllowed(result); // D5: must be REVIEWED + human review done
  const updateData: Prisma.TestResultUpdateInput = { status: "DISPOSITIONED", disposition: input.disposition, dispositionedBy: { connect: { id: ctx.user.id } }, dispositionedAt: new Date(), dispositionNotes: input.dispositionNotes ?? null };
  if (input.ncrId) updateData.ncr = { connect: { id: input.ncrId } };
  const updated = await db.testResult.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "lab.testresult.disposition", entityType: "TestResult", entityId: id, previousState: { status: result.status }, newState: { status: "DISPOSITIONED", disposition: input.disposition, dispositionedByUserId: ctx.user.id }, reason: input.reason });
  return updated;
}

// ===========================================================================
// Inspection (site-owned, D6: simple)
// ===========================================================================
export async function listInspections(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "inspection.read")) throw new ForbiddenError();
  const where: Prisma.InspectionWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.inspection.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { specification: true, ncr: true } }),
    db.inspection.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
export async function createInspection(ctx: AuthContext, input: z.infer<typeof CreateInspectionSchema>) {
  if (!can(ctx, "inspection.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  await validatePolymorphicRef(input.siteId, input.sourceEntityType, input.sourceEntityId); // D8
  if (input.specificationId) {
    const spec = await db.specification.findUnique({ where: { id: input.specificationId } });
    if (!spec) throw new NotFoundError("Specification");
    if (spec.status !== "EFFECTIVE") throw new StateTransitionError("Only EFFECTIVE specifications can be referenced by inspections (D10)");
  }
  const existing = await db.inspection.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Inspection code already exists at this site");
  // D9: auto-evaluate if spec present + measured value provided
  let evaluatedResult: string | null = null;
  if (input.specificationId && input.measuredValue) {
    const spec = await db.specification.findUniqueOrThrow({ where: { id: input.specificationId } });
    evaluatedResult = evaluateAgainstSpec(input.measuredValue, spec.criterionType, spec.criterionValue);
  }
  const insp = await db.inspection.create({ data: { ...input, loggedByUserId: ctx.user.id, evaluatedResult, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "inspection.create", entityType: "Inspection", entityId: insp.id, newState: { code: insp.code, inspectionType: insp.inspectionType, evaluatedResult } });
  return insp;
}
export async function transitionInspection(ctx: AuthContext, id: string, input: z.infer<typeof InspectionTransitionSchema>) {
  if (!can(ctx, "inspection.transition")) throw new ForbiddenError();
  const insp = await db.inspection.findUnique({ where: { id } });
  if (!insp) throw new NotFoundError("Inspection");
  assertSiteAccess(ctx, insp.siteId);
  assertInspTransition(insp.status, input.to); // D6
  const updated = await db.inspection.update({ where: { id }, data: { status: input.to } });
  await audit({ actorUserId: ctx.user.id, action: "inspection.transition", entityType: "Inspection", entityId: id, previousState: { status: insp.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}
