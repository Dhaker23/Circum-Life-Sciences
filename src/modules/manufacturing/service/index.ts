// Phase 2 manufacturing service layer.
// Enforces RBAC (can), audit, multi-site isolation (SiteScope for MaterialLot),
// BOM immutability (D2), MaterialLot lifecycle (D3), supplier qualification (D5).
// Critical logic lives here, NOT in the UI (PRD section 11).
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import {
  assertBomEditable,
  assertLotTransition,
  assertQuantityInvariant,
  assertRevisionTransition,
  assertSupplierQualified,
  CreateBOMLineSchema,
  CreateMaterialLotSchema,
  CreateMaterialSchema,
  CreateProductRevisionSchema,
  CreateProductSchema,
  CreateSupplierSchema,
  LinkMaterialSupplierSchema,
  MaterialLotTransitionSchema,
  RevisionTransitionSchema,
  UpdateBOMLineSchema,
  UpdateMaterialLotSchema,
  UpdateMaterialSchema,
  UpdateProductSchema,
  UpdateSupplierSchema,
} from "../domain";
import type { Prisma } from "@prisma/client";

// ===========================================================================
// Products (global)
// ===========================================================================

export async function listProducts(ctx: AuthContext, page: number, pageSize: number, filters?: { productType?: string; status?: string }) {
  if (!can(ctx, "manufacturing.product.read")) throw new ForbiddenError();
  const where: Prisma.ProductWhereInput = {};
  if (filters?.productType) where.productType = filters.productType;
  if (filters?.status) where.status = filters.status;
  const [items, total] = await Promise.all([
    db.product.findMany({ where, orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { revisions: true } } } }),
    db.product.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getProduct(ctx: AuthContext, id: string) {
  if (!can(ctx, "manufacturing.product.read")) throw new ForbiddenError();
  const product = await db.product.findUnique({ where: { id }, include: { revisions: { orderBy: { revisionCode: "asc" } } } });
  if (!product) throw new NotFoundError("Product");
  return product;
}

export async function createProduct(ctx: AuthContext, input: z.infer<typeof CreateProductSchema>) {
  if (!can(ctx, "manufacturing.product.create")) throw new ForbiddenError();
  const existing = await db.product.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("Product code already exists");
  const product = await db.product.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.product.create", entityType: "Product", entityId: product.id, newState: { code: product.code, name: product.name } });
  return product;
}

export async function updateProduct(ctx: AuthContext, id: string, input: z.infer<typeof UpdateProductSchema>) {
  if (!can(ctx, "manufacturing.product.update")) throw new ForbiddenError();
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Product");
  const updated = await db.product.update({ where: { id }, data: input });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.product.update", entityType: "Product", entityId: id, previousState: { name: existing.name, status: existing.status }, newState: { name: updated.name, status: updated.status } });
  return updated;
}

// ===========================================================================
// Product Revisions (global) + BOM (1:1, D2)
// ===========================================================================

export async function listRevisions(ctx: AuthContext, productId: string) {
  if (!can(ctx, "manufacturing.revision.read")) throw new ForbiddenError();
  return db.productRevision.findMany({ where: { productId }, orderBy: { revisionCode: "asc" }, include: { bom: { include: { lines: { include: { material: true } } } } } });
}

export async function getRevision(ctx: AuthContext, id: string) {
  if (!can(ctx, "manufacturing.revision.read")) throw new ForbiddenError();
  const rev = await db.productRevision.findUnique({ where: { id }, include: { product: true, bom: { include: { lines: { include: { material: true, substituteMaterial: true } } } }, supersededBy: true } });
  if (!rev) throw new NotFoundError("ProductRevision");
  return rev;
}

export async function createRevision(ctx: AuthContext, productId: string, input: z.infer<typeof CreateProductRevisionSchema>) {
  if (!can(ctx, "manufacturing.revision.create")) throw new ForbiddenError();
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Product");
  const existing = await db.productRevision.findUnique({ where: { productId_revisionCode: { productId, revisionCode: input.revisionCode } } });
  if (existing) throw new ConflictError("Revision code already exists for this product");
  const rev = await db.$transaction(async (tx) => {
    const r = await tx.productRevision.create({ data: { productId, revisionCode: input.revisionCode, description: input.description, isDemo: false } });
    // Create the 1:1 BOM (D2) in DRAFT status.
    await tx.bOM.create({ data: { productRevisionId: r.id, status: "DRAFT" } });
    return r;
  });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.revision.create", entityType: "ProductRevision", entityId: rev.id, newState: { productId, revisionCode: rev.revisionCode } });
  return rev;
}

export async function transitionRevision(ctx: AuthContext, id: string, input: z.infer<typeof RevisionTransitionSchema>) {
  if (!can(ctx, "manufacturing.revision.transition")) throw new ForbiddenError();
  const rev = await db.productRevision.findUnique({ where: { id } });
  if (!rev) throw new NotFoundError("ProductRevision");
  assertRevisionTransition(rev.status, input.to);

  // Enforce: only one EFFECTIVE revision per product at a time. Becoming EFFECTIVE supersedes the previous effective.
  let supersededId: string | null = null;
  if (input.to === "EFFECTIVE") {
    const prevEffective = await db.productRevision.findFirst({ where: { productId: rev.productId, status: "EFFECTIVE", id: { not: id } } });
    if (prevEffective) {
      supersededId = prevEffective.id;
    }
  }

  const updated = await db.$transaction(async (tx) => {
    if (supersededId) {
      await tx.productRevision.update({ where: { id: supersededId }, data: { status: "SUPERSEDED" } });
      await tx.bOM.updateMany({ where: { productRevisionId: supersededId }, data: { status: "SUPERSEDED" } });
    }
    const effectiveFrom = input.to === "EFFECTIVE" ? new Date() : (input.to === "SUPERSEDED" || input.to === "OBSOLETE" ? rev.effectiveFrom : null);
    const r = await tx.productRevision.update({ where: { id }, data: { status: input.to, effectiveFrom, supersededById: supersededId } });
    // Sync BOM status with revision status.
    await tx.bOM.updateMany({ where: { productRevisionId: id }, data: { status: input.to } });
    return r;
  });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.revision.transition", entityType: "ProductRevision", entityId: id, previousState: { status: rev.status }, newState: { status: input.to, supersededId }, reason: input.reason });
  return updated;
}

// ---- BOM lines (D2: editable only in DRAFT/IN_REVIEW) ----

export async function getBom(ctx: AuthContext, revisionId: string) {
  if (!can(ctx, "manufacturing.bom.read")) throw new ForbiddenError();
  const bom = await db.bOM.findUnique({ where: { productRevisionId: revisionId }, include: { lines: { include: { material: true, substituteMaterial: true }, orderBy: { sequence: "asc" } } } });
  if (!bom) throw new NotFoundError("BOM");
  return bom;
}

export async function addBomLine(ctx: AuthContext, revisionId: string, input: z.infer<typeof CreateBOMLineSchema>) {
  if (!can(ctx, "manufacturing.bom.update")) throw new ForbiddenError();
  const rev = await db.productRevision.findUnique({ where: { id: revisionId }, include: { bom: true } });
  if (!rev) throw new NotFoundError("ProductRevision");
  if (!rev.bom) throw new NotFoundError("BOM");
  assertBomEditable(rev.status); // D2: frozen when APPROVED+
  const material = await db.material.findUnique({ where: { id: input.materialId } });
  if (!material) throw new NotFoundError("Material");
  if (input.substituteMaterialId && input.substituteMaterialId === input.materialId) {
    throw new ValidationError("Substitute material cannot be the same as the primary material");
  }
  try {
    const line = await db.bOMLine.create({ data: { bomId: rev.bom.id, ...input } });
    await audit({ actorUserId: ctx.user.id, action: "manufacturing.bom.line.add", entityType: "BOMLine", entityId: line.id, newState: { materialId: input.materialId, quantity: input.quantity }, reason: `Revision ${rev.revisionCode} (DRAFT/IN_REVIEW)` });
    return line;
  } catch {
    throw new ConflictError("Material already exists in this BOM");
  }
}

export async function updateBomLine(ctx: AuthContext, lineId: string, input: z.infer<typeof UpdateBOMLineSchema>) {
  if (!can(ctx, "manufacturing.bom.update")) throw new ForbiddenError();
  const line = await db.bOMLine.findUnique({ where: { id: lineId }, include: { bom: { include: { productRevision: true } } } });
  if (!line) throw new NotFoundError("BOMLine");
  assertBomEditable(line.bom.productRevision.status); // D2
  const updated = await db.bOMLine.update({ where: { id: lineId }, data: input });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.bom.line.update", entityType: "BOMLine", entityId: lineId, previousState: { quantity: line.quantity, unit: line.unit }, newState: { quantity: updated.quantity, unit: updated.unit }, reason: `Revision ${line.bom.productRevision.revisionCode} (DRAFT/IN_REVIEW)` });
  return updated;
}

export async function deleteBomLine(ctx: AuthContext, lineId: string) {
  if (!can(ctx, "manufacturing.bom.update")) throw new ForbiddenError();
  const line = await db.bOMLine.findUnique({ where: { id: lineId }, include: { bom: { include: { productRevision: true } } } });
  if (!line) throw new NotFoundError("BOMLine");
  assertBomEditable(line.bom.productRevision.status); // D2
  await db.bOMLine.delete({ where: { id: lineId } });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.bom.line.delete", entityType: "BOMLine", entityId: lineId, previousState: { materialId: line.materialId }, reason: `Revision ${line.bom.productRevision.revisionCode} (DRAFT/IN_REVIEW)` });
  return { id: lineId };
}

// ===========================================================================
// Materials (global)
// ===========================================================================

export async function listMaterials(ctx: AuthContext, page: number, pageSize: number, filters?: { materialType?: string; status?: string }) {
  if (!can(ctx, "manufacturing.material.read")) throw new ForbiddenError();
  const where: Prisma.MaterialWhereInput = {};
  if (filters?.materialType) where.materialType = filters.materialType;
  if (filters?.status) where.status = filters.status;
  const [items, total] = await Promise.all([
    db.material.findMany({ where, orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { lots: true } } } }),
    db.material.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getMaterial(ctx: AuthContext, id: string) {
  if (!can(ctx, "manufacturing.material.read")) throw new ForbiddenError();
  const m = await db.material.findUnique({ where: { id }, include: { suppliers: { include: { supplier: true } } } });
  if (!m) throw new NotFoundError("Material");
  return m;
}

export async function createMaterial(ctx: AuthContext, input: z.infer<typeof CreateMaterialSchema>) {
  if (!can(ctx, "manufacturing.material.create")) throw new ForbiddenError();
  const existing = await db.material.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("Material code already exists");
  const material = await db.material.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.material.create", entityType: "Material", entityId: material.id, newState: { code: material.code, name: material.name } });
  return material;
}

export async function updateMaterial(ctx: AuthContext, id: string, input: z.infer<typeof UpdateMaterialSchema>) {
  if (!can(ctx, "manufacturing.material.update")) throw new ForbiddenError();
  const existing = await db.material.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Material");
  const updated = await db.material.update({ where: { id }, data: input });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.material.update", entityType: "Material", entityId: id, previousState: { name: existing.name, status: existing.status }, newState: { name: updated.name, status: updated.status } });
  return updated;
}

export async function linkMaterialSupplier(ctx: AuthContext, materialId: string, input: z.infer<typeof LinkMaterialSupplierSchema>) {
  if (!can(ctx, "manufacturing.materialsupplier.update")) throw new ForbiddenError();
  const material = await db.material.findUnique({ where: { id: materialId } });
  if (!material) throw new NotFoundError("Material");
  const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw new NotFoundError("Supplier");
  await db.materialSupplier.upsert({
    where: { materialId_supplierId: { materialId, supplierId: input.supplierId } },
    update: { isPreferred: input.isPreferred, supplierPartCode: input.supplierPartCode },
    create: { materialId, supplierId: input.supplierId, isPreferred: input.isPreferred, supplierPartCode: input.supplierPartCode },
  });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.materialsupplier.link", entityType: "MaterialSupplier", entityId: `${materialId}:${input.supplierId}`, newState: { isPreferred: input.isPreferred }, reason: `Linked ${material.code} <-> ${supplier.code}` });
  return { materialId, supplierId: input.supplierId };
}

// ===========================================================================
// Material Lots (SITE-OWNED, D3 lifecycle, D4 isolation, D5 supplier qualification)
// ===========================================================================

export async function listMaterialLots(ctx: AuthContext, page: number, pageSize: number, filters?: { materialId?: string; status?: string; siteId?: string }) {
  if (!can(ctx, "manufacturing.materiallot.read")) throw new ForbiddenError();
  // SITE-SCOPED (D4): non-global users see only their sites' lots.
  const where: Prisma.MaterialLotWhereInput = {};
  if (ctx.resolvedSites !== "*") {
    where.siteId = { in: [...ctx.resolvedSites] };
  }
  if (filters?.materialId) where.materialId = filters.materialId;
  if (filters?.status) where.status = filters.status;
  if (filters?.siteId) {
    // explicit siteId filter must be within scope
    assertSiteAccess(ctx, filters.siteId);
    where.siteId = filters.siteId;
  }
  const [items, total] = await Promise.all([
    db.materialLot.findMany({ where, orderBy: { receivedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { material: true, supplier: true, site: true } }),
    db.materialLot.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getMaterialLot(ctx: AuthContext, id: string) {
  if (!can(ctx, "manufacturing.materiallot.read")) throw new ForbiddenError();
  const lot = await db.materialLot.findUnique({ where: { id }, include: { material: true, supplier: true, site: true } });
  if (!lot) throw new NotFoundError("MaterialLot");
  assertSiteAccess(ctx, lot.siteId); // D4: enforce scope on read too
  return lot;
}

export async function createMaterialLot(ctx: AuthContext, input: z.infer<typeof CreateMaterialLotSchema>) {
  if (!can(ctx, "manufacturing.materiallot.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId); // D4
  const material = await db.material.findUnique({ where: { id: input.materialId } });
  if (!material) throw new NotFoundError("Material");
  const supplier = await db.supplier.findUnique({ where: { id: input.supplierId } });
  if (!supplier) throw new NotFoundError("Supplier");
  assertSupplierQualified(supplier.qualificationStatus); // D5: DISQUALIFIED rejected
  assertQuantityInvariant(input.quantityReceived, input.quantityReceived); // initial available = received

  const existing = await db.materialLot.findUnique({ where: { siteId_lotCode: { siteId: input.siteId, lotCode: input.lotCode } } });
  if (existing) throw new ConflictError("Lot code already exists at this site");

  const lot = await db.materialLot.create({
    data: {
      lotCode: input.lotCode,
      materialId: input.materialId,
      supplierId: input.supplierId,
      siteId: input.siteId,
      quantityReceived: input.quantityReceived,
      quantityAvailable: input.quantityReceived, // initial available = received
      unit: input.unit,
      status: "RECEIVED",
      expiryDate: input.expiryDate,
      certificateOfAnalysis: input.certificateOfAnalysis,
      isDemo: false,
    },
  });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.materiallot.create", entityType: "MaterialLot", entityId: lot.id, newState: { lotCode: lot.lotCode, materialId: lot.materialId, siteId: lot.siteId, quantityReceived: lot.quantityReceived }, reason: `Received from ${supplier.code}` });
  return lot;
}

export async function updateMaterialLot(ctx: AuthContext, id: string, input: z.infer<typeof UpdateMaterialLotSchema>) {
  if (!can(ctx, "manufacturing.materiallot.update")) throw new ForbiddenError();
  const lot = await db.materialLot.findUnique({ where: { id } });
  if (!lot) throw new NotFoundError("MaterialLot");
  assertSiteAccess(ctx, lot.siteId); // D4
  const updated = await db.materialLot.update({ where: { id }, data: input });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.materiallot.update", entityType: "MaterialLot", entityId: id, previousState: { expiryDate: lot.expiryDate }, newState: { expiryDate: updated.expiryDate }, reason: "Lot metadata update" });
  return updated;
}

export async function transitionMaterialLot(ctx: AuthContext, id: string, input: z.infer<typeof MaterialLotTransitionSchema>) {
  if (!can(ctx, "manufacturing.materiallot.transition")) throw new ForbiddenError();
  const lot = await db.materialLot.findUnique({ where: { id } });
  if (!lot) throw new NotFoundError("MaterialLot");
  assertSiteAccess(ctx, lot.siteId); // D4
  assertLotTransition(lot.status, input.to); // D3
  const updated = await db.materialLot.update({ where: { id }, data: { status: input.to } });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.materiallot.transition", entityType: "MaterialLot", entityId: id, previousState: { status: lot.status }, newState: { status: input.to }, reason: input.reason });
  return updated;
}

// ===========================================================================
// Suppliers (global)
// ===========================================================================

export async function listSuppliers(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "manufacturing.supplier.read")) throw new ForbiddenError();
  const [items, total] = await Promise.all([
    db.supplier.findMany({ orderBy: { code: "asc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { lots: true, materials: true } } } }),
    db.supplier.count(),
  ]);
  return { items, total, page, pageSize };
}

export async function getSupplier(ctx: AuthContext, id: string) {
  if (!can(ctx, "manufacturing.supplier.read")) throw new ForbiddenError();
  const s = await db.supplier.findUnique({ where: { id }, include: { materials: { include: { material: true } } } });
  if (!s) throw new NotFoundError("Supplier");
  return s;
}

export async function createSupplier(ctx: AuthContext, input: z.infer<typeof CreateSupplierSchema>) {
  if (!can(ctx, "manufacturing.supplier.create")) throw new ForbiddenError();
  const existing = await db.supplier.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("Supplier code already exists");
  const supplier = await db.supplier.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.supplier.create", entityType: "Supplier", entityId: supplier.id, newState: { code: supplier.code, name: supplier.name, qualificationStatus: supplier.qualificationStatus } });
  return supplier;
}

export async function updateSupplier(ctx: AuthContext, id: string, input: z.infer<typeof UpdateSupplierSchema>) {
  if (!can(ctx, "manufacturing.supplier.update")) throw new ForbiddenError();
  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Supplier");
  const updated = await db.supplier.update({ where: { id }, data: input });
  await audit({ actorUserId: ctx.user.id, action: "manufacturing.supplier.update", entityType: "Supplier", entityId: id, previousState: { name: existing.name, qualificationStatus: existing.qualificationStatus }, newState: { name: updated.name, qualificationStatus: updated.qualificationStatus }, reason: input.qualificationStatus && input.qualificationStatus !== existing.qualificationStatus ? `Qualification changed ${existing.qualificationStatus}->${input.qualificationStatus}` : "Supplier update" });
  return updated;
}

// zod re-export for API layer convenience
import type z from "zod";
