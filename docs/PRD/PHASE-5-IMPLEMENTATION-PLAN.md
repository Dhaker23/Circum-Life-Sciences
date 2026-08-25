# CIRCUM — PHASE 5 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 5 — Quality / Inspection / Laboratory / Specifications / Testing
> **Predecessor:** Phase 4 (approved/closed). Builds on Quality (NCR/CAPA) + Production (Batch/DeviceLot/MaterialLot) + Manufacturing (Product/Revision/Material).
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only). Implementation gated on owner approval of this plan AND the domain decisions in §3.
> **Source of truth:** Circum Master PRD §5 (Laboratory: Product/Lot → Sample → Test → Method → Specification → Result → Review → Disposition; "Never invent specifications"), §5 (Quality/QMS: inspection), §9 (AI governance — AI must never override specifications), §10 (Traceability: Inspection/Testing in genealogy), §16 (Docs), §17 (Validation-minded), §19/§20 (Phase Gate/Report). GLM Master Prompt §9 (Controlled Workflows).
> **Scope rule (owner):** Phase 5 = Laboratory/Testing/Inspection/Specifications. No Equipment/Calibration (Phase 8), no Cleanroom (Phase 9), no Packaging/Sterilization (Phase 9), no Batch Review/Release (Phase 9), no OEE/VSM (Phase 10), no AI (Phase 12), no Document Control subsystem (Phase 7 — Phase 5 stores document references only).
> **Critical owner constraint:** "Never invent specifications." "Never invent acceptance criteria." Do NOT invent terminology or entities. If a decision affects data model / state machine / traceability / regulatory workflow / authorization / site isolation / auditability, STOP and ask.

---

## 0. Reading guide

§1 Objectives. §2 PRD traceability. **§3 Domain model (the core) + 8 critical ambiguities (D1-D8) requiring owner confirmation.** §4 Proposed schema (pending §3). §5 API design. §6 UI architecture. §7 Security/Audit. §8 Multi-site. §9 Testing. §10 Migration. §11 Skills. §12 Files. §13 Risks. §14 Dependencies. §15 Acceptance. §16 Test plan. §17 Open questions.

```
PHASE 5 PLAN STATUS: WAITING FOR OWNER APPROVAL (and §3 domain decisions D1-D8)
```

---

## 1. Objectives

Phase 5 establishes the **Laboratory, Inspection, and Testing domain**: the controlled records that capture what was tested, how it was tested, against what acceptance criteria, what the result was, and what disposition was decided. This connects Quality to the physical testing of production output and materials.

The PRD §5 Laboratory workflow: `Product/Lot → Sample → Test → Method → Specification → Result → Review → Disposition`. Phase 5 implements this chain as controlled records, with traceability to the production entity (Batch/DeviceLot/MaterialLot) and linkage to NCR (a failed result can trigger an NCR).

**Concrete objectives:**

1. **Specification** — the controlled acceptance criterion for a test (pass/fail threshold, numeric range, etc.). Never invented by software; configurable; never overridden by AI (PRD §9).
2. **Test Method** — the controlled procedure for performing a test (what to measure, how, with what equipment). Distinct from Specification (method = how; spec = what's acceptable).
3. **Sample** — a physical sample drawn from a production entity (Batch/DeviceLot/MaterialLot) for testing.
4. **Test Result** — the measured value/outcome of performing a Test Method on a Sample, evaluated against a Specification. Has a pass/fail or measured value + a review + disposition.
5. **Inspection** — an in-process or final quality check on the shop floor (distinct from a formal Laboratory Test; simpler, often pass/fail against a spec).
6. **Review + Disposition** — the authorized human review of a result and the decision on the sample/lot (pass → release for next step; fail → NCR/hold/rework).
7. **Full RBAC + audit + multi-site** — reuse Phase 1-4 infrastructure; new `lab.*` / `inspection.*` permissions; Samples/Results are site-scoped; every review/disposition audited.
8. **AI governance (PRD §9)** — AI may suggest hypotheses about results but must NEVER override specifications, approve a disposition, or close a test result.

**Out of scope (explicit):** Equipment/Calibration (Phase 8 — Phase 5 records which Equipment was used via a reference, but no Equipment master), Cleanroom Monitoring (Phase 9), Packaging/Sterilization (Phase 9), Batch Review/Release (Phase 9 — Phase 5 produces test results that Batch Review will consume, but does not release batches), OEE/VSM (Phase 10), AI Assistant (Phase 12), Document Control subsystem (Phase 7 — Test Methods store a document reference, not a controlled document lifecycle), Training (Phase 7), Supplier Quality/Audits (Phase 7).

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 5 coverage |
|---|---|---|---|
| R1 | Laboratory: Product/Lot → Sample → Test → Method → Specification → Result → Review → Disposition | §5 | Full chain implemented |
| R2 | Never invent specifications | §5 | Specifications are configurable data, never hard-coded, never AI-generated |
| R3 | Never invent acceptance criteria | §5, §17 | Specs are user-defined; the system validates results against them but does not create them |
| R4 | Inspection (in-process or final) | §5, §10 | Inspection entity (simpler than lab test; shop-floor pass/fail) |
| R5 | AI must never override specifications | §9 | AI gets read-only + suggest perms only; no spec.override or result.approve perm |
| R6 | Traceability: Inspection/Testing in genealogy | §10 | Results link to Batch/DeviceLot/MaterialLot; queryable for genealogy |
| R7 | Controlled records: unique ID, status, owner, evidence, audit trail, closure criteria | §5 | all Phase 5 entities carry these |
| R8 | Every controlled transition: authorize + validate + record actor/timestamp + audit + preserve history | §9, GLM §9 | explicit /transition endpoints, audited, state-machine-guarded |
| R9 | DB constraints prevent duplicates, broken refs, unauthorized transitions | §10, §11 | FKs, uniques, state-machine guards |
| R10 | Normal users cannot edit/delete audit history | §10, §13 | reuse Phase 1 audit (append-only) |
| R11 | Layered architecture; critical logic not only in UI | §11 | modules/laboratory/{api,service,domain,infrastructure} |
| R12 | Local-first | §12 | all local DB |
| R13 | FR/EN/AR + RTL | §4 | next-intl catalogs extended |
| R14 | Professional industrial UI | §14 | lab/inspection pages |
| R15 | Phase Gate (§19) + Phase Validation Report (§20) | §19, §20 | full gate |
| R16 | PostgreSQL-portable (ADR-0002) | §11, ADR-0002 | no SQLite-only types |

---

## 3. Domain model (grill-with-docs + domain-modeling)

> This is the heart of Phase 5. Terms are extracted from the PRD (§5, §9, §10) and sharpened via the `domain-modeling` discipline. **The owner directed: "Never invent specifications. Never invent acceptance criteria. Do NOT invent terminology or entities. If a decision affects data model / state machine / traceability / regulatory workflow / authorization / site isolation / auditability, STOP and ask."** Where the PRD is silent on a precise boundary, the resolution is marked PROPOSED and requires owner confirmation (§3.9).

### 3.1 Inspection vs Laboratory Test (D1 — CRITICAL)

**PRD evidence:** §5 Quality/QMS lists "inspection" separately from the Laboratory module. §10 genealogy says "Inspection/Testing." CONTEXT.md: "Inspection = a quality check (in-process or final)"; "Test/Test Method = a laboratory or in-process examination."

**Ambiguity:** Are Inspection and Laboratory Test the same entity with a type field, or separate entities?

**Proposed resolution (D1):** **Separate entities**, because they have different workflows and actors:
- **Inspection**: a shop-floor quality check (in-process or final), performed by an Operator/Inspector at the point of production. Simple: pass/fail (optionally with a measured value) against a Specification. Does not require a formal Sample (the item is inspected in-place). State: `PENDING → PASSED / FAILED / CONDITIONAL`. Links to a Batch/DeviceLot/OperationExecution.
- **Laboratory Test (TestResult)**: a formal laboratory examination of a **Sample** by a Lab Technician, following a **Test Method**, producing a measured **Result** evaluated against a **Specification**, with a formal review + disposition workflow. State: `SAMPLE_RECEIVED → IN_PROGRESS → RESULT_ENTERED → REVIEWED → DISPOSITIONED`.

**Key distinction:** Inspection = quick shop-floor check (no sample, no method); Laboratory Test = formal lab examination (sample, method, result, review, disposition). An Inspection failure may trigger an NCR; a Lab Test failure may trigger an NCR. Both evaluate against Specifications.

**If the owner prefers a single entity:** a "QualityCheck" with a type field. Rejected — the workflows differ (Inspection has no Sample/Method; Lab Test has a formal review/disposition). **Please confirm D1.**

### 3.2 Specification ownership (D2 — CRITICAL)

**PRD evidence:** §5 "Never invent specifications"; §5 Laboratory chain includes "Specification"; CONTEXT.md "Specification = the controlled acceptance criterion for a Test."

**Ambiguity:** Where does a Specification live? Options:
- (a) On a Product Revision (like BOM/Routing — a revision defines what specs apply).
- (b) On a Material (incoming material specs).
- (c) On a Test Method (a method defines what it measures + the acceptance criterion).
- (d) Standalone (a catalog of specs, referenced by tests/inspections).

**Proposed resolution (D2):** **Standalone entity, referenced polymorphically.** A **Specification** is a controlled record with: `code`, `name`, `parameter` (what's being measured, e.g., "Tensile Strength"), `unit` (e.g., "MPa"), `criterionType` (PASS_FAIL / NUMERIC_RANGE / NUMERIC_MIN / NUMERIC_MAX / TEXT_MATCH), `criterionValue` (e.g., "≥ 50", "pass", "red"), `status` (DRAFT → APPROVED → EFFECTIVE → SUPERSEDED, like a controlled document). It is referenced by a Test Method or directly by a Test Result / Inspection. Rationale:
- Specs can apply to products, materials, or processes — putting them on one entity is too narrow.
- A Test Method may reference one or more Specs (a method measures multiple parameters).
- Standalone makes specs reusable across tests/inspections.
- The controlled-revision pattern (DRAFT → APPROVED → EFFECTIVE) matches "never invent" — a spec is a controlled, approved record.

**If the owner prefers specs on Product Revision:** would work for product specs but not material/process specs. **Please confirm D2 (standalone + polymorphic reference, or on Product Revision).**

### 3.3 Test Method vs Specification (D3)

**PRD evidence:** §5 Laboratory chain: "Test → Method → Specification." These are listed as separate steps, implying separate concepts.

**Proposed resolution (D3):** **Separate entities.**
- **Test Method**: the controlled *procedure* (how to test). Fields: `code`, `name`, `description`, `equipmentType?` (what kind of equipment is needed — string ref, not Equipment entity since Equipment is Phase 8), `documentRef?` (string ref to the procedure document; Phase 7 adds ControlledDocument FK), `status` (DRAFT → APPROVED → EFFECTIVE → SUPERSEDED). Global (like Product — methods are shared across sites).
- **Specification**: the controlled *acceptance criterion* (what's acceptable). See D2.
- A Test Method references one or more Specifications (a method may measure multiple parameters, each with its own acceptance criterion). Or a Test Result may reference a Specification directly (an inspection may check against a spec without a formal method).

**Please confirm D3 (Method and Spec are separate; a Method references Specs).**

### 3.4 Sample lifecycle (D4)

**PRD evidence:** §5 "Product/Lot → Sample"; the sample is drawn from a production entity for testing.

**Proposed resolution (D4):**
- **Sample**: a physical sample drawn from a production entity. Fields: `code` (unique per site), `siteId`, `sourceEntityType` (BATCH / DEVICE_LOT / MATERIAL_LOT), `sourceEntityId`, `drawnByUserId?`, `drawnAt`, `quantity?`, `unit?`, `status` (DRAWN → RECEIVED_IN_LAB → IN_TEST → CONSUMED / RETAINED), `isDemo`. Site-owned.
- State machine: `DRAWN → RECEIVED_IN_LAB → IN_TEST → CONSUMED` (terminal) or `RETAINED` (kept for future reference; terminal for the active test but sample preserved).
- A Sample can have multiple TestResults (one sample may be tested for multiple parameters).

**Please confirm D4.**

### 3.5 Test Result state machine + disposition (D5)

**PRD evidence:** §5 "Result → Review → Disposition."

**Proposed resolution (D5):**
```
SAMPLE_RECEIVED → IN_PROGRESS → RESULT_ENTERED → REVIEWED → DISPOSITIONED
                                                    ↓
                                              FAILED (auto-evaluated if result doesn't meet spec)
```
- `SAMPLE_RECEIVED`: sample received in lab, test not started.
- `IN_PROGRESS`: test is being performed.
- `RESULT_ENTERED`: the measured value is entered; the system auto-evaluates pass/fail against the Specification.
- `REVIEWED`: a Lab Technician / QA reviewer has reviewed the result. If pass → can proceed to DISPOSITIONED (release). If fail → must link to an NCR before DISPOSITIONED.
- `DISPOSITIONED`: the final disposition is recorded (PASS_RELEASE / FAIL_HOLD / FAIL_REJECT / CONDITIONAL_RELEASE). **Requires authorized human action.** AI must never disposition (PRD §9).
- `FAILED` is not a separate state — it's an evaluation flag on the result. The state machine is about the workflow, not the pass/fail.

**Disposition options:** PASS_RELEASE (conforms; release), FAIL_HOLD (does not conform; hold for investigation/NCR), FAIL_REJECT (does not conform; reject), CONDITIONAL_RELEASE (conforms with conditions; requires justification).

**Please confirm D5.**

### 3.6 Inspection state machine (D6)

**Proposed resolution (D6):**
```
PENDING → PASSED / FAILED / CONDITIONAL
```
- `PENDING`: inspection scheduled/not yet performed.
- `PASSED`: conforms to spec.
- `FAILED`: does not conform; may trigger NCR.
- `CONDITIONAL`: passed with conditions (requires notes).
- Simple state machine (no review/disposition workflow — that's for formal Lab Tests). The Inspector records the result; if failed, an NCR may be raised.

**Please confirm D6.**

### 3.7 Specification state machine + immutability (D7)

**Proposed resolution (D7):**
```
DRAFT → APPROVED → EFFECTIVE → SUPERSEDED
```
- `DRAFT`: spec created, not yet approved.
- `APPROVED`: approved by QA (human-only; AI must never approve a spec — PRD §9 "never override specifications").
- `EFFECTIVE`: in use. Immutable once EFFECTIVE (like BOM/Routing, ADR-0006 pattern). Any change requires a new Specification (via Change Control, Phase 4).
- `SUPERSEDED`: replaced by a newer EFFECTIVE spec.
- Only EFFECTIVE specs can be referenced by active Tests/Inspections.

**Please confirm D7.**

### 3.8 Site ownership (D8)

**Proposed resolution (D8):**
- **GLOBAL (no siteId):** Specification, TestMethod (shared catalog, like Product/Material).
- **SITE-OWNED (siteId required, SiteScope enforced):** Sample, TestResult, Inspection (physical records at a site).
- Cross-site leakage of Samples/Results/Inspections = CRITICAL defect (consistent with all prior phases).

**Please confirm D8.**

### 3.9 Summary of proposed domain decisions (all require owner confirmation)

| # | Decision | Proposed | Alternative | Recommendation |
|---|---|---|---|---|
| D1 | Inspection vs Laboratory Test | Separate entities (Inspection = shop-floor check, no sample/method; Lab Test = formal lab examination with sample/method/result/review/disposition) | Single QualityCheck with type | **Proposed** (different workflows) |
| D2 | Specification ownership | Standalone entity, referenced polymorphically (by Method or directly by Result/Inspection) | On Product Revision | **Proposed** (specs apply to products, materials, processes) |
| D3 | Test Method vs Specification | Separate entities (Method = how to test; Spec = what's acceptable). A Method references Specs. | Combined | **Proposed** (PRD lists them as separate steps) |
| D4 | Sample lifecycle | DRAWN→RECEIVED_IN_LAB→IN_TEST→CONSUMED/RETAINED. A Sample can have multiple TestResults. | Simpler | **Proposed** |
| D5 | Test Result state machine + disposition | SAMPLE_RECEIVED→IN_PROGRESS→RESULT_ENTERED→REVIEWED→DISPOSITIONED. Disposition: PASS_RELEASE/FAIL_HOLD/FAIL_REJECT/CONDITIONAL_RELEASE. AI must never disposition. | Simpler | **Proposed** |
| D6 | Inspection state machine | PENDING→PASSED/FAILED/CONDITIONAL (simple; no review/disposition workflow) | Same as Lab Test | **Proposed** (shop-floor checks are simpler) |
| D7 | Specification state machine + immutability | DRAFT→APPROVED→EFFECTIVE→SUPERSEDED. Immutable when EFFECTIVE (like BOM). AI must never approve a spec. | No state machine | **Proposed** (controlled record) |
| D8 | Site ownership | GLOBAL: Specification, TestMethod. SITE-OWNED: Sample, TestResult, Inspection. | All global / all site-owned | **Proposed** (consistent with prior phases) |

**If any of D1–D8 is not confirmed, the schema in §4 cannot be finalized.** I will NOT implement until these are resolved.

### 3.10 Entity definitions (assuming D1–D8 as proposed)

- **Specification** — controlled acceptance criterion. GLOBAL. Fields: `code` (unique), `name`, `parameter`, `unit?`, `criterionType` (PASS_FAIL / NUMERIC_RANGE / NUMERIC_MIN / NUMERIC_MAX / TEXT_MATCH), `criterionValue` (string, e.g., "≥ 50", "pass"), `status` (D7 state machine), `approvedByUserId?`, `approvedAt?`, `effectiveFrom?`, `supersededById?`, `isDemo`. Global.
- **TestMethod** — controlled test procedure. GLOBAL. Fields: `code` (unique), `name`, `description`, `equipmentType?` (string ref, not Equipment entity), `documentRef?` (string; Phase 7 adds ControlledDocument FK), `status` (DRAFT→APPROVED→EFFECTIVE→SUPERSEDED), `isDemo`. Global. Has many TestMethodSpec (join to Specification).
- **TestMethodSpec** — join: TestMethod M:N Specification. Fields: `testMethodId`, `specificationId`.
- **Sample** — physical sample drawn from production. SITE-OWNED. Fields: `code` (unique per site), `siteId`, `sourceEntityType` (BATCH/DEVICE_LOT/MATERIAL_LOT), `sourceEntityId`, `drawnByUserId?`, `drawnAt`, `quantity?`, `unit?`, `status` (D4 state machine), `isDemo`.
- **TestResult** — formal lab test result. SITE-OWNED. Fields: `code` (unique per site), `siteId`, `sampleId`, `testMethodId?`, `specificationId`, `performedByUserId?`, `performedAt?`, `measuredValue?`, `unit?`, `evaluatedResult` (PASS/FAIL/CONDITIONAL — auto-evaluated against spec), `status` (D5 state machine), `reviewedByUserId?`, `reviewedAt?`, `disposition` (PASS_RELEASE/FAIL_HOLD/FAIL_REJECT/CONDITIONAL_RELEASE), `dispositionedByUserId?`, `dispositionedAt?`, `dispositionNotes?`, `ncrId?` (link to NCR if failed), `evidenceDocumentRef?`, `isDemo`.
- **Inspection** — shop-floor quality check. SITE-OWNED. Fields: `code` (unique per site), `siteId`, `inspectionType` (IN_PROCESS / FINAL / RECEIVING), `sourceEntityType` (BATCH/DEVICE_LOT/MATERIAL_LOT/OPERATION_EXECUTION), `sourceEntityId`, `specificationId?`, `inspectorEmployeeId?` (D4 pattern from Phase 3: Employee, not User), `loggedByUserId?`, `measuredValue?`, `unit?`, `evaluatedResult` (PASS/FAIL/CONDITIONAL), `status` (D6 state machine), `notes?`, `ncrId?` (link to NCR if failed), `performedAt`, `isDemo`.

---

## 4. Database schema (proposed, pending §3 confirmation)

PG-portable Prisma additions. No SQLite-only types. Additive to Phase 1-4.

```prisma
// ============================================================================
// Laboratory / Inspection / Testing (Phase 5)
// D1: Inspection (shop-floor) != Lab Test (formal). D2: Specification standalone.
// D3: TestMethod != Specification. D7: Spec immutable when EFFECTIVE (like BOM).
// D8: GLOBAL: Specification, TestMethod. SITE-OWNED: Sample, TestResult, Inspection.
// PRD section 5: Never invent specifications. AI must never override specs (section 9).
// ============================================================================

model Specification {
  id              String   @id @default(cuid())
  code            String   @unique
  name            String
  parameter       String // what's being measured (e.g., "Tensile Strength")
  unit            String? // e.g., "MPa"
  criterionType   String   @default("PASS_FAIL") // PASS_FAIL | NUMERIC_RANGE | NUMERIC_MIN | NUMERIC_MAX | TEXT_MATCH
  criterionValue  String // e.g., ">= 50", "pass", "red"
  status          String   @default("DRAFT") // DRAFT | APPROVED | EFFECTIVE | SUPERSEDED (D7)
  approvedByUserId String?
  approvedAt      DateTime?
  effectiveFrom   DateTime?
  supersededById  String?
  isDemo          Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  approver     User?           @relation("SpecApprover", fields: [approvedByUserId], references: [id], onDelete: SetNull)
  supersededBy Specification?  @relation("SpecSupersession", fields: [supersededById], references: [id], onDelete: NoAction)
  supersededByThis Specification[] @relation("SpecSupersession")
  methodSpecs   TestMethodSpec[]
  testResults   TestResult[]
  inspections   Inspection[]

  @@index([status])
  @@index([parameter])
}

model TestMethod {
  id            String   @id @default(cuid())
  code          String   @unique
  name          String
  description   String?
  equipmentType String? // string ref (Equipment master is Phase 8)
  documentRef   String? // D9: string ref; Phase 7 adds ControlledDocument FK
  status        String   @default("DRAFT") // DRAFT | APPROVED | EFFECTIVE | SUPERSEDED
  isDemo        Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  specs       TestMethodSpec[]
  testResults TestResult[]

  @@index([status])
}

model TestMethodSpec {
  testMethodId    String
  specificationId String
  createdAt       DateTime @default(now())

  testMethod    TestMethod    @relation(fields: [testMethodId], references: [id], onDelete: Cascade)
  specification Specification @relation(fields: [specificationId], references: [id], onDelete: Cascade)

  @@id([testMethodId, specificationId])
  @@index([specificationId])
}

model Sample {
  id               String   @id @default(cuid())
  code             String // unique per site
  siteId           String // SITE-OWNED (D8)
  sourceEntityType String // BATCH | DEVICE_LOT | MATERIAL_LOT
  sourceEntityId   String
  drawnByUserId    String?
  drawnAt          DateTime @default(now())
  quantity         Decimal?
  unit             String?
  status           String   @default("DRAWN") // DRAWN | RECEIVED_IN_LAB | IN_TEST | CONSUMED | RETAINED (D4)
  isDemo           Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  site        Site         @relation(fields: [siteId], references: [id], onDelete: Restrict)
  drawnBy     User?        @relation("SampleDrawnBy", fields: [drawnByUserId], references: [id], onDelete: SetNull)
  testResults TestResult[]

  @@unique([siteId, code])
  @@index([siteId])
  @@index([sourceEntityType, sourceEntityId])
  @@index([status])
}

model TestResult {
  id                    String   @id @default(cuid())
  code                  String // unique per site
  siteId                String // SITE-OWNED (D8)
  sampleId              String
  testMethodId          String?
  specificationId       String
  performedByUserId     String?
  performedAt           DateTime?
  measuredValue         String? // the measured value (string to support text/numeric)
  unit                  String?
  evaluatedResult       String? // PASS | FAIL | CONDITIONAL (auto-evaluated against spec)
  status                String   @default("SAMPLE_RECEIVED") // SAMPLE_RECEIVED | IN_PROGRESS | RESULT_ENTERED | REVIEWED | DISPOSITIONED (D5)
  reviewedByUserId      String?
  reviewedAt            DateTime?
  disposition           String? // PASS_RELEASE | FAIL_HOLD | FAIL_REJECT | CONDITIONAL_RELEASE
  dispositionedByUserId String?
  dispositionedAt       DateTime?
  dispositionNotes      String?
  ncrId                 String? // link to NCR if failed (Phase 4)
  evidenceDocumentRef   String?
  isDemo                Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  site           Site          @relation(fields: [siteId], references: [id], onDelete: Restrict)
  sample         Sample        @relation(fields: [sampleId], references: [id], onDelete: Restrict)
  testMethod     TestMethod?   @relation(fields: [testMethodId], references: [id], onDelete: SetNull)
  specification  Specification @relation(fields: [specificationId], references: [id], onDelete: Restrict)
  performedBy    User?         @relation("TestPerformedBy", fields: [performedByUserId], references: [id], onDelete: SetNull)
  reviewedBy     User?         @relation("TestReviewedBy", fields: [reviewedByUserId], references: [id], onDelete: SetNull)
  dispositionedBy User?        @relation("TestDispositionedBy", fields: [dispositionedByUserId], references: [id], onDelete: SetNull)
  ncr            NCR?          @relation("TestResultNcr", fields: [ncrId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([siteId])
  @@index([sampleId])
  @@index([status])
  @@index([evaluatedResult])
}

model Inspection {
  id                   String   @id @default(cuid())
  code                 String // unique per site
  siteId               String // SITE-OWNED (D8)
  inspectionType       String   @default("IN_PROCESS") // IN_PROCESS | FINAL | RECEIVING
  sourceEntityType     String // BATCH | DEVICE_LOT | MATERIAL_LOT | OPERATION_EXECUTION
  sourceEntityId       String
  specificationId      String?
  inspectorEmployeeId  String? // D4 pattern: Employee (not User)
  loggedByUserId       String? // the authenticated User who logged the record
  measuredValue        String?
  unit                 String?
  evaluatedResult      String? // PASS | FAIL | CONDITIONAL
  status               String   @default("PENDING") // PENDING | PASSED | FAILED | CONDITIONAL (D6)
  notes                String?
  ncrId                String? // link to NCR if failed (Phase 4)
  performedAt          DateTime @default(now())
  isDemo               Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  site          Site          @relation(fields: [siteId], references: [id], onDelete: Restrict)
  specification Specification? @relation(fields: [specificationId], references: [id], onDelete: SetNull)
  inspector     Employee?     @relation("InspectionInspector", fields: [inspectorEmployeeId], references: [id], onDelete: SetNull)
  logger        User?         @relation("InspectionLogger", fields: [loggedByUserId], references: [id], onDelete: SetNull)
  ncr           NCR?          @relation("InspectionNcr", fields: [ncrId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([siteId])
  @@index([status])
  @@index([sourceEntityType, sourceEntityId])
}
```

**Relation additions to existing models:** `NCR` gets `testResults TestResult[] @relation("TestResultNcr")` + `inspections Inspection[] @relation("InspectionNcr")` (reverse of the ncrId links). `Site` gets `samples[]`, `testResults[]`, `inspections[]`. `User` gets the named relation arrays. `Employee` gets `inspections[]`.

---

## 5. API design

New permission modules `lab.*` and `inspection.*`. Thin handlers, zod-validated, envelope, RBAC-guarded. Explicit `/transition` endpoints for state machines.

```
# Specifications (global, controlled)
GET    /api/lab/specifications
POST   /api/lab/specifications
GET    /api/lab/specifications/:id
POST   /api/lab/specifications/:id/transition    (DRAFT->APPROVED->EFFECTIVE->SUPERSEDED; human-only approval)

# Test Methods (global, controlled)
GET    /api/lab/test-methods
POST   /api/lab/test-methods
GET    /api/lab/test-methods/:id
POST   /api/lab/test-methods/:id/transition      (DRAFT->APPROVED->EFFECTIVE->SUPERSEDED)
POST   /api/lab/test-methods/:id/specs            (link a Specification)

# Samples (site-owned)
GET    /api/lab/samples
POST   /api/lab/samples                           (draw a sample)
GET    /api/lab/samples/:id
POST   /api/lab/samples/:id/transition            (DRAWN->RECEIVED_IN_LAB->IN_TEST->CONSUMED/RETAINED)

# Test Results (site-owned, formal lab tests)
GET    /api/lab/test-results
POST   /api/lab/test-results                      (create against a sample)
GET    /api/lab/test-results/:id
POST   /api/lab/test-results/:id/transition       (SAMPLE_RECEIVED->IN_PROGRESS->RESULT_ENTERED->REVIEWED->DISPOSITIONED)
POST   /api/lab/test-results/:id/disposition      (PASS_RELEASE/FAIL_HOLD/FAIL_REJECT/CONDITIONAL_RELEASE; human-only)

# Inspections (site-owned, shop-floor)
GET    /api/inspection/inspections
POST   /api/inspection/inspections                (record an inspection)
GET    /api/inspection/inspections/:id
POST   /api/inspection/inspections/:id/transition (PENDING->PASSED/FAILED/CONDITIONAL)
```

**Controlled transitions:** every `/transition` validates state machine, authorizes via `requirePermission`, records actor, emits AuditEvent. **Specification approval** is human-only (AI must never approve a spec — PRD §9). **Test Result disposition** is human-only (AI must never disposition — PRD §9).

**Auto-evaluation:** when a TestResult transitions to RESULT_ENTERED with a `measuredValue`, the service auto-evaluates `evaluatedResult` (PASS/FAIL) against the Specification's `criterionType` + `criterionValue`. The system does NOT invent the specification — it evaluates against the user-defined spec.

---

## 6. UI architecture

New pages under `[locale]/(app)/`:
- `lab/specifications/` — spec list (status badges, criterion type/value), create, transition buttons.
- `lab/test-methods/` — method list (status badges, linked specs), create, transition.
- `lab/samples/` — sample list (site-scoped, status badges, source entity), create, transition.
- `lab/test-results/` — result list (site-scoped, evaluated result badge, disposition badge), create, transition, disposition.
- `inspection/inspections/` — inspection list (site-scoped, type, result badge), create, transition.

**Nav:** add "Laboratory" group (Specifications, Test Methods, Samples, Test Results) + "Inspection" item (or under Quality group) to sidebar, permission-gated.

**i18n:** extend catalogs with `lab.*` + `inspection.*` keys (FR/EN/AR). RTL-safe.

**Demo seed:** add to `prisma/seed.ts`: 3-4 demo Specifications (Tensile Strength ≥ 50 MPa, Dimensional ±0.1mm, Visual pass/fail, Bioburden ≤ 100 CFU), 2 Test Methods (Tensile Test, Visual Inspection) linked to specs, 2 Samples (from BATCH-CH-001), 2 TestResults (one PASS, one FAIL → linked to NCR-CH-001), 2 Inspections (one IN_PROCESS PASSED, one FINAL FAILED). All `isDemo: true`.

---

## 7. Security & audit

- **Permissions:** new `lab.*` + `inspection.*` catalog: `lab.specification.{read,create,transition,approve}`, `lab.testmethod.{read,create,transition}`, `lab.sample.{read,create,transition}`, `lab.testresult.{read,create,transition,disposition}`, `inspection.{read,create,transition}`. Least-privilege grants (Lab Technician create results; QA Reviewer review+disposition; Quality Manager approve specs; Operator create inspections; Auditor read-only).
- **3-layer enforcement** (reuse Phase 1).
- **AI governance (PRD §9):** no `lab.specification.approve`, `lab.testresult.disposition`, or controlled `lab.*.transition` / `inspection.*.transition` permission for AI. AI may suggest hypotheses about results but must NEVER approve specs, disposition results, or override specifications.
- **Audit:** every create/transition/approve/disposition emits AuditEvent with previousState/newState + reason.
- **Specification immutability (D7):** once EFFECTIVE, a spec cannot be edited (like BOM, ADR-0006). Any change requires a new spec (via Change Control, Phase 4).

---

## 8. Multi-site (site scope)

- **GLOBAL:** Specification, TestMethod (shared catalog, no siteId).
- **SITE-OWNED:** Sample, TestResult, Inspection (siteId required, SiteScope + assertSiteAccess).
- Cross-site leakage of Samples/Results/Inspections = CRITICAL defect.
- Quality-to-production polymorphic references (sourceEntityType + sourceEntityId) validated at service layer (entity exists, same site, cross-site rejected — same pattern as Phase 4 D8).

---

## 9. Testing

Reuse Phase 1-4 test infrastructure. New critical tests:
- **T-SPEC-01:** Specification state machine (DRAFT→APPROVED→EFFECTIVE→SUPERSEDED; DRAFT→EFFECTIVE invalid; immutability when EFFECTIVE).
- **T-SPEC-02:** Spec approval is human-only (AI cannot approve).
- **T-METHOD-01:** TestMethod M:N Specification (a method references specs).
- **T-SAMPLE-01:** Sample state machine (DRAWN→RECEIVED_IN_LAB→IN_TEST→CONSUMED/RETAINED).
- **T-RESULT-01:** TestResult state machine (SAMPLE_RECEIVED→…→DISPOSITIONED; RESULT_ENTERED auto-evaluates PASS/FAIL against spec).
- **T-RESULT-02:** Disposition is human-only (AI cannot disposition); FAIL result can link to NCR.
- **T-INSP-01:** Inspection state machine (PENDING→PASSED/FAILED/CONDITIONAL).
- **T-ISOL-05:** Cross-site lab/inspection isolation (Site-A sample not visible from Site-B).
- **T-LINK-02:** TestResult/Inspection links to production entity (polymorphic); failed result links to NCR.
- **T-AI-GUARD-02:** AI governance (no spec.approve / testresult.disposition for AI).
- **T-AUTO-EVAL-01:** auto-evaluation against spec (numeric range, pass/fail, text match).
- **Regression:** all 129 Phase 1-4 tests still pass.

---

## 10. Migration strategy

- **Schema:** additive Prisma migration (`phase5_laboratory`) on top of Phase 4. No changes to Phase 1-4 tables except adding reverse relation arrays to NCR/Site/User/Employee.
- **Seed:** extend `prisma/seed.ts` with Phase 5 demo data (idempotent upserts).
- **PG-portable:** no SQLite-only types.
- **No data loss:** Phase 1-4 data preserved.

---

## 11. Matt Pocock skills to use

| Activity | Skill |
|---|---|
| Resolve D1-D8 ambiguities | `grill-with-docs` (→ `grilling` + `domain-modeling`) |
| Maintain CONTEXT.md / DOMAIN_GLOSSARY.md | `domain-modeling` |
| Design the lab module seams | `codebase-design` |
| Turn this plan into a spec | `to-spec` |
| Break into tickets | `to-tickets` |
| Implement (after approval) | `tdd` + `implement` |
| Debug hard issues (auto-evaluation logic) | `diagnosing-bugs` |
| Phase gate quality | `code-review` |

Skills never override the PRD (ADR-0001).

---

## 12. Files / modules to change (after approval)

**New:**
- `src/modules/laboratory/{domain,service}/index.ts`
- `src/app/api/lab/**` + `src/app/api/inspection/**` (route handlers)
- `src/app/[locale]/(app)/lab/{specifications,test-methods,samples,test-results}/page.tsx` + `src/app/[locale]/(app)/inspection/inspections/page.tsx`
- `prisma/migrations/<ts>_phase5_laboratory/migration.sql`
- `docs/adr/0012-inspection-vs-lab-test-distinction.md` (D1)
- `docs/adr/0013-specification-ownership-and-immutability.md` (D2/D7)
- `docs/api/laboratory.md`
- `.scratch/phase-5/{spec.md,issues/NN-*.md}`

**Modified:** `prisma/schema.prisma` (Phase 5 models + NCR/Site/User/Employee relations), `prisma/seed.ts`, `src/lib/permissions.ts`, `src/components/app/app-sidebar.tsx`, `src/messages/{en,fr,ar}.json`, `CONTEXT.md` + `DOMAIN_GLOSSARY.md`, `docs/architecture/rbac-matrix.md`.

---

## 13. Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| P5-R1 | D1-D8 unconfirmed → schema blocked | H | Critical | this plan flags them; NO implementation until confirmed |
| P5-R2 | Spec auto-evaluation logic wrong → false pass/fail | M | Critical | TDD on auto-eval; test all criterion types; never invent specs |
| P5-R3 | Spec immutability bypassed | L | High | service guard (like BOM ADR-0006); tested T-SPEC-01 |
| P5-R4 | AI approves/dispositions a result (PRD §9 violation) | M | Critical | service guard + no perm for AI; tested T-AI-GUARD-02 |
| P5-R5 | Lab Test vs Inspection overlap → duplicate records | M | Medium | D1 strictly separates them; different state machines |
| P5-R6 | Polymorphic source loses referential integrity | M | Medium | service validates entity exists + same site (same as Phase 4 D8) |
| P5-R7 | Equipment reference is free-text (Phase 8 not ready) | L | Low | acceptable; string ref; Phase 8 adds Equipment FK |

---

## 14. Dependencies

- **No new runtime deps.** Reuses Phase 1-4 stack.
- **Phase 4 foundation required:** NCR (for failed result linkage), Quality permissions pattern, polymorphic validation pattern.
- **Phase 3 foundation required:** Batch/DeviceLot/MaterialLot (for sample sources).
- **Phase 1 foundation required:** User/Employee, Site/SiteScope, audit, RBAC.

---

## 15. Acceptance criteria (definition of done)

Phase 5 is DONE only when ALL hold (PRD §19 Phase Gate):

1. Specification/TestMethod/TestMethodSpec/Sample/TestResult/Inspection entities exist with the §4 schema (after D1-D8 confirmation).
2. Specification state machine (D7) enforced + audited; immutable when EFFECTIVE; tested T-SPEC-01.
3. Spec approval is human-only (AI must never approve — PRD §9); tested T-SPEC-02.
4. Sample state machine (D4) enforced + audited; tested T-SAMPLE-01.
5. TestResult state machine (D5) enforced + audited; auto-evaluation against spec works; tested T-RESULT-01, T-AUTO-EVAL-01.
6. Disposition is human-only (AI must never disposition — PRD §9); tested T-RESULT-02.
7. Inspection state machine (D6) enforced + audited; tested T-INSP-01.
8. All site-owned lab/inspection entities respect SiteScope; cross-site isolation tested (T-ISOL-05).
9. Polymorphic linkage to production (D8 pattern); failed result links to NCR; tested T-LINK-02.
10. Every create/transition/approve/disposition audited with previousState/newState + reason.
11. RBAC: lab.* + inspection.* permissions, 3-layer, least-privilege; AI governance tested (T-AI-GUARD-02).
12. i18n: all UI strings from catalogs; FR/EN/AR; RTL-safe.
13. Demo seed: synthetic, labelled DEMO/TEST, covers all lab/inspection entities + linkage.
14. All Phase 1-4 tests still pass (129); new Phase 5 tests pass.
15. Lint 0 errors; typecheck clean.
16. Browser-verified: create spec → approve → draw sample → create test result → evaluate → disposition.
17. ADRs 0012 (Inspection vs Lab Test) + 0013 (Specification ownership/immutability) written.
18. Phase 5 Validation Report produced; STOP; owner approval.

---

## 16. Test plan (summary)

| Layer | What | Critical tests |
|---|---|---|
| Unit | state machines (Spec/Method/Sample/Result/Inspection), auto-evaluation logic, spec immutability | T-SPEC-01, T-SPEC-02, T-SAMPLE-01, T-RESULT-01, T-INSP-01, T-AUTO-EVAL-01 |
| Integration | spec→method→sample→result→disposition flow; failed result → NCR | T-LINK-02, T-RESULT-02 |
| API | envelope, 401/403/400/409/422/200 | each endpoint |
| Authz | can() per role; AI-guard | T-AI-GUARD-02 |
| Multi-site | cross-site lab isolation | T-ISOL-05 |
| Audit | every transition audited | T-AUDIT-06 |
| Regression | Phase 1-4 tests | all 129 pass |

---

## 17. Open questions (require owner decision before implementation)

> **These are the 8 critical domain decisions from §3. I will NOT implement Phase 5 until these are confirmed.**

- **D1 — Inspection vs Laboratory Test:** confirm separate entities (Inspection = shop-floor check, no sample/method; Lab Test = formal lab examination with sample/method/result/review/disposition)? *(Recommendation: yes)*
- **D2 — Specification ownership:** confirm standalone entity, referenced polymorphically (by Method or directly by Result/Inspection)? *(Recommendation: yes; specs apply to products, materials, processes)*
- **D3 — Test Method vs Specification:** confirm separate entities (Method = how to test; Spec = what's acceptable; a Method references Specs)? *(Recommendation: yes)*
- **D4 — Sample lifecycle:** confirm DRAWN→RECEIVED_IN_LAB→IN_TEST→CONSUMED/RETAINED; a Sample can have multiple TestResults? *(Recommendation: yes)*
- **D5 — Test Result state machine + disposition:** confirm SAMPLE_RECEIVED→IN_PROGRESS→RESULT_ENTERED→REVIEWED→DISPOSITIONED; disposition: PASS_RELEASE/FAIL_HOLD/FAIL_REJECT/CONDITIONAL_RELEASE; AI must never disposition? *(Recommendation: yes)*
- **D6 — Inspection state machine:** confirm PENDING→PASSED/FAILED/CONDITIONAL (simple, no review/disposition workflow)? *(Recommendation: yes)*
- **D7 — Specification state machine + immutability:** confirm DRAFT→APPROVED→EFFECTIVE→SUPERSEDED; immutable when EFFECTIVE; AI must never approve a spec? *(Recommendation: yes)*
- **D8 — Site ownership:** confirm GLOBAL: Specification, TestMethod; SITE-OWNED: Sample, TestResult, Inspection? *(Recommendation: yes)*

**Additional open questions (lower priority):**
- D9: Should a TestResult auto-evaluate PASS/FAIL when the measured value is entered, or should the Lab Technician manually set the evaluated result? *(Recommendation: auto-evaluate against spec; technician confirms)*
- D10: Should Inspections reference a Specification, or can they be free-text pass/fail without a spec? *(Recommendation: spec optional; some inspections are pass/fail without a formal spec)*
- D11: Should a Sample be consumable (quantity decreases) or is it just a record that a sample was drawn? *(Recommendation: Sample is a record; consumption is implicit when status → CONSUMED; no quantity tracking on the sample itself)*

---

```
PHASE 5 PLAN STATUS: WAITING FOR OWNER APPROVAL (and §3 / §17 domain decisions D1-D8)
```

**I am stopping here.** I will not implement Phase 5, will not create Phase 5 tickets under `.scratch/phase-5/` beyond this plan, and will not modify the schema until the owner (a) approves this plan and (b) confirms D1–D8. Awaiting your decisions.
