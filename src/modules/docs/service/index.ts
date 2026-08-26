// Phase 7 docs service: ControlledDocument lifecycle.
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import { assertDocTransition, CreateDocumentSchema, DocTransitionSchema } from "../domain";
import type z from "zod";

export async function listDocuments(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "docs.document.read")) throw new ForbiddenError();
  const [items, total] = await Promise.all([
    db.controlledDocument.findMany({ orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.controlledDocument.count(),
  ]);
  return { items, total, page, pageSize };
}
export async function createDocument(ctx: AuthContext, input: z.infer<typeof CreateDocumentSchema>) {
  if (!can(ctx, "docs.document.create")) throw new ForbiddenError();
  const existing = await db.controlledDocument.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("Document code already exists");
  const doc = await db.controlledDocument.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "docs.document.create", entityType: "ControlledDocument", entityId: doc.id, newState: { code: doc.code, version: doc.version } });
  return doc;
}
export async function transitionDocument(ctx: AuthContext, id: string, input: z.infer<typeof DocTransitionSchema>) {
  if (!can(ctx, "docs.document.transition")) throw new ForbiddenError();
  const doc = await db.controlledDocument.findUnique({ where: { id } });
  if (!doc) throw new NotFoundError("ControlledDocument");
  assertDocTransition(doc.status, input.to);
  const updateData: any = { status: input.to };
  if (input.to === "APPROVED") { updateData.approvedByUserId = ctx.user.id; updateData.approvedAt = new Date(); }
  if (input.to === "EFFECTIVE") updateData.effectiveFrom = new Date();
  const updated = await db.controlledDocument.update({ where: { id }, data: updateData });
  await audit({ actorUserId: ctx.user.id, action: "docs.document.transition", entityType: "ControlledDocument", entityId: id, previousState: { status: doc.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}
