// Phase 9 service: Cleanroom, Packaging, Sterilization, Batch Review.
// D2: Limits never hard-coded. D4: Sterilization release human-only.
// D5: Batch disposition human-only. D7: All site-owned. D8: AI never release.
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ConflictError, ForbiddenError, NotFoundError, StateTransitionError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import { evaluateMonitoringResult, assertExcursionTransition, assertPackagingTransition, assertSterTransition, assertBatchReviewTransition, CreateCleanroomSchema, CreateMonitoringPointSchema, CreateMonitoringResultSchema, ExcursionTransitionSchema, CreatePackagingSchema, PackagingTransitionSchema, CreateSterilizationSchema, SterTransitionSchema, SterReleaseSchema, LinkDeviceLotSchema, BatchReviewTransitionSchema, BatchDispositionSchema } from "../domain";
import type z from "zod";

// ===== CLEANROOM =====
export async function listCleanrooms(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "cleanroom.read")) throw new ForbiddenError();
  const where: any = {}; if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([db.cleanroom.findMany({ where, orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { monitoringPoints: true } } } }), db.cleanroom.count({ where })]);
  return { items, total, page, pageSize };
}
export async function createCleanroom(ctx: AuthContext, input: z.infer<typeof CreateCleanroomSchema>) {
  if (!can(ctx, "cleanroom.create", input.siteId)) throw new ForbiddenError(); assertSiteAccess(ctx, input.siteId);
  const existing = await db.cleanroom.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } }); if (existing) throw new ConflictError("Cleanroom code exists");
  const cr = await db.cleanroom.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "cleanroom.create", entityType: "Cleanroom", entityId: cr.id, newState: { code: cr.code } }); return cr;
}
export async function createMonitoringPoint(ctx: AuthContext, input: z.infer<typeof CreateMonitoringPointSchema>) {
  if (!can(ctx, "cleanroom.create")) throw new ForbiddenError();
  const cr = await db.cleanroom.findUnique({ where: { id: input.cleanroomId }, include: { site: true } }); if (!cr) throw new NotFoundError("Cleanroom");
  assertSiteAccess(ctx, cr.siteId);
  const mp = await db.monitoringPoint.create({ data: { ...input, alertLimit: parseFloat(input.alertLimit), actionLimit: parseFloat(input.actionLimit), isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "cleanroom.point.create", entityType: "MonitoringPoint", entityId: mp.id, newState: { code: mp.code, alertLimit: mp.alertLimit, actionLimit: mp.actionLimit } }); return mp;
}
export async function createMonitoringResult(ctx: AuthContext, input: z.infer<typeof CreateMonitoringResultSchema>) {
  if (!can(ctx, "cleanroom.result.create", input.siteId)) throw new ForbiddenError(); assertSiteAccess(ctx, input.siteId);
  const mp = await db.monitoringPoint.findUnique({ where: { id: input.monitoringPointId }, include: { cleanroom: true } }); if (!mp) throw new NotFoundError("MonitoringPoint");
  if (mp.cleanroom.siteId !== input.siteId) throw new ForbiddenError("Cross-site: monitoring point is at a different site");
  const value = parseFloat(input.value);
  const resultStatus = evaluateMonitoringResult(value, parseFloat(mp.alertLimit.toString()), parseFloat(mp.actionLimit.toString()));
  const existing = await db.monitoringResult.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } }); if (existing) throw new ConflictError("Result code exists");
  const mr = await db.monitoringResult.create({ data: { ...input, value, resultStatus, measuredByUserId: ctx.user.id, isDemo: false } });
  // Auto-create Excursion if exceedance
  if (resultStatus !== "NORMAL") {
    const excursion = await db.excursion.create({ data: { monitoringResultId: mr.id, cleanroomId: mp.cleanroomId, siteId: input.siteId, excursionType: resultStatus === "ACTION_EXCEEDANCE" ? "ACTION" : "ALERT", description: `${mp.parameter} = ${input.value} ${input.unit} (limit: alert=${mp.alertLimit}, action=${mp.actionLimit})`, isDemo: false } });
    await audit({ actorUserId: ctx.user.id, action: "cleanroom.excursion.create", entityType: "Excursion", entityId: excursion.id, newState: { type: excursion.excursionType, resultStatus } });
  }
  await audit({ actorUserId: ctx.user.id, action: "cleanroom.result.create", entityType: "MonitoringResult", entityId: mr.id, newState: { resultStatus, value: input.value } }); return mr;
}
export async function transitionExcursion(ctx: AuthContext, id: string, input: z.infer<typeof ExcursionTransitionSchema>) {
  if (!can(ctx, "cleanroom.excursion.transition")) throw new ForbiddenError();
  const exc = await db.excursion.findUnique({ where: { id } }); if (!exc) throw new NotFoundError("Excursion");
  assertSiteAccess(ctx, exc.siteId); assertExcursionTransition(exc.status, input.to);
  const updated = await db.excursion.update({ where: { id }, data: { status: input.to } });
  await audit({ actorUserId: ctx.user.id, action: "cleanroom.excursion.transition", entityType: "Excursion", entityId: id, previousState: { status: exc.status }, newState: { status: input.to }, reason: input.reason }); return updated;
}

// ===== PACKAGING =====
export async function listPackagingRecords(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "packaging.read")) throw new ForbiddenError();
  const where: any = {}; if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([db.packagingRecord.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { equipment: { select: { code: true, name: true } }, operator: { select: { fullName: true } } } }), db.packagingRecord.count({ where })]);
  return { items, total, page, pageSize };
}
export async function createPackagingRecord(ctx: AuthContext, input: z.infer<typeof CreatePackagingSchema>) {
  if (!can(ctx, "packaging.create", input.siteId)) throw new ForbiddenError(); assertSiteAccess(ctx, input.siteId);
  const existing = await db.packagingRecord.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } }); if (existing) throw new ConflictError("Packaging code exists");
  if (input.equipmentId) { const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } }); if (!eq || eq.siteId !== input.siteId) throw new ForbiddenError("Cross-site: equipment is at a different site"); }
  const pr = await db.packagingRecord.create({ data: { ...input, loggedByUserId: ctx.user.id, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "packaging.create", entityType: "PackagingRecord", entityId: pr.id, newState: { code: pr.code, targetEntityType: pr.targetEntityType } }); return pr;
}
export async function transitionPackaging(ctx: AuthContext, id: string, input: z.infer<typeof PackagingTransitionSchema>) {
  if (!can(ctx, "packaging.transition")) throw new ForbiddenError();
  const pr = await db.packagingRecord.findUnique({ where: { id } }); if (!pr) throw new NotFoundError("PackagingRecord");
  assertSiteAccess(ctx, pr.siteId); assertPackagingTransition(pr.status, input.to);
  const updateData: any = { status: input.to }; if (input.inspectionResult !== undefined) updateData.inspectionResult = input.inspectionResult;
  const updated = await db.packagingRecord.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "packaging.transition", entityType: "PackagingRecord", entityId: id, previousState: { status: pr.status }, newState: { status: input.to }, reason: input.reason }); return updated;
}

// ===== STERILIZATION =====
export async function listSterilizationLots(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "sterilization.read")) throw new ForbiddenError();
  const where: any = {}; if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([db.sterilizationLot.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { equipment: { select: { code: true, name: true } }, _count: { select: { deviceLots: true } } } }), db.sterilizationLot.count({ where })]);
  return { items, total, page, pageSize };
}
export async function createSterilizationLot(ctx: AuthContext, input: z.infer<typeof CreateSterilizationSchema>) {
  if (!can(ctx, "sterilization.create", input.siteId)) throw new ForbiddenError(); assertSiteAccess(ctx, input.siteId);
  const existing = await db.sterilizationLot.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } }); if (existing) throw new ConflictError("Sterilization lot code exists");
  if (input.equipmentId) { const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } }); if (!eq || eq.siteId !== input.siteId) throw new ForbiddenError("Cross-site: equipment is at a different site"); }
  const sl = await db.sterilizationLot.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "sterilization.create", entityType: "SterilizationLot", entityId: sl.id, newState: { code: sl.code, processType: sl.processType } }); return sl;
}
export async function transitionSterilization(ctx: AuthContext, id: string, input: z.infer<typeof SterTransitionSchema>) {
  if (!can(ctx, "sterilization.transition")) throw new ForbiddenError();
  const sl = await db.sterilizationLot.findUnique({ where: { id } }); if (!sl) throw new NotFoundError("SterilizationLot");
  assertSiteAccess(ctx, sl.siteId); assertSterTransition(sl.status, input.to);
  const updated = await db.sterilizationLot.update({ where: { id }, data: { status: input.to } });
  await audit({ actorUserId: ctx.user.id, action: "sterilization.transition", entityType: "SterilizationLot", entityId: id, previousState: { status: sl.status }, newState: { status: input.to }, reason: input.reason }); return updated;
}
// D4/D8: RELEASED is human-only. AI MUST NEVER release.
export async function releaseSterilizationLot(ctx: AuthContext, id: string, input: z.infer<typeof SterReleaseSchema>) {
  if (!can(ctx, "sterilization.release")) throw new ForbiddenError(); // human-only
  const sl = await db.sterilizationLot.findUnique({ where: { id } }); if (!sl) throw new NotFoundError("SterilizationLot");
  assertSiteAccess(ctx, sl.siteId);
  if (sl.status !== "COMPLETED") throw new StateTransitionError("Sterilization lot can only be released from COMPLETED status");
  const updated = await db.sterilizationLot.update({ where: { id }, data: { status: "RELEASED", releaseByUserId: ctx.user.id, releaseAt: new Date(), releaseNotes: input.releaseNotes ?? null } });
  await audit({ actorUserId: ctx.user.id, action: "sterilization.release", entityType: "SterilizationLot", entityId: id, previousState: { status: sl.status }, newState: { status: "RELEASED", releaseByUserId: ctx.user.id }, reason: "Human release authorization" }); return updated;
}
export async function linkDeviceLot(ctx: AuthContext, sterLotId: string, input: z.infer<typeof LinkDeviceLotSchema>) {
  if (!can(ctx, "sterilization.create")) throw new ForbiddenError();
  const sl = await db.sterilizationLot.findUnique({ where: { id: sterLotId } }); if (!sl) throw new NotFoundError("SterilizationLot");
  assertSiteAccess(ctx, sl.siteId);
  const dl = await db.deviceLot.findUnique({ where: { id: input.deviceLotId } }); if (!dl) throw new NotFoundError("DeviceLot");
  if (dl.siteId !== sl.siteId) throw new ForbiddenError("Cross-site: device lot is at a different site");
  await db.sterilizationLotDeviceLot.create({ data: { sterilizationLotId: sterLotId, deviceLotId: input.deviceLotId, siteId: sl.siteId } });
  await audit({ actorUserId: ctx.user.id, action: "sterilization.linkdevicelot", entityType: "SterilizationLotDeviceLot", entityId: `${sterLotId}:${input.deviceLotId}`, newState: { sterLotId, deviceLotId: input.deviceLotId } }); return { sterLotId, deviceLotId: input.deviceLotId };
}

// ===== BATCH REVIEW / RELEASE =====
export async function getBatchReviewData(ctx: AuthContext, batchId: string) {
  if (!can(ctx, "batchreview.read")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId }, include: { workOrder: { include: { productRevision: { include: { product: true } } } }, site: true, deviceLots: true, executions: true, consumptions: { include: { materialLot: { include: { material: true } } } }, scraps: true, reworks: true, batchReviewRecord: true } });
  if (!batch) throw new NotFoundError("Batch"); assertSiteAccess(ctx, batch.siteId);
  // Aggregate related quality data
  const ncrs = await db.nCR.findMany({ where: { concernsEntityType: "BATCH", concernsEntityId: batchId } });
  const inspections = await db.inspection.findMany({ where: { sourceEntityType: "BATCH", sourceEntityId: batchId } });
  const samples = await db.sample.findMany({ where: { sourceEntityType: "BATCH", sourceEntityId: batchId }, include: { testResults: true } });
  const packagingRecords = await db.packagingRecord.findMany({ where: { targetEntityType: "BATCH", targetEntityId: batchId } });
  return { batch, ncrs, inspections, samples, packagingRecords };
}
export async function transitionBatchReview(ctx: AuthContext, batchId: string, input: z.infer<typeof BatchReviewTransitionSchema>) {
  if (!can(ctx, "batchreview.transition")) throw new ForbiddenError();
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId } }); if (!batch) throw new NotFoundError("Batch");
  assertSiteAccess(ctx, batch.siteId); assertBatchReviewTransition(batch.status, input.to);
  await db.manufacturingBatch.update({ where: { id: batchId }, data: { status: input.to } });
  // Create or update BatchReviewRecord
  await db.batchReviewRecord.upsert({ where: { batchId }, update: { reviewedByUserId: ctx.user.id, reviewedAt: new Date() }, create: { batchId, siteId: batch.siteId, reviewedByUserId: ctx.user.id, reviewedAt: new Date(), isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "batchreview.transition", entityType: "ManufacturingBatch", entityId: batchId, previousState: { status: batch.status }, newState: { status: input.to }, reason: input.reason }); return { batchId, status: input.to };
}
// D5/D8: Disposition is human-only. AI MUST NEVER release product.
export async function dispositionBatch(ctx: AuthContext, batchId: string, input: z.infer<typeof BatchDispositionSchema>) {
  if (!can(ctx, "batchreview.disposition")) throw new ForbiddenError(); // human-only
  const batch = await db.manufacturingBatch.findUnique({ where: { id: batchId } }); if (!batch) throw new NotFoundError("Batch");
  assertSiteAccess(ctx, batch.siteId);
  if (batch.status !== "QA_REVIEW") throw new StateTransitionError("Batch can only be dispositioned from QA_REVIEW status");
  assertBatchReviewTransition("QA_REVIEW", input.disposition);
  await db.manufacturingBatch.update({ where: { id: batchId }, data: { status: input.disposition } });
  await db.batchReviewRecord.update({ where: { batchId }, data: { disposition: input.disposition, dispositionedByUserId: ctx.user.id, dispositionedAt: new Date(), dispositionNotes: input.dispositionNotes ?? null, reviewFindings: input.reviewFindings ?? null } });
  await audit({ actorUserId: ctx.user.id, action: "batchreview.disposition", entityType: "ManufacturingBatch", entityId: batchId, previousState: { status: "QA_REVIEW" }, newState: { status: input.disposition, dispositionedByUserId: ctx.user.id }, reason: `Human disposition: ${input.disposition}` }); return { batchId, disposition: input.disposition };
}
