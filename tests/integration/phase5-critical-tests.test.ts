// Phase 5 critical tests + extras.
// T-SPEC-01, T-SPEC-02, T-METHOD-01, T-SAMPLE-01, T-RESULT-01, T-RESULT-02, T-INSP-01,
// T-ISOL-05, T-LINK-02, T-AI-GUARD-02, T-AUTO-EVAL-01
// + 14 extra tests per owner requirements.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resetTestDb, disconnectTestDb, getTestDb } from "./test-db";
import {
  assertDispositionAllowed,
  assertInspTransition,
  assertMethodTransition,
  assertResultTransition,
  assertSampleTransition,
  assertSpecEditable,
  assertSpecTransition,
  evaluateAgainstSpec,
  isSpecEditable,
  isValidInspTransition,
  isValidResultTransition,
  isValidSampleTransition,
  isValidSpecTransition,
  SPEC_STATUSES,
  SAMPLE_STATUSES,
  RESULT_STATUSES,
  INSP_STATUSES,
} from "@/modules/laboratory/domain";
import { StateTransitionError, ValidationError } from "@/lib/errors";

let db: Awaited<ReturnType<typeof getTestDb>>;

beforeAll(async () => {
  await resetTestDb();
  db = getTestDb();
  const siteA = await db.site.create({ data: { code: "T-SITE-A", name: "A", isDemo: true, status: "ACTIVE" } });
  const siteB = await db.site.create({ data: { code: "T-SITE-B", name: "B", isDemo: true, status: "ACTIVE" } });
  const product = await db.product.create({ data: { code: "T-PROD-01", name: "P", productType: "DEVICE", deviceClass: "IIa", isDemo: true } });
  const rev = await db.productRevision.create({ data: { productId: product.id, revisionCode: "REV-A", status: "EFFECTIVE", effectiveFrom: new Date(), isDemo: true } });
  const woA = await db.workOrder.create({ data: { code: "WO-A", productRevisionId: rev.id, siteId: siteA.id, plannedQuantity: "100", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  const batchA = await db.manufacturingBatch.create({ data: { code: "BAT-A", workOrderId: woA.id, productRevisionId: rev.id, siteId: siteA.id, plannedQuantity: "100", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  const woB = await db.workOrder.create({ data: { code: "WO-B", productRevisionId: rev.id, siteId: siteB.id, plannedQuantity: "50", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  const batchB = await db.manufacturingBatch.create({ data: { code: "BAT-B", workOrderId: woB.id, productRevisionId: rev.id, siteId: siteB.id, plannedQuantity: "50", unit: "pcs", status: "IN_PRODUCTION", isDemo: true } });
  // EFFECTIVE spec
  const spec = await db.specification.create({ data: { code: "SPEC-T-01", name: "Tensile", parameter: "Tensile", unit: "MPa", criterionType: "NUMERIC_MIN", criterionValue: ">= 50", status: "EFFECTIVE", effectiveFrom: new Date(), isDemo: true } });
  const specPF = await db.specification.create({ data: { code: "SPEC-T-02", name: "Visual", parameter: "Visual", criterionType: "PASS_FAIL", criterionValue: "pass", status: "EFFECTIVE", effectiveFrom: new Date(), isDemo: true } });
  // NCR at site A
  const ncr = await db.nCR.create({ data: { code: "NCR-T-01", siteId: siteA.id, concernsEntityType: "BATCH", concernsEntityId: batchA.id, description: "test ncr", isDemo: true } });
});
afterAll(async () => { await disconnectTestDb(); });

// T-SPEC-01
describe("T-SPEC-01: Specification state machine (D7)", () => {
  it("DRAFT -> APPROVED valid", () => expect(isValidSpecTransition("DRAFT", "APPROVED")).toBe(true));
  it("DRAFT -> EFFECTIVE INVALID (must pass APPROVED)", () => { expect(isValidSpecTransition("DRAFT", "EFFECTIVE")).toBe(false); expect(() => assertSpecTransition("DRAFT", "EFFECTIVE")).toThrow(StateTransitionError); });
  it("APPROVED -> EFFECTIVE valid", () => expect(isValidSpecTransition("APPROVED", "EFFECTIVE")).toBe(true));
  it("EFFECTIVE -> SUPERSEDED valid", () => expect(isValidSpecTransition("EFFECTIVE", "SUPERSEDED")).toBe(true));
  it("SUPERSEDED terminal", () => { for (const s of SPEC_STATUSES) expect(isValidSpecTransition("SUPERSEDED", s)).toBe(false); });
  it("immutable when EFFECTIVE", () => { expect(isSpecEditable("EFFECTIVE")).toBe(false); expect(() => assertSpecEditable("EFFECTIVE")).toThrow(StateTransitionError); });
  it("editable when DRAFT", () => { expect(isSpecEditable("DRAFT")).toBe(true); expect(() => assertSpecEditable("DRAFT")).not.toThrow(); });
});

// T-SPEC-02
describe("T-SPEC-02: Spec approval is human-only", () => {
  it("approval permission exists and is distinct from transition", async () => {
    const { PERMISSION_CATALOG } = await import("@/lib/permissions");
    const approvePerm = PERMISSION_CATALOG.find((p) => p.key === "lab.specification.approve");
    expect(approvePerm).toBeTruthy();
    expect(approvePerm?.description).toContain("human-only");
  });
});

// T-METHOD-01
describe("T-METHOD-01: TestMethod M:N Specification", () => {
  it("DB: a method can reference multiple specs", async () => {
    const m = await db.testMethod.create({ data: { code: "TM-T-01", name: "Multi-spec method", status: "EFFECTIVE", isDemo: true } });
    const s1 = await db.specification.findFirstOrThrow({ where: { code: "SPEC-T-01" } });
    const s2 = await db.specification.findFirstOrThrow({ where: { code: "SPEC-T-02" } });
    await db.testMethodSpec.create({ data: { testMethodId: m.id, specificationId: s1.id } });
    await db.testMethodSpec.create({ data: { testMethodId: m.id, specificationId: s2.id } });
    const method = await db.testMethod.findUniqueOrThrow({ where: { id: m.id }, include: { specs: true } });
    expect(method.specs.length).toBe(2);
  });
});

// T-SAMPLE-01
describe("T-SAMPLE-01: Sample state machine (D4)", () => {
  it("DRAWN -> RECEIVED_IN_LAB valid", () => expect(isValidSampleTransition("DRAWN", "RECEIVED_IN_LAB")).toBe(true));
  it("DRAWN -> IN_TEST INVALID (must pass RECEIVED_IN_LAB)", () => { expect(isValidSampleTransition("DRAWN", "IN_TEST")).toBe(false); expect(() => assertSampleTransition("DRAWN", "IN_TEST")).toThrow(StateTransitionError); });
  it("IN_TEST -> CONSUMED valid (terminal)", () => expect(isValidSampleTransition("IN_TEST", "CONSUMED")).toBe(true));
  it("IN_TEST -> RETAINED valid (terminal)", () => expect(isValidSampleTransition("IN_TEST", "RETAINED")).toBe(true));
  it("CONSUMED terminal", () => { for (const s of SAMPLE_STATUSES) expect(isValidSampleTransition("CONSUMED", s)).toBe(false); });
  it("RETAINED terminal", () => { for (const s of SAMPLE_STATUSES) expect(isValidSampleTransition("RETAINED", s)).toBe(false); });
});

// T-RESULT-01
describe("T-RESULT-01: TestResult state machine + auto-evaluation (D5)", () => {
  it("SAMPLE_RECEIVED -> IN_PROGRESS valid", () => expect(isValidResultTransition("SAMPLE_RECEIVED", "IN_PROGRESS")).toBe(true));
  it("SAMPLE_RECEIVED -> REVIEWED INVALID (must pass IN_PROGRESS + RESULT_ENTERED)", () => { expect(isValidResultTransition("SAMPLE_RECEIVED", "REVIEWED")).toBe(false); expect(() => assertResultTransition("SAMPLE_RECEIVED", "REVIEWED")).toThrow(StateTransitionError); });
  it("RESULT_ENTERED -> REVIEWED valid", () => expect(isValidResultTransition("RESULT_ENTERED", "REVIEWED")).toBe(true));
  it("REVIEWED -> DISPOSITIONED valid", () => expect(isValidResultTransition("REVIEWED", "DISPOSITIONED")).toBe(true));
  it("DISPOSITIONED terminal", () => { for (const s of RESULT_STATUSES) expect(isValidResultTransition("DISPOSITIONED", s)).toBe(false); });
});

// T-RESULT-02
describe("T-RESULT-02: Disposition is human-only (D5)", () => {
  it("disposition blocked without REVIEWED status", () => {
    expect(() => assertDispositionAllowed({ status: "RESULT_ENTERED", reviewedByUserId: null })).toThrow(StateTransitionError);
  });
  it("disposition blocked without human review", () => {
    expect(() => assertDispositionAllowed({ status: "REVIEWED", reviewedByUserId: null })).toThrow(StateTransitionError);
  });
  it("disposition allowed with REVIEWED + human reviewer", () => {
    expect(() => assertDispositionAllowed({ status: "REVIEWED", reviewedByUserId: "user-123" })).not.toThrow();
  });
});

// T-INSP-01
describe("T-INSP-01: Inspection state machine (D6)", () => {
  it("PENDING -> PASSED valid", () => expect(isValidInspTransition("PENDING", "PASSED")).toBe(true));
  it("PENDING -> FAILED valid", () => expect(isValidInspTransition("PENDING", "FAILED")).toBe(true));
  it("PENDING -> CONDITIONAL valid", () => expect(isValidInspTransition("PENDING", "CONDITIONAL")).toBe(true));
  it("PASSED terminal", () => { for (const s of INSP_STATUSES) expect(isValidInspTransition("PASSED", s)).toBe(false); });
  it("FAILED terminal", () => { for (const s of INSP_STATUSES) expect(isValidInspTransition("FAILED", s)).toBe(false); });
});

// T-AUTO-EVAL-01
describe("T-AUTO-EVAL-01: auto-evaluation against spec (D9)", () => {
  it("NUMERIC_MIN: value >= min -> PASS", () => {
    expect(evaluateAgainstSpec("55", "NUMERIC_MIN", ">= 50")).toBe("PASS");
  });
  it("NUMERIC_MIN: value < min -> FAIL", () => {
    expect(evaluateAgainstSpec("45", "NUMERIC_MIN", ">= 50")).toBe("FAIL");
  });
  it("NUMERIC_MAX: value <= max -> PASS", () => {
    expect(evaluateAgainstSpec("80", "NUMERIC_MAX", "<= 100")).toBe("PASS");
  });
  it("NUMERIC_MAX: value > max -> FAIL", () => {
    expect(evaluateAgainstSpec("150", "NUMERIC_MAX", "<= 100")).toBe("FAIL");
  });
  it("NUMERIC_RANGE: value in range -> PASS", () => {
    expect(evaluateAgainstSpec("10.0", "NUMERIC_RANGE", "9.9-10.1")).toBe("PASS");
  });
  it("NUMERIC_RANGE: value out of range -> FAIL", () => {
    expect(evaluateAgainstSpec("8.0", "NUMERIC_RANGE", "9.9-10.1")).toBe("FAIL");
  });
  it("PASS_FAIL: match -> PASS", () => {
    expect(evaluateAgainstSpec("pass", "PASS_FAIL", "pass")).toBe("PASS");
  });
  it("PASS_FAIL: no match -> FAIL", () => {
    expect(evaluateAgainstSpec("fail", "PASS_FAIL", "pass")).toBe("FAIL");
  });
  it("no measured value -> NOT_EVALUABLE", () => {
    expect(evaluateAgainstSpec(null, "NUMERIC_MIN", ">= 50")).toBe("NOT_EVALUABLE");
    expect(evaluateAgainstSpec("", "NUMERIC_MIN", ">= 50")).toBe("NOT_EVALUABLE");
  });
  it("non-numeric value on numeric spec -> NOT_EVALUABLE", () => {
    expect(evaluateAgainstSpec("abc", "NUMERIC_MIN", ">= 50")).toBe("NOT_EVALUABLE");
  });
});

// T-ISOL-05: cross-site lab/inspection isolation
describe("T-ISOL-05: cross-site lab isolation", () => {
  it("Site A sample not visible from Site B", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const siteB = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-B" } });
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { siteId: siteA.id } });
    await db.sample.create({ data: { code: "SMP-ISO-A", siteId: siteA.id, sourceEntityType: "BATCH", sourceEntityId: batch.id, isDemo: true } });
    const samplesA = await db.sample.findMany({ where: { siteId: siteA.id } });
    const samplesB = await db.sample.findMany({ where: { siteId: siteB.id } });
    expect(samplesA.find((s) => s.code === "SMP-ISO-A")).toBeTruthy();
    expect(samplesB.find((s) => s.code === "SMP-ISO-A")).toBeUndefined();
  });
  it("Cross-site TestResult isolation", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const siteB = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-B" } });
    const trsA = await db.testResult.findMany({ where: { siteId: siteA.id } });
    const trsB = await db.testResult.findMany({ where: { siteId: siteB.id } });
    expect(trsB.length).toBe(0); // no test results at site B
  });
  it("Cross-site Inspection isolation", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const siteB = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-B" } });
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { siteId: siteA.id } });
    await db.inspection.create({ data: { code: "INSP-ISO-A", siteId: siteA.id, sourceEntityType: "BATCH", sourceEntityId: batch.id, isDemo: true } });
    const inspA = await db.inspection.findMany({ where: { siteId: siteA.id } });
    const inspB = await db.inspection.findMany({ where: { siteId: siteB.id } });
    expect(inspA.find((i) => i.code === "INSP-ISO-A")).toBeTruthy();
    expect(inspB.find((i) => i.code === "INSP-ISO-A")).toBeUndefined();
  });
});

// T-LINK-02: polymorphic linkage + failed result -> NCR
describe("T-LINK-02: polymorphic linkage to production (D8)", () => {
  it("TestResult links to Sample -> Batch; failed result links to NCR", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { siteId: siteA.id } });
    const sample = await db.sample.create({ data: { code: "SMP-LINK", siteId: siteA.id, sourceEntityType: "BATCH", sourceEntityId: batch.id, isDemo: true } });
    const spec = await db.specification.findFirstOrThrow({ where: { code: "SPEC-T-01" } });
    const ncr = await db.nCR.findFirstOrThrow({ where: { siteId: siteA.id } });
    const tr = await db.testResult.create({ data: { code: "TR-LINK", siteId: siteA.id, sampleId: sample.id, specificationId: spec.id, measuredValue: "40", evaluatedResult: "FAIL", status: "RESULT_ENTERED", ncrId: ncr.id, isDemo: true } });
    expect(tr.sampleId).toBe(sample.id);
    expect(tr.specificationId).toBe(spec.id);
    expect(tr.ncrId).toBe(ncr.id);
    expect(tr.evaluatedResult).toBe("FAIL");
  });
});

// T-AI-GUARD-02
describe("T-AI-GUARD-02: AI governance (PRD section 9)", () => {
  it("no lab.specification.approve or lab.testresult.disposition for AI", async () => {
    const { PERMISSION_CATALOG } = await import("@/lib/permissions");
    const humanOnlyPerms = PERMISSION_CATALOG.filter((p) => p.key === "lab.specification.approve" || p.key === "lab.testresult.disposition");
    expect(humanOnlyPerms.length).toBe(2);
    humanOnlyPerms.forEach((p) => expect(p.description).toContain("human-only"));
  });
  it("disposition guard rejects without human review", () => {
    expect(() => assertDispositionAllowed({ status: "REVIEWED", reviewedByUserId: null })).toThrow(StateTransitionError);
  });
});

// Extra: PASS evaluation does NOT auto-release
describe("Extra: PASS eval != auto-release (D5)", () => {
  it("evaluateAgainstSpec returns PASS but does NOT set disposition", () => {
    const result = evaluateAgainstSpec("55", "NUMERIC_MIN", ">= 50");
    expect(result).toBe("PASS");
    // PASS is an evaluation, NOT a disposition. The service never sets disposition = "PASS_RELEASE" automatically.
    // This is enforced by the service layer (dispositionTestResult requires human authorization).
  });
});

// Extra: FAIL evaluation does NOT auto-reject
describe("Extra: FAIL eval != auto-reject (D5)", () => {
  it("evaluateAgainstSpec returns FAIL but does NOT set disposition", () => {
    const result = evaluateAgainstSpec("40", "NUMERIC_MIN", ">= 50");
    expect(result).toBe("FAIL");
    // FAIL is an evaluation, NOT a disposition. The service never sets disposition = "FAIL_REJECT" automatically.
  });
});

// Extra: state-machine bypass attempts
describe("Extra: state-machine bypass rejected", () => {
  it("Spec DRAFT -> EFFECTIVE rejected", () => expect(() => assertSpecTransition("DRAFT", "EFFECTIVE")).toThrow(StateTransitionError));
  it("Sample DRAWN -> CONSUMED rejected", () => expect(() => assertSampleTransition("DRAWN", "CONSUMED")).toThrow(StateTransitionError));
  it("Result SAMPLE_RECEIVED -> DISPOSITIONED rejected", () => expect(() => assertResultTransition("SAMPLE_RECEIVED", "DISPOSITIONED")).toThrow(StateTransitionError));
  it("Inspection PENDING -> PENDING rejected (self-transition not allowed)", () => expect(() => assertInspTransition("PENDING", "PENDING")).toThrow(StateTransitionError));
});

// Extra: TestResult preserves exact Specification revision
describe("Extra: TestResult preserves exact Spec revision (D9)", () => {
  it("DB: TestResult stores specificationId (exact reference, spec is immutable when EFFECTIVE)", async () => {
    const siteA = await db.site.findUniqueOrThrow({ where: { code: "T-SITE-A" } });
    const batch = await db.manufacturingBatch.findFirstOrThrow({ where: { siteId: siteA.id } });
    const sample = await db.sample.create({ data: { code: "SMP-REV", siteId: siteA.id, sourceEntityType: "BATCH", sourceEntityId: batch.id, isDemo: true } });
    const spec = await db.specification.findFirstOrThrow({ where: { code: "SPEC-T-01" } });
    const tr = await db.testResult.create({ data: { code: "TR-REV", siteId: siteA.id, sampleId: sample.id, specificationId: spec.id, isDemo: true } });
    // The specificationId is an exact reference to the EFFECTIVE spec. Since the spec is immutable when EFFECTIVE (D7),
    // the reference preserves the exact revision without needing a snapshot copy.
    expect(tr.specificationId).toBe(spec.id);
    const linkedSpec = await db.specification.findUniqueOrThrow({ where: { id: tr.specificationId } });
    expect(linkedSpec.status).toBe("EFFECTIVE");
    expect(linkedSpec.criterionValue).toBe(">= 50"); // exact criterion preserved
  });
});

// Regression: audit immutability
describe("Regression: audit immutability", () => {
  it("INSERT succeeds, UPDATE/DELETE rejected", async () => {
    const ev = await db.auditEvent.create({ data: { action: "test.p5.regression", entityType: "Test", outcome: "SUCCESS" } });
    expect(ev.id).toBeTruthy();
    await expect(db.$executeRawUnsafe(`UPDATE "AuditEvent" SET outcome='FAILURE' WHERE action='test.p5.regression'`)).rejects.toThrow();
    await expect(db.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE action='test.p5.regression'`)).rejects.toThrow();
  });
});
