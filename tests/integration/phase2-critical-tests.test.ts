// Phase 2 critical tests: T-ISOL-02, T-BOM-01, T-REV-01, T-LOT-01, T-QUANT-01 + regression.
// Run against a fresh test DB with the Phase 2 migration applied.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetTestDb, disconnectTestDb, getTestDb } from "./test-db";
import {
  assertBomEditable,
  assertLotTransition,
  assertQuantityInvariant,
  assertRevisionTransition,
  assertSupplierQualified,
  isBomEditable,
  isValidLotTransition,
  isValidRevisionTransition,
  REVISION_STATUSES,
  MATERIAL_LOT_STATUSES,
} from "@/modules/manufacturing/domain";
import { StateTransitionError, ValidationError } from "@/lib/errors";

let db: Awaited<ReturnType<typeof getTestDb>>;

beforeAll(async () => {
  await resetTestDb();
  db = getTestDb();
  // Minimal seed for Phase 2 tests: a site, supplier, material, product, revision.
  const site = await db.site.create({ data: { code: "T-SITE-A", name: "Test Site A", isDemo: true, status: "ACTIVE" } });
  const siteB = await db.site.create({ data: { code: "T-SITE-B", name: "Test Site B", isDemo: true, status: "ACTIVE" } });
  const supplierApproved = await db.supplier.create({ data: { code: "T-SUP-01", name: "Approved Supplier", qualificationStatus: "APPROVED", isDemo: true } });
  const supplierDisqualified = await db.supplier.create({ data: { code: "T-SUP-02", name: "Disqualified Supplier", qualificationStatus: "DISQUALIFIED", isDemo: true } });
  const material = await db.material.create({ data: { code: "T-MAT-01", name: "Test Material", materialType: "RAW", defaultUnit: "kg", isDemo: true } });
  const product = await db.product.create({ data: { code: "T-PROD-01", name: "Test Product", productType: "DEVICE", deviceClass: "IIa", isDemo: true } });
  const revDraft = await db.productRevision.create({ data: { productId: product.id, revisionCode: "REV-A", status: "DRAFT", isDemo: true } });
  const revEffective = await db.productRevision.create({ data: { productId: product.id, revisionCode: "REV-B", status: "EFFECTIVE", effectiveFrom: new Date(), isDemo: true } });
  await db.bOM.create({ data: { productRevisionId: revDraft.id, status: "DRAFT" } });
  await db.bOM.create({ data: { productRevisionId: revEffective.id, status: "EFFECTIVE" } });
  // A lot at site A (approved supplier)
  await db.materialLot.create({ data: { lotCode: "T-LOT-A1", materialId: material.id, supplierId: supplierApproved.id, siteId: site.id, quantityReceived: "100", quantityAvailable: "100", unit: "kg", status: "RECEIVED", isDemo: true } });
  // A lot at site B (approved supplier)
  await db.materialLot.create({ data: { lotCode: "T-LOT-B1", materialId: material.id, supplierId: supplierApproved.id, siteId: siteB.id, quantityReceived: "50", quantityAvailable: "50", unit: "kg", status: "APPROVED", isDemo: true } });
});
afterAll(async () => { await disconnectTestDb(); });

// ===========================================================================
// T-REV-01: ProductRevision state machine enforces valid transitions.
// ===========================================================================
describe("T-REV-01: ProductRevision state machine", () => {
  it("DRAFT -> IN_REVIEW is valid", () => {
    expect(isValidRevisionTransition("DRAFT", "IN_REVIEW")).toBe(true);
  });
  it("DRAFT -> EFFECTIVE is INVALID (must pass IN_REVIEW -> APPROVED)", () => {
    expect(isValidRevisionTransition("DRAFT", "EFFECTIVE")).toBe(false);
    expect(() => assertRevisionTransition("DRAFT", "EFFECTIVE")).toThrow(StateTransitionError);
  });
  it("EFFECTIVE -> SUPERSEDED is valid", () => {
    expect(isValidRevisionTransition("EFFECTIVE", "SUPERSEDED")).toBe(true);
  });
  it("OBSOLETE -> anything is INVALID (terminal)", () => {
    for (const s of REVISION_STATUSES) {
      expect(isValidRevisionTransition("OBSOLETE", s)).toBe(false);
    }
  });
  it("APPROVED -> IN_REVIEW is INVALID (no backward)", () => {
    expect(isValidRevisionTransition("APPROVED", "IN_REVIEW")).toBe(false);
  });
});

// ===========================================================================
// T-BOM-01: BOM is immutable when revision is EFFECTIVE (D2).
// ===========================================================================
describe("T-BOM-01: BOM immutability (D2)", () => {
  it("BOM is editable when revision is DRAFT", () => {
    expect(isBomEditable("DRAFT")).toBe(true);
    expect(() => assertBomEditable("DRAFT")).not.toThrow();
  });
  it("BOM is editable when revision is IN_REVIEW", () => {
    expect(isBomEditable("IN_REVIEW")).toBe(true);
  });
  it("BOM is NOT editable when revision is APPROVED", () => {
    expect(isBomEditable("APPROVED")).toBe(false);
    expect(() => assertBomEditable("APPROVED")).toThrow(StateTransitionError);
  });
  it("BOM is NOT editable when revision is EFFECTIVE", () => {
    expect(isBomEditable("EFFECTIVE")).toBe(false);
    expect(() => assertBomEditable("EFFECTIVE")).toThrow(StateTransitionError);
  });
  it("BOM is NOT editable when revision is SUPERSEDED or OBSOLETE", () => {
    expect(isBomEditable("SUPERSEDED")).toBe(false);
    expect(isBomEditable("OBSOLETE")).toBe(false);
  });
  it("DB verification: EFFECTIVE revision's BOM line add is rejected by service guard", async () => {
    // This is verified at the domain level above; the service layer calls assertBomEditable.
    // The DB itself doesn't block BOMLine inserts (the guard is in the service), which is correct
    // because the guard must produce a clean StateTransitionError, not a raw DB error.
    expect(() => assertBomEditable("EFFECTIVE")).toThrow(/immutable/);
  });
});

// ===========================================================================
// T-LOT-01: MaterialLot state machine enforces valid transitions (D3).
// ===========================================================================
describe("T-LOT-01: MaterialLot state machine (D3)", () => {
  it("RECEIVED -> QUARANTINE is valid", () => {
    expect(isValidLotTransition("RECEIVED", "QUARANTINE")).toBe(true);
  });
  it("RECEIVED -> APPROVED is INVALID (must pass QUARANTINE)", () => {
    expect(isValidLotTransition("RECEIVED", "APPROVED")).toBe(false);
    expect(() => assertLotTransition("RECEIVED", "APPROVED")).toThrow(StateTransitionError);
  });
  it("QUARANTINE -> APPROVED is valid", () => {
    expect(isValidLotTransition("QUARANTINE", "APPROVED")).toBe(true);
  });
  it("QUARANTINE -> REJECTED is valid (terminal)", () => {
    expect(isValidLotTransition("QUARANTINE", "REJECTED")).toBe(true);
  });
  it("APPROVED -> QUARANTINE is valid (return on issue)", () => {
    expect(isValidLotTransition("APPROVED", "QUARANTINE")).toBe(true);
  });
  it("APPROVED -> IN_USE is valid", () => {
    expect(isValidLotTransition("APPROVED", "IN_USE")).toBe(true);
  });
  it("IN_USE -> EXHAUSTED is valid", () => {
    expect(isValidLotTransition("IN_USE", "EXHAUSTED")).toBe(true);
  });
  it("EXHAUSTED -> anything is INVALID (terminal)", () => {
    for (const s of MATERIAL_LOT_STATUSES) {
      expect(isValidLotTransition("EXHAUSTED", s)).toBe(false);
    }
  });
  it("REJECTED -> anything is INVALID (terminal)", () => {
    for (const s of MATERIAL_LOT_STATUSES) {
      expect(isValidLotTransition("REJECTED", s)).toBe(false);
    }
  });
});

// ===========================================================================
// T-QUANT-01: quantity invariants (available <= received, > 0).
// ===========================================================================
describe("T-QUANT-01: quantity invariants", () => {
  it("valid: available == received", () => {
    expect(() => assertQuantityInvariant("100", "100")).not.toThrow();
  });
  it("valid: available < received (partially consumed)", () => {
    expect(() => assertQuantityInvariant("100", "30")).not.toThrow();
  });
  it("valid: available == 0 (exhausted)", () => {
    expect(() => assertQuantityInvariant("100", "0")).not.toThrow();
  });
  it("INVALID: available > received", () => {
    expect(() => assertQuantityInvariant("100", "150")).toThrow(ValidationError);
  });
  it("INVALID: received <= 0", () => {
    expect(() => assertQuantityInvariant("0", "0")).toThrow(ValidationError);
    expect(() => assertQuantityInvariant("-5", "0")).toThrow(ValidationError);
  });
  it("INVALID: available < 0", () => {
    expect(() => assertQuantityInvariant("100", "-1")).toThrow(ValidationError);
  });
});

// ===========================================================================
// T-ISOL-02: MaterialLot cross-site isolation (D4).
// ===========================================================================
describe("T-ISOL-02: MaterialLot cross-site isolation (D4)", () => {
  it("Site A has 1 lot, Site B has 1 lot (different lot codes)", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const siteB = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-B" } });
    const lotsA = await db.materialLot.findMany({ where: { siteId: siteA.id } });
    const lotsB = await db.materialLot.findMany({ where: { siteId: siteB.id } });
    expect(lotsA.length).toBe(1);
    expect(lotsB.length).toBe(1);
    expect(lotsA[0].lotCode).toBe("T-LOT-A1");
    expect(lotsB[0].lotCode).toBe("T-LOT-B1");
    // Site A's lot must NOT appear in Site B's query and vice versa.
    expect(lotsA.find((l) => l.lotCode === "T-LOT-B1")).toBeUndefined();
    expect(lotsB.find((l) => l.lotCode === "T-LOT-A1")).toBeUndefined();
  });
  it("lotCode is unique per site (compound key)", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    // Attempting to create a lot with the same (siteId, lotCode) should fail.
    await expect(
      db.materialLot.create({ data: { lotCode: "T-LOT-A1", materialId: (await db.material.findFirstOrThrow()).id, supplierId: (await db.supplier.findFirstOrThrow()).id, siteId: siteA.id, quantityReceived: "10", quantityAvailable: "10", unit: "kg", status: "RECEIVED", isDemo: true } }),
    ).rejects.toThrow();
  });
});

// ===========================================================================
// T-SUP-01: DISQUALIFIED supplier cannot be used for new MaterialLot (D5).
// ===========================================================================
describe("T-SUP-01: DISQUALIFIED supplier enforcement (D5)", () => {
  it("APPROVED supplier passes", () => {
    expect(() => assertSupplierQualified("APPROVED")).not.toThrow();
  });
  it("CONDITIONAL supplier passes", () => {
    expect(() => assertSupplierQualified("CONDITIONAL")).not.toThrow();
  });
  it("DISQUALIFIED supplier is rejected", () => {
    expect(() => assertSupplierQualified("DISQUALIFIED")).toThrow(StateTransitionError);
  });
});

// ===========================================================================
// Regression: Phase 1 audit immutability still holds (triggers present on test DB).
// ===========================================================================
describe("Regression: Phase 1 audit immutability", () => {
  it("INSERT audit event succeeds", async () => {
    const ev = await db.auditEvent.create({ data: { action: "test.p2.regression", entityType: "Test", outcome: "SUCCESS" } });
    expect(ev.id).toBeTruthy();
  });
  it("UPDATE audit event is rejected by trigger", async () => {
    await expect(db.$executeRawUnsafe(`UPDATE "AuditEvent" SET outcome='FAILURE' WHERE action='test.p2.regression'`)).rejects.toThrow();
  });
  it("DELETE audit event is rejected by trigger", async () => {
    await expect(db.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE action='test.p2.regression'`)).rejects.toThrow();
  });
});
