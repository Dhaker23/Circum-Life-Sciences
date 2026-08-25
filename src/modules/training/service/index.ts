// Phase 7 training service: RequiredTraining, TrainingRecord, Assessment, Competency.
// D6: Competency does NOT auto-modify RBAC.
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ConflictError, ForbiddenError, NotFoundError, StateTransitionError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import { assertTrainingTransition, CreateRequiredTrainingSchema, CreateTrainingRecordSchema, TrainingTransitionSchema, CreateAssessmentSchema, CreateCompetencySchema } from "../domain";
import type z from "zod";

export async function listRequiredTrainings(ctx: AuthContext) {
  if (!can(ctx, "training.required.read")) throw new ForbiddenError();
  return db.requiredTraining.findMany({ orderBy: { code: "asc" }, include: { document: true } });
}
export async function createRequiredTraining(ctx: AuthContext, input: z.infer<typeof CreateRequiredTrainingSchema>) {
  if (!can(ctx, "training.required.create")) throw new ForbiddenError();
  const existing = await db.requiredTraining.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("Required training code already exists");
  const rt = await db.requiredTraining.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "training.required.create", entityType: "RequiredTraining", entityId: rt.id, newState: { code: rt.code, title: rt.title } });
  return rt;
}
export async function listTrainingRecords(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "training.record.read")) throw new ForbiddenError();
  const where: any = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.trainingRecord.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { employee: true, requiredTraining: true, assessment: true } }),
    db.trainingRecord.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
export async function createTrainingRecord(ctx: AuthContext, input: z.infer<typeof CreateTrainingRecordSchema>) {
  if (!can(ctx, "training.record.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const emp = await db.employee.findUnique({ where: { id: input.employeeId } });
  if (!emp) throw new NotFoundError("Employee");
  const existing = await db.trainingRecord.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Training record code already exists at this site");
  const tr = await db.trainingRecord.create({ data: { ...input, trainedByUserId: ctx.user.id, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "training.record.create", entityType: "TrainingRecord", entityId: tr.id, newState: { code: tr.code, employeeId: tr.employeeId } });
  return tr;
}
export async function transitionTrainingRecord(ctx: AuthContext, id: string, input: z.infer<typeof TrainingTransitionSchema>) {
  if (!can(ctx, "training.record.transition")) throw new ForbiddenError();
  const tr = await db.trainingRecord.findUnique({ where: { id } });
  if (!tr) throw new NotFoundError("TrainingRecord");
  assertSiteAccess(ctx, tr.siteId);
  assertTrainingTransition(tr.status, input.to);
  const updated = await db.trainingRecord.update({ where: { id }, data: { status: input.to } });
  await audit({ actorUserId: ctx.user.id, action: "training.record.transition", entityType: "TrainingRecord", entityId: id, previousState: { status: tr.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}
export async function createAssessment(ctx: AuthContext, trainingRecordId: string, input: z.infer<typeof CreateAssessmentSchema>) {
  if (!can(ctx, "training.assessment.create")) throw new ForbiddenError();
  const tr = await db.trainingRecord.findUnique({ where: { id: trainingRecordId } });
  if (!tr) throw new NotFoundError("TrainingRecord");
  assertSiteAccess(ctx, tr.siteId);
  if (tr.status !== "COMPLETED") throw new StateTransitionError("Assessment can only be recorded for COMPLETED training");
  const existing = await db.assessment.findUnique({ where: { trainingRecordId } });
  if (existing) throw new ConflictError("Assessment already exists for this training record");
  const a = await db.assessment.create({ data: { trainingRecordId, assessedByUserId: ctx.user.id, result: input.result, score: input.score ?? null, notes: input.notes ?? null } });
  await audit({ actorUserId: ctx.user.id, action: "training.assessment.create", entityType: "Assessment", entityId: a.id, newState: { result: input.result, trainingRecordId } });
  return a;
}
export async function authorizeCompetency(ctx: AuthContext, input: z.infer<typeof CreateCompetencySchema>) {
  if (!can(ctx, "training.competency.authorize")) throw new ForbiddenError(); // D6: human-only
  const emp = await db.employee.findUnique({ where: { id: input.employeeId } });
  if (!emp) throw new NotFoundError("Employee");
  const comp = await db.competency.create({ data: { ...input, authorizedByUserId: ctx.user.id, authorizedAt: new Date(), isDemo: false } });
  // D6: NO automatic RBAC modification. Competency is a prerequisite flag, not an auto-grant.
  await audit({ actorUserId: ctx.user.id, action: "training.competency.authorize", entityType: "Competency", entityId: comp.id, newState: { employeeId: input.employeeId, competencyLevel: input.competencyLevel, authorizedByUserId: ctx.user.id } });
  return comp;
}
export async function listCompetencies(ctx: AuthContext) {
  if (!can(ctx, "training.competency.read")) throw new ForbiddenError();
  return db.competency.findMany({ orderBy: { createdAt: "desc" }, include: { employee: true, requiredTraining: true } });
}
