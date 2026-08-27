// Phase 4 quality service layer.
// Enforces RBAC (can), audit, multi-site isolation (SiteScope), polymorphic validation (D8),
// state machines (D3-D6), CAPA closure guard (D5), Change implementation approval guard (D6).
// AI governance (PRD section 9): AI never gets approve/transition/close permissions (enforced in permissions.ts).
// Critical logic lives here, NOT in the UI (PRD section 11).
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ConflictError, ForbiddenError, NotFoundError, StateTransitionError, ValidationError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";
import {
  assertCapaClosureAllowed,
  assertCapaTransition,
  assertChangeImplementationApproved,
  assertChangeTransition,
  assertDeviationTransition,
  assertInvestigationConclude,
  assertNcrTransition,
  computeRpn,
  CreateCapaSchema,
  CreateChangeSchema,
  CreateDeviationSchema,
  CreateInvestigationSchema,
  CreateNcrSchema,
  CreateRiskSchema,
  DeviationTransitionSchema,
  NcrTransitionSchema,
  CapaTransitionSchema,
  ChangeTransitionSchema,
  ConcludeInvestigationSchema,
  UpdateRiskSchema,
} from "../domain";
import type z from "zod";

// ---- Polymorphic entity validation (D8) ----
// Validates that the referenced entity exists and is at the same site as the quality record.
async function validatePolymorphicRef(siteId: string, entityType: string, entityId: string): Promise<void> {
  const allowed = ["BATCH", "DEVICE_LOT", "MATERIAL_LOT", "WORK_ORDER", "OPERATION_EXECUTION", "PRODUCT_REVISION", "MATERIAL", "SUPPLIER", "ROUTING", "OPERATION", "BOM", "BOM_LINE"];
  if (!allowed.includes(entityType)) {
    throw new ValidationError(`Invalid entity type: ${entityType}`);
  }
  // Look up the entity and verify its site matches.
  let entitySiteId: string | null = null;
  switch (entityType) {
    case "BATCH": { const e = await db.manufacturingBatch.findUnique({ where: { id: entityId }, select: { siteId: true } }); entitySiteId = e?.siteId ?? null; break; }
    case "DEVICE_LOT": { const e = await db.deviceLot.findUnique({ where: { id: entityId }, select: { siteId: true } }); entitySiteId = e?.siteId ?? null; break; }
    case "MATERIAL_LOT": { const e = await db.materialLot.findUnique({ where: { id: entityId }, select: { siteId: true } }); entitySiteId = e?.siteId ?? null; break; }
    case "WORK_ORDER": { const e = await db.workOrder.findUnique({ where: { id: entityId }, select: { siteId: true } }); entitySiteId = e?.siteId ?? null; break; }
    case "OPERATION_EXECUTION": { const e = await db.operationExecution.findUnique({ where: { id: entityId }, include: { batch: { select: { siteId: true } } } }); entitySiteId = e?.batch.siteId ?? null; break; }
    case "PRODUCT_REVISION": { /* entity is global */ entitySiteId = siteId; break; } // global; no site check
    case "MATERIAL": { entitySiteId = siteId; break; } // global
    case "SUPPLIER": { entitySiteId = siteId; break; } // global
    case "ROUTING": { entitySiteId = siteId; break; } // global
    case "OPERATION": { entitySiteId = siteId; break; } // global
    case "BOM": { entitySiteId = siteId; break; } // global
    case "BOM_LINE": { entitySiteId = siteId; break; } // global
    default: throw new ValidationError(`Unsupported entity type: ${entityType}`);
  }
  if (entitySiteId === null) {
    throw new NotFoundError(`Referenced ${entityType} not found`);
  }
  // Cross-site quality-to-production linkage is rejected (D8).
  if (entitySiteId !== siteId) {
    throw new ForbiddenError(`Cross-site quality linkage rejected: ${entityType} is at a different site than the quality record`);
  }
}

// ===========================================================================
// NCR (D1, D3)
// ===========================================================================

export async function listNcrs(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "quality.ncr.read")) throw new ForbiddenError();
  const where: Prisma.NCRWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.nCR.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { site: { select: { code: true, name: true } } } }),
    db.nCR.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getNcr(ctx: AuthContext, id: string) {
  if (!can(ctx, "quality.ncr.read")) throw new ForbiddenError();
  const ncr = await db.nCR.findUnique({ where: { id }, include: { site: true, investigation: true, creator: { select: { id: true, name: true, email: true } } } });
  if (!ncr) throw new NotFoundError("NCR");
  assertSiteAccess(ctx, ncr.siteId);
  return ncr;
}

export async function createNcr(ctx: AuthContext, input: z.infer<typeof CreateNcrSchema>) {
  if (!can(ctx, "quality.ncr.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  await validatePolymorphicRef(input.siteId, input.concernsEntityType, input.concernsEntityId); // D8
  const existing = await db.nCR.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("NCR code already exists at this site");
  const ncr = await db.nCR.create({ data: { ...input, createdByUserId: ctx.user.id, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "quality.ncr.create", entityType: "NCR", entityId: ncr.id, newState: { code: ncr.code, concernsEntityType: ncr.concernsEntityType, concernsEntityId: ncr.concernsEntityId, severity: ncr.severity } });
  return ncr;
}

export async function transitionNcr(ctx: AuthContext, id: string, input: z.infer<typeof NcrTransitionSchema>) {
  if (!can(ctx, "quality.ncr.transition")) throw new ForbiddenError();
  const ncr = await db.nCR.findUnique({ where: { id } });
  if (!ncr) throw new NotFoundError("NCR");
  assertSiteAccess(ctx, ncr.siteId);
  assertNcrTransition(ncr.status, input.to); // D3
  const updateData: Prisma.NCRUpdateInput = { status: input.to };
  if (input.containmentAction !== undefined) updateData.containmentAction = input.containmentAction;
  if (input.disposition !== undefined) updateData.disposition = input.disposition;
  if (input.closureNotes !== undefined) updateData.closureNotes = input.closureNotes;
  if (input.to === "CLOSED") updateData.closedAt = new Date();
  const updated = await db.nCR.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "quality.ncr.transition", entityType: "NCR", entityId: id, previousState: { status: ncr.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}

// ===========================================================================
// Deviation (D1, D4)
// ===========================================================================

export async function listDeviations(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "quality.deviation.read")) throw new ForbiddenError();
  const where: Prisma.DeviationWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.deviation.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { site: { select: { code: true } } } }),
    db.deviation.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getDeviation(ctx: AuthContext, id: string) {
  if (!can(ctx, "quality.deviation.read")) throw new ForbiddenError();
  const dev = await db.deviation.findUnique({
    where: { id },
    include: { site: { select: { code: true } } },
  });
  if (!dev) throw new NotFoundError("Deviation");
  assertSiteAccess(ctx, dev.siteId);
  return dev;
}

export async function createDeviation(ctx: AuthContext, input: z.infer<typeof CreateDeviationSchema>) {
  if (!can(ctx, "quality.deviation.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  await validatePolymorphicRef(input.siteId, input.appliesToEntityType, input.appliesToEntityId); // D8
  const existing = await db.deviation.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Deviation code already exists at this site");
  const dev = await db.deviation.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "quality.deviation.create", entityType: "Deviation", entityId: dev.id, newState: { code: dev.code, appliesToEntityType: dev.appliesToEntityType, appliesToEntityId: dev.appliesToEntityId } });
  return dev;
}

export async function transitionDeviation(ctx: AuthContext, id: string, input: z.infer<typeof DeviationTransitionSchema>) {
  if (!can(ctx, "quality.deviation.transition")) throw new ForbiddenError();
  const dev = await db.deviation.findUnique({ where: { id } });
  if (!dev) throw new NotFoundError("Deviation");
  assertSiteAccess(ctx, dev.siteId);
  assertDeviationTransition(dev.status, input.to); // D4
  const updateData: Prisma.DeviationUpdateInput = { status: input.to };
  if (input.impactAssessment !== undefined) updateData.impactAssessment = input.impactAssessment;
  if (input.to === "REJECTED") { /* terminal */ }
  const updated = await db.deviation.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "quality.deviation.transition", entityType: "Deviation", entityId: id, previousState: { status: dev.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}

export async function approveDeviation(ctx: AuthContext, id: string, reason: string) {
  if (!can(ctx, "quality.deviation.approve")) throw new ForbiddenError(); // human-only (AI never gets this perm)
  const dev = await db.deviation.findUnique({ where: { id } });
  if (!dev) throw new NotFoundError("Deviation");
  assertSiteAccess(ctx, dev.siteId);
  if (dev.status !== "REVIEW") throw new StateTransitionError("Deviation can only be approved from REVIEW status");
  const updated = await db.deviation.update({ where: { id }, data: { status: "CLOSED", approvedByUserId: ctx.user.id, approvedAt: new Date() } });
  await audit({ actorUserId: ctx.user.id, action: "quality.deviation.approve", entityType: "Deviation", entityId: id, previousState: { status: dev.status }, newState: { status: "CLOSED", approvedByUserId: ctx.user.id }, reason });
  return updated;
}

// ===========================================================================
// Investigation (D2)
// ===========================================================================

export async function createInvestigation(ctx: AuthContext, input: z.infer<typeof CreateInvestigationSchema>) {
  if (!can(ctx, "quality.investigation.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  // Validate source
  if (input.sourceType === "NCR") {
    if (!input.sourceNcrId) throw new ValidationError("sourceNcrId required for NCR-sourced investigation");
    const ncr = await db.nCR.findUnique({ where: { id: input.sourceNcrId } });
    if (!ncr) throw new NotFoundError("NCR");
    assertSiteAccess(ctx, ncr.siteId);
    if (ncr.siteId !== input.siteId) throw new ForbiddenError("Cross-site investigation source rejected");
  } else if (input.sourceType === "DEVIATION") {
    if (!input.sourceDeviationId) throw new ValidationError("sourceDeviationId required for DEVIATION-sourced investigation");
    const dev = await db.deviation.findUnique({ where: { id: input.sourceDeviationId } });
    if (!dev) throw new NotFoundError("Deviation");
    assertSiteAccess(ctx, dev.siteId);
    if (dev.siteId !== input.siteId) throw new ForbiddenError("Cross-site investigation source rejected");
  }
  const existing = await db.investigation.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Investigation code already exists at this site");
  const inv = await db.investigation.create({ data: { code: input.code, siteId: input.siteId, sourceType: input.sourceType, sourceNcrId: input.sourceNcrId ?? null, sourceDeviationId: input.sourceDeviationId ?? null, methodology: input.methodology, conductedByUserId: ctx.user.id, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "quality.investigation.create", entityType: "Investigation", entityId: inv.id, newState: { code: inv.code, sourceType: inv.sourceType } });
  return inv;
}

export async function concludeInvestigation(ctx: AuthContext, id: string, input: z.infer<typeof ConcludeInvestigationSchema>) {
  if (!can(ctx, "quality.investigation.conclude")) throw new ForbiddenError(); // human-only
  const inv = await db.investigation.findUnique({ where: { id } });
  if (!inv) throw new NotFoundError("Investigation");
  assertSiteAccess(ctx, inv.siteId);
  assertInvestigationConclude(inv.status);
  const updated = await db.investigation.update({ where: { id }, data: { status: "CONCLUDED", findings: input.findings, rootCause: input.rootCause, concludedAt: new Date() } });
  await audit({ actorUserId: ctx.user.id, action: "quality.investigation.conclude", entityType: "Investigation", entityId: id, previousState: { status: inv.status }, newState: { status: "CONCLUDED", rootCause: input.rootCause }, reason: input.reason });
  return updated;
}

// ===========================================================================
// CAPA (D2 modification: polymorphic source; D5 closure guard)
// ===========================================================================

export async function listCapas(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "quality.capa.read")) throw new ForbiddenError();
  const where: Prisma.CAPAWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.cAPA.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { site: { select: { code: true } }, investigation: true } }),
    db.cAPA.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getCapa(ctx: AuthContext, id: string) {
  if (!can(ctx, "quality.capa.read")) throw new ForbiddenError();
  const capa = await db.cAPA.findUnique({
    where: { id },
    include: { site: { select: { code: true } }, investigation: { select: { code: true } } },
  });
  if (!capa) throw new NotFoundError("CAPA");
  assertSiteAccess(ctx, capa.siteId);
  return capa;
}

export async function createCapa(ctx: AuthContext, input: z.infer<typeof CreateCapaSchema>) {
  if (!can(ctx, "quality.capa.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  // Validate the polymorphic source exists (D2 modification).
  if (input.sourceType === "INVESTIGATION" || input.investigationId) {
    const invId = input.investigationId ?? input.sourceId;
    const inv = await db.investigation.findUnique({ where: { id: invId } });
    if (!inv) throw new NotFoundError("Investigation (CAPA source)");
    assertSiteAccess(ctx, inv.siteId);
    if (inv.siteId !== input.siteId) throw new ForbiddenError("Cross-site CAPA source rejected");
  }
  // For NCR-sourced CAPA without investigation, validate the NCR exists.
  if (input.sourceType === "NCR" && !input.investigationId) {
    const ncr = await db.nCR.findUnique({ where: { id: input.sourceId } });
    if (!ncr) throw new NotFoundError("NCR (CAPA source)");
    assertSiteAccess(ctx, ncr.siteId);
    if (ncr.siteId !== input.siteId) throw new ForbiddenError("Cross-site CAPA source rejected");
  }
  const existing = await db.cAPA.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("CAPA code already exists at this site");
  const capa = await db.cAPA.create({ data: { code: input.code, siteId: input.siteId, sourceType: input.sourceType, sourceId: input.sourceId, investigationId: input.investigationId ?? null, type: input.type, actionPlan: input.actionPlan, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "quality.capa.create", entityType: "CAPA", entityId: capa.id, newState: { code: capa.code, sourceType: capa.sourceType, sourceId: capa.sourceId, investigationId: capa.investigationId } });
  return capa;
}

export async function transitionCapa(ctx: AuthContext, id: string, input: z.infer<typeof CapaTransitionSchema>) {
  if (!can(ctx, "quality.capa.transition")) throw new ForbiddenError();
  const capa = await db.cAPA.findUnique({ where: { id } });
  if (!capa) throw new NotFoundError("CAPA");
  assertSiteAccess(ctx, capa.siteId);
  assertCapaTransition(capa.status, input.to); // D5
  const updateData: Prisma.CAPAUpdateInput = { status: input.to };
  if (input.effectivenessVerification !== undefined) updateData.effectivenessVerification = input.effectivenessVerification;
  if (input.to === "CLOSED") {
    // D5 guard: closure requires effectiveness verification + human verifier.
    if (input.effectivenessVerification) {
      updateData.effectivenessVerifier = { connect: { id: ctx.user.id } };
      updateData.effectivenessVerifiedAt = new Date();
      updateData.closer = { connect: { id: ctx.user.id } };
      updateData.closedAt = new Date();
    }
    // Re-check with the updated data
    const merged = { ...capa, effectivenessVerification: input.effectivenessVerification ?? capa.effectivenessVerification, effectivenessVerifiedByUserId: ctx.user.id };
    assertCapaClosureAllowed(merged); // throws if not allowed
  }
  const updated = await db.cAPA.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "quality.capa.transition", entityType: "CAPA", entityId: id, previousState: { status: capa.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}

// ===========================================================================
// Change Control (D6)
// ===========================================================================

export async function createChange(ctx: AuthContext, input: z.infer<typeof CreateChangeSchema>) {
  if (!can(ctx, "quality.change.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const existing = await db.changeControl.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Change control code already exists at this site");
  const ch = await db.changeControl.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "quality.change.create", entityType: "ChangeControl", entityId: ch.id, newState: { code: ch.code, changeType: ch.changeType } });
  return ch;
}

export async function getChange(ctx: AuthContext, id: string) {
  if (!can(ctx, "quality.change.read")) throw new ForbiddenError();
  const ch = await db.changeControl.findUnique({
    where: { id },
    include: { site: { select: { code: true } } },
  });
  if (!ch) throw new NotFoundError("ChangeControl");
  assertSiteAccess(ctx, ch.siteId);
  return ch;
}

export async function listChanges(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "quality.change.read")) throw new ForbiddenError();
  const where: Prisma.ChangeControlWhereInput = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.changeControl.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { site: { select: { code: true } } } }),
    db.changeControl.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function transitionChange(ctx: AuthContext, id: string, input: z.infer<typeof ChangeTransitionSchema>) {
  if (!can(ctx, "quality.change.transition")) throw new ForbiddenError();
  const ch = await db.changeControl.findUnique({ where: { id } });
  if (!ch) throw new NotFoundError("ChangeControl");
  assertSiteAccess(ctx, ch.siteId);
  assertChangeTransition(ch.status, input.to); // D6
  // D6 guard: implementation requires human approval.
  if (input.to === "IMPLEMENTATION") {
    assertChangeImplementationApproved(ch); // throws if not approved
  }
  const updateData: Prisma.ChangeControlUpdateInput = { status: input.to };
  if (input.impactAssessment !== undefined) updateData.impactAssessment = input.impactAssessment;
  if (input.implementationPlan !== undefined) updateData.implementationPlan = input.implementationPlan;
  if (input.verificationPlan !== undefined) updateData.verificationPlan = input.verificationPlan;
  if (input.effectivenessVerification !== undefined) updateData.effectivenessVerification = input.effectivenessVerification;
  if (input.to === "CLOSED") updateData.closedAt = new Date();
  const updated = await db.changeControl.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "quality.change.transition", entityType: "ChangeControl", entityId: id, previousState: { status: ch.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}

export async function approveChange(ctx: AuthContext, id: string, reason: string) {
  if (!can(ctx, "quality.change.approve")) throw new ForbiddenError(); // human-only (AI never gets this perm)
  const ch = await db.changeControl.findUnique({ where: { id } });
  if (!ch) throw new NotFoundError("ChangeControl");
  assertSiteAccess(ctx, ch.siteId);
  if (ch.status !== "APPROVAL") throw new StateTransitionError("Change control can only be approved from APPROVAL status");
  const updated = await db.changeControl.update({ where: { id }, data: { status: "IMPLEMENTATION", approvedByUserId: ctx.user.id, approvedAt: new Date() } });
  await audit({ actorUserId: ctx.user.id, action: "quality.change.approve", entityType: "ChangeControl", entityId: id, previousState: { status: ch.status }, newState: { status: "IMPLEMENTATION", approvedByUserId: ctx.user.id }, reason });
  return updated;
}

// ===========================================================================
// Risk Assessment (D7/D12)
// ===========================================================================

export async function createRisk(ctx: AuthContext, input: z.infer<typeof CreateRiskSchema>) {
  if (!can(ctx, "quality.risk.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const rpn = computeRpn(input.severity, input.probability); // D7
  const existing = await db.riskAssessment.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Risk assessment code already exists at this site");
  const risk = await db.riskAssessment.create({ data: { ...input, riskPriorityNumber: rpn, assessedByUserId: ctx.user.id, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "quality.risk.create", entityType: "RiskAssessment", entityId: risk.id, newState: { code: risk.code, hazard: risk.hazard, severity: risk.severity, probability: risk.probability, rpn } });
  return risk;
}

export async function updateRisk(ctx: AuthContext, id: string, input: z.infer<typeof UpdateRiskSchema>) {
  if (!can(ctx, "quality.risk.update")) throw new ForbiddenError();
  const risk = await db.riskAssessment.findUnique({ where: { id } });
  if (!risk) throw new NotFoundError("RiskAssessment");
  assertSiteAccess(ctx, risk.siteId);
  const newSeverity = input.severity ?? risk.severity;
  const newProbability = input.probability ?? risk.probability;
  const rpn = computeRpn(newSeverity, newProbability);
  const updated = await db.riskAssessment.update({ where: { id }, data: { ...input, severity: newSeverity, probability: newProbability, riskPriorityNumber: rpn } });
  await audit({ actorUserId: ctx.user.id, action: "quality.risk.update", entityType: "RiskAssessment", entityId: id, previousState: { severity: risk.severity, probability: risk.probability, rpn: risk.riskPriorityNumber }, newState: { severity: newSeverity, probability: newProbability, rpn } });
  return updated;
}
