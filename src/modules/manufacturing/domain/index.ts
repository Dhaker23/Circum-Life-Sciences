// Phase 2 manufacturing domain: state machines + invariants + zod schemas.
// D2: BOM immutability (frozen when revision not DRAFT/IN_REVIEW).
// D3: MaterialLot lifecycle. D5: Supplier qualification. PRD section 10 traceability foundation.
import { z } from "zod";
import { StateTransitionError, ValidationError } from "@/lib/errors";

// ---- Enums (controlled; zod is the single source of truth) ----

export const PRODUCT_TYPES = ["DEVICE", "COMPONENT", "OTHER"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const DEVICE_CLASSES = ["I", "IIa", "IIb", "III"] as const;
export type DeviceClass = (typeof DEVICE_CLASSES)[number];

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const MATERIAL_TYPES = ["RAW", "COMPONENT", "PACKAGING", "CONSUMABLE"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const SUPPLIER_QUALIFICATION = ["APPROVED", "CONDITIONAL", "DISQUALIFIED"] as const;
export type SupplierQualification = (typeof SUPPLIER_QUALIFICATION)[number];

// ---- ProductRevision state machine (D2) ----
export const REVISION_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "EFFECTIVE", "SUPERSEDED", "OBSOLETE"] as const;
export type RevisionStatus = (typeof REVISION_STATUSES)[number];

const REVISION_TRANSITIONS: Record<RevisionStatus, RevisionStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["DRAFT", "APPROVED"],
  APPROVED: ["EFFECTIVE"],
  EFFECTIVE: ["SUPERSEDED"],
  SUPERSEDED: ["OBSOLETE"],
  OBSOLETE: [],
};

export function isValidRevisionTransition(from: RevisionStatus, to: RevisionStatus): boolean {
  return REVISION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertRevisionTransition(from: string, to: string): void {
  if (!REVISION_STATUSES.includes(from as RevisionStatus)) throw new ValidationError(`Invalid revision status: ${from}`);
  if (!REVISION_STATUSES.includes(to as RevisionStatus)) throw new ValidationError(`Invalid revision status: ${to}`);
  if (!isValidRevisionTransition(from as RevisionStatus, to as RevisionStatus)) {
    throw new StateTransitionError(`Cannot transition revision from ${from} to ${to}`);
  }
}

// BOM is editable only while the revision is DRAFT or IN_REVIEW (D2: frozen when APPROVED+).
export const BOM_EDITABLE_REVISION_STATUSES: RevisionStatus[] = ["DRAFT", "IN_REVIEW"];
export function isBomEditable(revisionStatus: string): boolean {
  return BOM_EDITABLE_REVISION_STATUSES.includes(revisionStatus as RevisionStatus);
}
export function assertBomEditable(revisionStatus: string): void {
  if (!isBomEditable(revisionStatus)) {
    throw new StateTransitionError(
      `BOM is immutable: revision status is ${revisionStatus} (editable only in DRAFT/IN_REVIEW). A BOM change requires a new Product Revision (ADR-0006).`,
    );
  }
}

// ---- MaterialLot state machine (D3) ----
export const MATERIAL_LOT_STATUSES = ["RECEIVED", "QUARANTINE", "APPROVED", "IN_USE", "EXHAUSTED", "REJECTED"] as const;
export type MaterialLotStatus = (typeof MATERIAL_LOT_STATUSES)[number];

const MATERIAL_LOT_TRANSITIONS: Record<MaterialLotStatus, MaterialLotStatus[]> = {
  RECEIVED: ["QUARANTINE"],
  QUARANTINE: ["APPROVED", "REJECTED", "RECEIVED"],
  APPROVED: ["IN_USE", "QUARANTINE"],
  IN_USE: ["EXHAUSTED", "APPROVED"],
  EXHAUSTED: [],
  REJECTED: [],
};

export function isValidLotTransition(from: MaterialLotStatus, to: MaterialLotStatus): boolean {
  return MATERIAL_LOT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertLotTransition(from: string, to: string): void {
  if (!MATERIAL_LOT_STATUSES.includes(from as MaterialLotStatus)) throw new ValidationError(`Invalid material lot status: ${from}`);
  if (!MATERIAL_LOT_STATUSES.includes(to as MaterialLotStatus)) throw new ValidationError(`Invalid material lot status: ${to}`);
  if (!isValidLotTransition(from as MaterialLotStatus, to as MaterialLotStatus)) {
    throw new StateTransitionError(`Cannot transition material lot from ${from} to ${to}`);
  }
}

// ---- Quantity invariants (D3) ----
export function assertQuantityInvariant(quantityReceived: string | number, quantityAvailable: string | number): void {
  const received = typeof quantityReceived === "string" ? parseFloat(quantityReceived) : quantityReceived;
  const available = typeof quantityAvailable === "string" ? parseFloat(quantityAvailable) : quantityAvailable;
  if (Number.isNaN(received) || Number.isNaN(available)) throw new ValidationError("Quantities must be numeric");
  if (received <= 0) throw new ValidationError("quantityReceived must be > 0");
  if (available < 0) throw new ValidationError("quantityAvailable must be >= 0");
  if (available > received) throw new ValidationError("quantityAvailable cannot exceed quantityReceived");
}

// ---- Supplier qualification enforcement (D5) ----
export function assertSupplierQualified(qualificationStatus: string): void {
  if (qualificationStatus === "DISQUALIFIED") {
    throw new StateTransitionError("Supplier is DISQUALIFIED and cannot be used as a source for a new MaterialLot (D5).");
  }
  if (!SUPPLIER_QUALIFICATION.includes(qualificationStatus as SupplierQualification)) {
    throw new ValidationError(`Invalid supplier qualification status: ${qualificationStatus}`);
  }
}

// ---- Zod schemas ----

export const CreateProductSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/, "Product code must be uppercase alphanumeric/dash"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  productType: z.enum(PRODUCT_TYPES).default("DEVICE"),
  deviceClass: z.enum(DEVICE_CLASSES).optional(),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  deviceClass: z.enum(DEVICE_CLASSES).nullish(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export const CreateProductRevisionSchema = z.object({
  revisionCode: z.string().min(1).max(40).regex(/^[A-Z0-9-]+$/),
  description: z.string().max(2000).optional(),
});

export const RevisionTransitionSchema = z.object({
  to: z.enum(REVISION_STATUSES),
  reason: z.string().min(1).max(500),
});

export const CreateBOMLineSchema = z.object({
  materialId: z.string().cuid(),
  quantity: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0, "quantity must be > 0"),
  unit: z.string().min(1).max(20),
  sequence: z.number().int().min(0).default(0),
  notes: z.string().max(1000).optional(),
  substituteMaterialId: z.string().cuid().nullish(),
});

export const UpdateBOMLineSchema = z.object({
  quantity: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0).optional(),
  unit: z.string().min(1).max(20).optional(),
  sequence: z.number().int().min(0).optional(),
  notes: z.string().max(1000).nullish(),
  substituteMaterialId: z.string().cuid().nullish(),
});

export const CreateMaterialSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  materialType: z.enum(MATERIAL_TYPES).default("RAW"),
  defaultUnit: z.string().min(1).max(20),
});

export const UpdateMaterialSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  materialType: z.enum(MATERIAL_TYPES).optional(),
  defaultUnit: z.string().min(1).max(20).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const CreateMaterialLotSchema = z.object({
  lotCode: z.string().min(1).max(60),
  materialId: z.string().cuid(),
  supplierId: z.string().cuid(),
  siteId: z.string().cuid(),
  quantityReceived: z.string().regex(/^\d+(\.\d+)?$/).refine((v) => parseFloat(v) > 0),
  unit: z.string().min(1).max(20),
  expiryDate: z.coerce.date().optional(),
  certificateOfAnalysis: z.string().max(500).optional(),
});

export const UpdateMaterialLotSchema = z.object({
  expiryDate: z.coerce.date().optional(),
  certificateOfAnalysis: z.string().max(500).nullish(),
});

export const MaterialLotTransitionSchema = z.object({
  to: z.enum(MATERIAL_LOT_STATUSES),
  reason: z.string().min(1).max(500),
});

export const CreateSupplierSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/),
  name: z.string().min(1).max(200),
  qualificationStatus: z.enum(SUPPLIER_QUALIFICATION).default("CONDITIONAL"),
  contact: z.string().max(500).optional(),
});

export const UpdateSupplierSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  qualificationStatus: z.enum(SUPPLIER_QUALIFICATION).optional(),
  contact: z.string().max(500).nullish(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const LinkMaterialSupplierSchema = z.object({
  supplierId: z.string().cuid(),
  isPreferred: z.boolean().default(false),
  supplierPartCode: z.string().max(100).optional(),
});
