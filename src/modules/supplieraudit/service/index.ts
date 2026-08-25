// Phase 7 supplier audit service: SupplierAudit lifecycle.
// D7: Qualification impact is informational; NO auto-change to Supplier.qualificationStatus.
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import { assertAuditTransition, CreateSupplierAuditSchema, AuditTransitionSchema } from "../domain";
import type z from "zod";

export async function listSupplierAudits(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "supplieraudit.read")) throw new ForbiddenError();
  const where: any = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([
    db.supplierAudit.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { supplier: true, site: { select: { code: true } }, capa: true } }),
    db.supplierAudit.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
export async function createSupplierAudit(ctx: AuthContext, input: z.infer<typeof CreateSupplierAuditSchema>) {
  if (!can(ctx, "supplieraudit.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw new NotFoundError("Supplier");
  const existing = await db.supplierAudit.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } });
  if (existing) throw new ConflictError("Supplier audit code already exists at this site");
  const sa = await db.supplierAudit.create({ data: { ...input, auditorUserId: ctx.user.id, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "supplieraudit.create", entityType: "SupplierAudit", entityId: sa.id, newState: { code: sa.code, supplierId: input.supplierId, auditType: input.auditType } });
  return sa;
}
export async function transitionSupplierAudit(ctx: AuthContext, id: string, input: z.infer<typeof AuditTransitionSchema>) {
  if (!can(ctx, "supplieraudit.transition")) throw new ForbiddenError();
  const sa = await db.supplierAudit.findUnique({ where: { id } });
  if (!sa) throw new NotFoundError("SupplierAudit");
  assertSiteAccess(ctx, sa.siteId);
  assertAuditTransition(sa.status, input.to);
  const updateData: any = { status: input.to };
  if (input.findings !== undefined) updateData.findings = input.findings;
  if (input.result !== undefined) updateData.result = input.result;
  if (input.qualificationImpact !== undefined) updateData.qualificationImpact = input.qualificationImpact;
  if (input.capaId !== undefined) updateData.capaId = input.capaId;
  if (input.to === "COMPLETED") updateData.completedDate = new Date();
  // D7: qualificationImpact is informational only. We do NOT auto-change Supplier.qualificationStatus.
  // A human must change the supplier's qualification via a controlled action.
  const updated = await db.supplierAudit.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "supplieraudit.transition", entityType: "SupplierAudit", entityId: id, previousState: { status: sa.status }, newState: { status: input.to, qualificationImpact: input.qualificationImpact ?? sa.qualificationImpact }, reason: input.reason });
  return updated;
}
