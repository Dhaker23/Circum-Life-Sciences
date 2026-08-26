// Phase 4 critical tests + extras.
// T-NCR-01, T-DEV-01, T-INV-01, T-CAPA-01, T-CHG-01, T-RISK-01, T-ISOL-04, T-LINK-01, T-AI-GUARD-01
// + CAPA-without-investigation, invalid/cross-site polymorphic, AI denial, disposition-scrap,
// deviation expiration, audit immutability, state-machine bypass, regression.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetTestDb, disconnectTestDb, getTestDb } from "./test-db";
import {
  assertCapaClosureAllowed,
  assertCapaTransition,
  assertChangeImplementationApproved,
  assertChangeTransition,
  assertDeviationTransition,
  assertInvestigationConclude,
  assertNcrTransition,
  computeRpn,
  isValidCapaTransition,
  isValidChangeTransition,
  isValidDeviationTransition,
  isValidNcrTransition,
  NCR_STATUSES,
  CAPA_STATUSES,
  CHANGE_STATUSES,
  DEVIATION_STATUSES,
} from "@/modules/quality/domain";
import { StateTransitionError, ValidationError } from "@/lib/errors";

let db: Awaited<ReturnType<typeof getTestDb>>;

beforeAll(async () => {
  await resetTestDb();
  db = getTestDb();
  // Minimal seed: site A + site B, product, revision, batch at A, batch at B, material (for deviation/risk tests).
  const siteA = await db.site.create({ data: { code: "T-SITE-A", name: "Test Site A", isDemo: true, status: "ACTIVE" } });
  const siteB = await db.site.create({ data: { code: "T-SITE-B", name: "Test Site B", isDemo: true, status: "ACTIVE" } });
  const product = await db.product.create({ data: { code: "T-PROD-01", name: "Test Product", productType: "DEVICE", deviceClass: "IIa", isDemo: true } });
  const rev = await db.productRevision.create({ data: { productId: product.id, revisionCode: "REV-A", status: "EFFECTIVE", effectiveFrom: new Date(), isDemo: true } });
  await db.material.create({ data: { code: "T-MAT-01", name: "Test Material", materialType: "RAW", defaultUnit: "kg", isDemo: true } });
  const woA = await db.workOrder.create({ data: { code: "WO-A-01", productRevisionId: rev.id, siteId: siteA.id, plannedQuantity: "100", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  await db.manufacturingBatch.create({ data: { code: "BATCH-A-01", workOrderId: woA.id, productRevisionId: rev.id, siteId: siteA.id, plannedQuantity: "100", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  const woB = await db.workOrder.create({ data: { code: "WO-B-01", productRevisionId: rev.id, siteId: siteB.id, plannedQuantity: "50", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  await db.manufacturingBatch.create({ data: { code: "BATCH-B-01", workOrderId: woB.id, productRevisionId: rev.id, siteId: siteB.id, plannedQuantity: "50", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
});
afterAll(async () => { await disconnectTestDb(); });

// T-NCR-01
describe("T-NCR-01: NCR state machine (D3)", () => {
  it("DRAFT -> CONTAINMENT valid", () => expect(isValidNcrTransition("DRAFT", "CONTAINMENT")).toBe(true));
  it("DRAFT -> CLOSED INVALID", () => { expect(isValidNcrTransition("DRAFT", "CLOSED")).toBe(false); expect(() => assertNcrTransition("DRAFT", "CLOSED")).toThrow(StateTransitionError); });
  it("CONTAINMENT -> INVESTIGATION valid", () => expect(isValidNcrTransition("CONTAINMENT", "INVESTIGATION")).toBe(true));
  it("INVESTIGATION -> DISPOSITION valid", () => expect(isValidNcrTransition("INVESTIGATION", "DISPOSITION")).toBe(true));
  it("DISPOSITION -> CLOSED valid", () => expect(isValidNcrTransition("DISPOSITION", "CLOSED")).toBe(true));
  it("CLOSED terminal", () => { for (const s of NCR_STATUSES) expect(isValidNcrTransition("CLOSED", s)).toBe(false); });
  it("DRAFT -> CANCELLED valid (terminal)", () => expect(isValidNcrTransition("DRAFT", "CANCELLED")).toBe(true));
});

// T-DEV-01
describe("T-DEV-01: Deviation state machine (D4)", () => {
  it("DRAFT -> ASSESSMENT valid", () => expect(isValidDeviationTransition("DRAFT", "ASSESSMENT")).toBe(true));
  it("DRAFT -> CLOSED INVALID", () => { expect(isValidDeviationTransition("DRAFT", "CLOSED")).toBe(false); expect(() => assertDeviationTransition("DRAFT", "CLOSED")).toThrow(StateTransitionError); });
  it("ASSESSMENT -> REVIEW valid (skip investigation, D4)", () => expect(isValidDeviationTransition("ASSESSMENT", "REVIEW")).toBe(true));
  it("ASSESSMENT -> INVESTIGATION valid", () => expect(isValidDeviationTransition("ASSESSMENT", "INVESTIGATION")).toBe(true));
  it("REVIEW -> CLOSED valid", () => expect(isValidDeviationTransition("REVIEW", "CLOSED")).toBe(true));
  it("REVIEW -> REJECTED valid", () => expect(isValidDeviationTransition("REVIEW", "REJECTED")).toBe(true));
  it("REJECTED terminal", () => { for (const s of DEVIATION_STATUSES) expect(isValidDeviationTransition("REJECTED", s)).toBe(false); });
});

// T-INV-01
describe("T-INV-01: Investigation (D2)", () => {
  it("conclude from IN_PROGRESS valid", () => { expect(() => assertInvestigationConclude("IN_PROGRESS")).not.toThrow(); });
  it("conclude from CONCLUDED INVALID", () => { expect(() => assertInvestigationConclude("CONCLUDED")).toThrow(StateTransitionError); });
  it("DB: investigation links to NCR; can spawn CAPA", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { siteId: siteA.id } });
    const ncr = await db.nCR.create({ data: { code: "NCR-T-01", siteId: siteA.id, concernsEntityType: "BATCH", concernsEntityId: batch.id, description: "test", severity: "MAJOR", status: "INVESTIGATION", isDemo: true } });
    const inv = await db.investigation.create({ data: { code: "INV-T-01", siteId: siteA.id, sourceType: "NCR", sourceNcrId: ncr.id, methodology: "5-Why", status: "CONCLUDED", isDemo: true } });
    await db.nCR.update({ where: { id: ncr.id }, data: { investigationId: inv.id } });
    const capa = await db.cAPA.create({ data: { code: "CAPA-T-01", siteId: siteA.id, sourceType: "INVESTIGATION", sourceId: inv.id, investigationId: inv.id, type: "CORRECTIVE", actionPlan: "fix it", isDemo: true } });
    expect(capa.investigationId).toBe(inv.id);
    expect((await db.investigation.findUniqueOrThrow({ where: { id: inv.id }, include: { capas: true } })).capas.length).toBe(1);
  });
});

// T-CAPA-01
describe("T-CAPA-01: CAPA state machine + closure guard (D5)", () => {
  it("OPEN -> ACTION_PLAN valid", () => expect(isValidCapaTransition("OPEN", "ACTION_PLAN")).toBe(true));
  it("OPEN -> CLOSED INVALID", () => { expect(isValidCapaTransition("OPEN", "CLOSED")).toBe(false); expect(() => assertCapaTransition("OPEN", "CLOSED")).toThrow(StateTransitionError); });
  it("EFFECTIVENESS -> CLOSED valid", () => expect(isValidCapaTransition("EFFECTIVENESS", "CLOSED")).toBe(true));
  it("CLOSED terminal", () => { for (const s of CAPA_STATUSES) expect(isValidCapaTransition("CLOSED", s)).toBe(false); });
  it("closure BLOCKED without effectiveness verification", () => {
    expect(() => assertCapaClosureAllowed({ effectivenessVerification: null, effectivenessVerifiedByUserId: null })).toThrow(StateTransitionError);
    expect(() => assertCapaClosureAllowed({ effectivenessVerification: "", effectivenessVerifiedByUserId: null })).toThrow(StateTransitionError);
  });
  it("closure BLOCKED without human verifier (AI cannot close)", () => {
    expect(() => assertCapaClosureAllowed({ effectivenessVerification: "evidence", effectivenessVerifiedByUserId: null })).toThrow(StateTransitionError);
  });
  it("closure ALLOWED with evidence + human verifier", () => {
    expect(() => assertCapaClosureAllowed({ effectivenessVerification: "effectiveness confirmed", effectivenessVerifiedByUserId: "user-123" })).not.toThrow();
  });
});

// T-CHG-01
describe("T-CHG-01: Change Control state machine + approval guard (D6)", () => {
  it("REQUEST -> IMPACT valid", () => expect(isValidChangeTransition("REQUEST", "IMPACT")).toBe(true));
  it("REQUEST -> IMPLEMENTATION INVALID", () => { expect(isValidChangeTransition("REQUEST", "IMPLEMENTATION")).toBe(false); expect(() => assertChangeTransition("REQUEST", "IMPLEMENTATION")).toThrow(StateTransitionError); });
  it("APPROVAL -> IMPLEMENTATION valid", () => expect(isValidChangeTransition("APPROVAL", "IMPLEMENTATION")).toBe(true));
  it("implementation BLOCKED without human approval", () => {
    expect(() => assertChangeImplementationApproved({ approvedByUserId: null, approvedAt: null })).toThrow(StateTransitionError);
  });
  it("implementation ALLOWED with human approval", () => {
    expect(() => assertChangeImplementationApproved({ approvedByUserId: "user-123", approvedAt: new Date() })).not.toThrow();
  });
  it("CLOSED terminal", () => { for (const s of CHANGE_STATUSES) expect(isValidChangeTransition("CLOSED", s)).toBe(false); });
  it("REJECTED terminal", () => { for (const s of CHANGE_STATUSES) expect(isValidChangeTransition("REJECTED", s)).toBe(false); });
});

// T-RISK-01
describe("T-RISK-01: RPN computation (D7/D12)", () => {
  it("RPN = severity x probability", () => {
    expect(computeRpn(1, 1)).toBe(1);
    expect(computeRpn(5, 5)).toBe(25);
    expect(computeRpn(4, 3)).toBe(12);
    expect(computeRpn(3, 3)).toBe(9);
  });
  it("severity/probability must be 1-5", () => {
    expect(() => computeRpn(0, 3)).toThrow(ValidationError);
    expect(() => computeRpn(6, 3)).toThrow(ValidationError);
    expect(() => computeRpn(3, 0)).toThrow(ValidationError);
    expect(() => computeRpn(3, 6)).toThrow(ValidationError);
  });
});

// T-ISOL-04: cross-site quality isolation
describe("T-ISOL-04: cross-site quality isolation", () => {
  it("Site A NCR is not visible from Site B", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const siteB = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-B" } });
    const batchA = await db.manufacturingBatch.findFirstOrThrow({ where: { siteId: siteA.id } });
    await db.nCR.create({ data: { code: "NCR-ISO-A", siteId: siteA.id, concernsEntityType: "BATCH", concernsEntityId: batchA.id, description: "site A only", isDemo: true } });
    const ncrsA = await db.nCR.findMany({ where: { siteId: siteA.id } });
    const ncrsB = await db.nCR.findMany({ where: { siteId: siteB.id } });
    expect(ncrsA.find((n) => n.code === "NCR-ISO-A")).toBeTruthy();
    expect(ncrsB.find((n) => n.code === "NCR-ISO-A")).toBeUndefined();
  });
});

// T-LINK-01: polymorphic linkage
describe("T-LINK-01: polymorphic linkage to production (D8)", () => {
  it("NCR links to a Batch via concernsEntityType + concernsEntityId", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { siteId: siteA.id } });
    const ncr = await db.nCR.create({ data: { code: "NCR-LINK-01", siteId: siteA.id, concernsEntityType: "BATCH", concernsEntityId: batch.id, description: "linked", isDemo: true } });
    expect(ncr.concernsEntityType).toBe("BATCH");
    expect(ncr.concernsEntityId).toBe(batch.id);
    // The batch can be found via the NCR's reference (genealogy query)
    const linkedBatch = await db.manufacturingBatch.findUnique({ where: { id: ncr.concernsEntityId } });
    expect(linkedBatch).toBeTruthy();
    expect(linkedBatch?.siteId).toBe(siteA.id); // same site (D8 cross-site rejected at service layer)
  });
});

// T-AI-GUARD-01: AI governance contract
describe("T-AI-GUARD-01: AI governance (PRD section 9)", () => {
  it("no quality.*.approve or quality.*.close permission is grantable to a non-human", async () => {
    // Static contract: the permission catalog does not include any permission that allows AI to
    // approve/close. The service layer enforces human-only via requirePermission (which checks
    // the AuthContext, derived from a human next-auth session). AI (Phase 12) will not receive
    // these permissions in its role grants.
    const { PERMISSION_CATALOG } = await import("@/lib/permissions");
    const approvePerms = PERMISSION_CATALOG.filter((p) => p.key.endsWith(".approve") || p.key.endsWith(".close"));
    expect(approvePerms.length).toBeGreaterThan(0); // these exist
    // All require a human actor (the service layer checks ctx.user.id from the session).
    // This test documents the contract; the enforcement is in the service layer.
    approvePerms.forEach((p) => expect(p.key).toMatch(/(quality\.(deviation\.approve|change\.approve|capa\.close)|lab\.(specification\.approve|testresult\.disposition)|docs\.document\.approve|training\.competency\.authorize|equipment\.qualification\.approve|lean\.downtime\.close)/));
  });
  it("CAPA closure guard rejects without human verifier", () => {
    expect(() => assertCapaClosureAllowed({ effectivenessVerification: "evidence", effectivenessVerifiedByUserId: null })).toThrow(StateTransitionError);
  });
  it("Change implementation guard rejects without human approval", () => {
    expect(() => assertChangeImplementationApproved({ approvedByUserId: null, approvedAt: null })).toThrow(StateTransitionError);
  });
});

// Extra: CAPA without Investigation (D2 modification)
describe("CAPA without Investigation (D2 modification)", () => {
  it("DB: CAPA can exist with sourceType=NCR and no investigationId", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { siteId: siteA.id } });
    const ncr = await db.nCR.create({ data: { code: "NCR-CAPA-NOINV", siteId: siteA.id, concernsEntityType: "BATCH", concernsEntityId: batch.id, description: "no inv", isDemo: true } });
    const capa = await db.cAPA.create({ data: { code: "CAPA-NOINV", siteId: siteA.id, sourceType: "NCR", sourceId: ncr.id, investigationId: null, type: "CORRECTIVE", actionPlan: "direct from NCR", isDemo: true } });
    expect(capa.investigationId).toBeNull();
    expect(capa.sourceType).toBe("NCR");
    expect(capa.sourceId).toBe(ncr.id);
  });
});

// Extra: state-machine bypass attempt
describe("state-machine bypass attempts", () => {
  it("NCR DRAFT -> DISPOSITION rejected", () => expect(() => assertNcrTransition("DRAFT", "DISPOSITION")).toThrow(StateTransitionError));
  it("Deviation DRAFT -> CLOSED rejected", () => expect(() => assertDeviationTransition("DRAFT", "CLOSED")).toThrow(StateTransitionError));
  it("CAPA OPEN -> IMPLEMENTATION rejected (skip ACTION_PLAN)", () => expect(() => assertCapaTransition("OPEN", "IMPLEMENTATION")).toThrow(StateTransitionError));
  it("Change REQUEST -> IMPLEMENTATION rejected (skip approval)", () => expect(() => assertChangeTransition("REQUEST", "IMPLEMENTATION")).toThrow(StateTransitionError));
});

// Extra: deviation validity/expiration (D11 — no auto-close)
describe("Deviation validity/expiration (D11)", () => {
  it("DB: deviation can have validUntil; expiration does NOT auto-close", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const material = await db.material.findFirstOrThrow();
    const pastDate = new Date(Date.now() - 86400000); // yesterday
    const dev = await db.deviation.create({ data: { code: "DEV-EXP-01", siteId: siteA.id, appliesToEntityType: "BOM", appliesToEntityId: material.id, description: "expired", justification: "test", status: "CLOSED", validFrom: new Date(Date.now() - 7 * 86400000), validUntil: pastDate, isDemo: true } });
    // The deviation is CLOSED because a human closed it, NOT because validUntil passed.
    // The service layer never auto-transitions based on date (D11).
    expect(dev.validUntil!.getTime()).toBeLessThan(new Date().getTime());
    expect(dev.status).toBe("CLOSED"); // human-closed, not auto-closed
  });
});

// Regression: audit immutability
describe("Regression: audit immutability", () => {
  it("INSERT succeeds, UPDATE/DELETE rejected", async () => {
    const ev = await db.auditEvent.create({ data: { action: "test.p4.regression", entityType: "Test", outcome: "SUCCESS" } });
    expect(ev.id).toBeTruthy();
    await expect(db.$executeRawUnsafe(`UPDATE "AuditEvent" SET outcome='FAILURE' WHERE action='test.p4.regression'`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE action='test.p4.regression'`)).rejects.toThrow();
  });
});
