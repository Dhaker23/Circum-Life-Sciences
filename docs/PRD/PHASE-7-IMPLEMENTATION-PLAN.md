# CIRCUM — PHASE 7 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 7 — Document Control / Training / Supplier Quality Audits
> **Predecessor:** Phases 1-6 (all approved/closed). Change Control + Risk Assessment already implemented (Phase 4).
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only).
> **Source of truth:** Circum Master PRD §5 (Document Control: Draft → Review → Approval → Effective → Revision → Obsolete/Retired; Training: Employee → Required Training → Training → Assessment → Competency → Authorization; Quality/QMS: supplier quality, audits), §9 (AI governance), §10 (Traceability), §16 (Docs), §17 (Validation-minded), §18 (Phase 7: Document control / training / change control / risk / audits), §19/§20 (Phase Gate/Report). GLM Master Prompt §9 (Controlled Workflows).
> **Scope note:** PRD Phase 7 lists "Document control / training / change control / risk / audits." **Change Control and Risk Assessment are already implemented** (our Phase 4). Phase 7 covers the remaining: Document Control, Training, and Supplier Quality Audits.
> **Critical owner constraint:** "Identify every ambiguity affecting data model, controlled workflows, traceability, regulatory records, authorization, auditability, site isolation, AI governance. For every critical ambiguity, provide D1, D2, D3... with proposed resolution, rationale, alternative, recommendation."

---

## 0. Context: what Phase 7 covers

**Already implemented (Phase 4):**
- ChangeControl entity + state machine (REQUEST → IMPACT → RISK → APPROVAL → IMPLEMENTATION → VERIFICATION → EFFECTIVENESS → CLOSED) ✅
- RiskAssessment entity (severity × probability = RPN) ✅

**Phase 7 scope (remaining from PRD Phase 7):**
1. **Document Control** — the controlled-document lifecycle entity. All prior phases stored `evidenceDocumentRef`, `documentRef`, `certificateOfAnalysis` as string placeholders (deferred from Phase 4 D9, Phase 5). Phase 7 introduces the `ControlledDocument` entity and provides the infrastructure to migrate those string refs to FKs.
2. **Training** — the training/competency chain (Employee → Required Training → Training → Assessment → Competency → Authorization). Zero training entities exist today.
3. **Supplier Quality Audits** — formal audit records for supplier quality (the Supplier entity exists from Phase 2 with `qualificationStatus`, but there are no audit records).

---

## 1. Objectives

1. **ControlledDocument** — a controlled record representing a document (SOP, work instruction, specification, protocol, report, etc.) with the lifecycle: Draft → Review → Approval → Effective → Revision → Obsolete. Immutable when Effective (like BOM/Specification, ADR-0006 pattern). Versioned (a new revision supersedes the old).
2. **Document-Entity linking** — a mechanism for existing entities (NCR, Deviation, CAPA, ChangeControl, TestMethod, MaterialLot, etc.) to reference ControlledDocuments, replacing the string placeholders.
3. **Training** — the training/competency chain: RequiredTraining (a training requirement/template), TrainingRecord (an instance of training delivered to an Employee), Assessment (evaluation), Competency (the resulting authorization).
4. **SupplierAudit** — a formal audit record for supplier quality, with findings, CAPA linkage, and qualification impact.
5. **Full RBAC + audit + multi-site** — reuse Phase 1-6 infrastructure.
6. **AI governance (PRD §9)** — AI may assist with document/training/audit Q&A but must never approve documents, authorize training, or close audits.

**Out of scope:** Equipment/Calibration (Phase 8), Cleanroom/Packaging/Sterilization (Phase 9), Batch Review/Release (Phase 9), OEE/VSM (Phase 10), AI Assistant (Phase 12), Customer/Project (deferred).

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 7 coverage |
|---|---|---|---|
| R1 | Document Control: Draft → Review → Approval → Effective → Revision → Obsolete/Retired | §5 | ControlledDocument entity + state machine |
| R2 | Training: Employee → Required Training → Training → Assessment → Competency → Authorization | §5 | RequiredTraining, TrainingRecord, Assessment, Competency entities |
| R3 | Supplier quality, audits | §5 | SupplierAudit entity |
| R4 | Controlled records: unique ID, status, owner, evidence, approval history, audit trail | §5 | all Phase 7 entities carry these |
| R5 | Every controlled transition: authorize + validate + audit + preserve history | §9, GLM §9 | explicit /transition endpoints |
| R6 | AI must never approve documents, authorize training, close audits | §9 | human-only guards |
| R7 | Existing string document references migrate to ControlledDocument FKs | Phase 4 D9, Phase 5 D9 | documentRef fields → nullable FK to ControlledDocument |
| R8 | DB constraints, site isolation, audit immutability | §10, §11, §13 | reuse Phase 1-6 infrastructure |
| R9 | Phase Gate (§19) + Phase Validation Report (§20) | §19, §20 | full gate |
| R10 | PostgreSQL-portable (ADR-0002) | §11 | no SQLite-only types |

---

## 3. Domain model (grill-with-docs + domain-modeling)

### 3.1 Document Control: content storage vs metadata-only (D1 — CRITICAL)

**Question:** Does ControlledDocument store the actual file content (binary/upload), or just metadata (title, code, type, version, external reference) with the file stored elsewhere?

**Proposed resolution (D1):** **Metadata + file reference (no binary storage in DB).** A ControlledDocument stores: `code`, `title`, `documentType` (SOP / WORK_INSTRUCTION / SPECIFICATION / PROTOCOL / REPORT / FORM / OTHER), `version` (e.g., "1.0", "2.1"), `filePath?` (a path/URL to the actual file, stored on the local filesystem or a file server — local-first, PRD §12), `status` (DRAFT → REVIEW → APPROVED → EFFECTIVE → SUPERSEDED → OBSOLETE), `approvedByUserId?`, `approvedAt?`, `effectiveFrom?`, `supersededById?`, `description?`, `isDemo`. The DB stores metadata + a file reference; the actual file is on disk. Rationale:
- Storing binary content in SQLite/PostgreSQL is possible but not ideal for large documents (PDFs, images).
- Local-first (PRD §12): files on the factory LAN file server; the DB tracks what's approved/effective.
- The file reference is a string path (like the existing `documentRef` strings), but now it's on a controlled, versioned entity.
- Future Phase 13 can add a proper file storage service; Phase 7 uses filesystem paths.

**Alternative:** Store file content as a base64 blob in the DB. Rejected — poor performance, bloats the DB, not PG-portable-friendly for large files.

**Recommendation: metadata + file reference.** **Please confirm D1.**

### 3.2 Document versioning model (D2)

**Question:** When a document is revised, is a new ControlledDocument row created (like ProductRevision), or does the existing row get updated with a new version number?

**Proposed resolution (D2):** **New row per revision (like ProductRevision).** A ControlledDocument represents a specific version of a document. When a document is revised:
1. The current Effective document transitions to SUPERSEDED.
2. A new ControlledDocument row is created with version+1, status DRAFT.
3. The old document's `supersededById` points to the new one.
4. The new document goes through Draft → Review → Approval → Effective.
5. Once the new document is Effective, entities referencing the old document should be updated to reference the new one (or the old reference is preserved for historical accuracy — see D3).

Rationale: immutability when Effective (ADR-0006 pattern); full audit trail of what version was effective at what time; traceability (which document version governed a specific batch/test).

**Recommendation: new row per revision.** **Please confirm D2.**

### 3.3 Document reference migration strategy (D3)

**Question:** How do existing `evidenceDocumentRef` / `documentRef` / `certificateOfAnalysis` string fields migrate to ControlledDocument FKs?

**Proposed resolution (D3):** **Add nullable FK alongside existing string (incremental migration).** For each entity with a document reference string:
1. Add a nullable `controlledDocumentId` FK column.
2. The string field remains for backward compatibility (legacy data).
3. New records can use either the FK (preferred) or the string (if the document isn't in the system yet).
4. A future migration script can backfill the FK from the string where a matching ControlledDocument exists.
5. The service layer prefers the FK if set; falls back to the string.

This avoids a breaking migration and allows incremental adoption. Entities affected: NCR, Deviation, Investigation, CAPA, ChangeControl, TestMethod, MaterialLot, TestResult.

**Recommendation: nullable FK alongside string (incremental).** **Please confirm D3.**

### 3.4 Training model: RequiredTraining vs TrainingRecord (D4)

**PRD evidence:** §5 "Employee → Required Training → Training → Assessment → Competency → Authorization."

**Proposed resolution (D4):**
- **RequiredTraining** — a training requirement/template: what training is needed for a role/position. Fields: `code`, `title`, `description`, `documentId?` (the training material, a ControlledDocument), `validityPeriodMonths?` (re-training interval), `status` (ACTIVE/INACTIVE). Global (not site-scoped — training requirements are shared).
- **TrainingRecord** — an instance of training delivered to an Employee. Fields: `code`, `employeeId`, `requiredTrainingId?`, `siteId`, `trainedByUserId?`, `trainedAt`, `status` (SCHEDULED → COMPLETED → EXPIRED), `expiresAt?`, `notes?`. Site-owned (the employee is at a site).
- **Assessment** — an evaluation of the training. Fields: `trainingRecordId`, `assessedByUserId?`, `assessedAt`, `result` (PASS/FAIL), `score?`, `notes?`. One TrainingRecord may have one Assessment.
- **Competency** — the resulting authorization. Fields: `employeeId`, `requiredTrainingId?`, `trainingRecordId?`, `competencyLevel` (AUTHORIZED/CONDITIONAL/NOT_AUTHORIZED), `authorizedByUserId?`, `authorizedAt?`, `expiresAt?`, `status` (ACTIVE/EXPIRED/REVOKED). Site-owned (via employee).

**Key distinction:** RequiredTraining = what's needed (template); TrainingRecord = what was delivered (instance); Assessment = was it understood (evaluation); Competency = is the employee authorized (result).

**Recommendation: 4 separate entities.** **Please confirm D4.**

### 3.5 Training-Document Control link (D5)

**Proposed resolution (D5):** RequiredTraining has an optional `documentId` FK to ControlledDocument (the training material/SOP). This links the training requirement to the controlled document that defines the training content. When the document is revised, the training requirement can be reviewed (does the new version require re-training?).

**Recommendation: yes (RequiredTraining → ControlledDocument optional FK).** **Please confirm D5.**

### 3.6 Training-RBAC link (D6 — CRITICAL)

**Question:** Does completing training + gaining competency automatically modify RBAC permissions? The PRD says "Authorization" is the end of the training chain.

**Proposed resolution (D6):** **NO automatic RBAC modification.** Training completion and competency are recorded as Competency records, but they do NOT automatically grant or revoke RBAC permissions. Rationale:
- RBAC permissions are assigned via Assignments (Phase 1), which are controlled by administrators.
- Training competency is a *prerequisite* for an assignment (an employee must be competent before being assigned a role), but the assignment itself is a separate controlled action.
- Automatically granting permissions based on training would bypass the controlled assignment workflow (ADR-0004).
- The system can *flag* that an employee lacks required training for a role (a warning, not a block), but the administrator makes the assignment decision.

**Alternative:** Automatically grant a role-specific permission set when competency is achieved. Rejected — bypasses controlled RBAC; the administrator must explicitly assign roles.

**Recommendation: NO automatic RBAC modification; competency is a prerequisite flag, not an auto-grant.** **Please confirm D6.**

### 3.7 Supplier Audit entity (D7)

**Question:** Is a SupplierAudit a formal quality audit record (with findings, CAPA linkage, qualification impact), or a simple log?

**Proposed resolution (D7):** **Formal controlled record.** SupplierAudit fields: `code`, `supplierId`, `siteId`, `auditType` (INITIAL / PERIODIC / FOR_CAUSE / FOLLOW_UP), `scheduledDate?`, `completedDate?`, `auditorUserId?`, `findings?`, `result` (PASS / CONDITIONAL_PASS / FAIL), `capaId?` (link to CAPA if findings require corrective action), `qualificationImpact` (NO_CHANGE / UPGRADE_TO_APPROVED / DOWNGRADE_TO_CONDITIONAL / DISQUALIFY), `status` (SCHEDULED → IN_PROGRESS → COMPLETED → CLOSED), `evidenceDocumentId?` (FK to ControlledDocument — the audit report), `isDemo`. Site-owned.

The `qualificationImpact` is informational (the service does NOT automatically change Supplier.qualificationStatus — a human must do that via a controlled action, consistent with D6's philosophy).

**Recommendation: formal controlled record with CAPA linkage + informational qualification impact.** **Please confirm D7.**

### 3.8 Internal Quality Audit vs AuditEvent (D8)

**Question:** The PRD mentions "audits" — is this supplier audits only, or also internal process/system audits?

**Proposed resolution (D8):** **Phase 7 covers Supplier Audits only.** Internal quality audits (auditing processes, systems, departments) are a broader scope that could be a future phase. The `AuditEvent` entity (Phase 1) is the system audit trail (who did what, when) — completely distinct from quality audits. Phase 7's `SupplierAudit` is specifically for supplier quality audits. If the owner wants internal audits, they can be added as a separate entity in a future phase.

**Recommendation: Supplier Audits only in Phase 7; internal audits deferred.** **Please confirm D8.**

### 3.9 Summary of proposed domain decisions

| # | Decision | Proposed | Recommendation |
|---|---|---|---|
| D1 | Document content storage | Metadata + file reference (no binary in DB) | **Confirm** |
| D2 | Document versioning | New row per revision (like ProductRevision); immutable when Effective | **Confirm** |
| D3 | Document reference migration | Nullable FK alongside existing string (incremental) | **Confirm** |
| D4 | Training model | 4 entities: RequiredTraining, TrainingRecord, Assessment, Competency | **Confirm** |
| D5 | Training-Document link | RequiredTraining → ControlledDocument optional FK | **Confirm** |
| D6 | Training-RBAC link | NO automatic RBAC modification; competency is a prerequisite flag, not auto-grant | **Confirm** |
| D7 | Supplier Audit | Formal controlled record with CAPA linkage + informational qualification impact (no auto-change) | **Confirm** |
| D8 | Audit scope | Supplier Audits only in Phase 7; internal audits deferred | **Confirm** |

---

## 4. Database schema (proposed, pending §3 confirmation)

```prisma
// Controlled Document (D1: metadata + file ref; D2: new row per revision)
model ControlledDocument {
  id              String   @id @default(cuid())
  code            String   @unique
  title           String
  documentType    String   @default("SOP") // SOP | WORK_INSTRUCTION | SPECIFICATION | PROTOCOL | REPORT | FORM | OTHER
  version         String   // e.g., "1.0", "2.1"
  filePath        String?  // D1: path/URL to the actual file (local filesystem)
  status          String   @default("DRAFT") // DRAFT | REVIEW | APPROVED | EFFECTIVE | SUPERSEDED | OBSOLETE (D2)
  approvedByUserId String?
  approvedAt      DateTime?
  effectiveFrom   DateTime?
  supersededById  String?
  description     String?
  isDemo          Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  approver     User?               @relation("DocApprover", fields: [approvedByUserId], references: [id], onDelete: SetNull)
  supersededBy ControlledDocument?  @relation("DocSupersession", fields: [supersededById], references: [id], onDelete: NoAction)
  supersededByThis ControlledDocument[] @relation("DocSupersession")

  @@index([status])
  @@index([documentType])
}

// Training: RequiredTraining (template, global)
model RequiredTraining {
  id                    String   @id @default(cuid())
  code                  String   @unique
  title                 String
  description           String?
  documentId            String?  // D5: link to ControlledDocument (training material)
  validityPeriodMonths  Int?     // re-training interval
  status                String   @default("ACTIVE")
  isDemo                Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  document      ControlledDocument? @relation(fields: [documentId], references: [id], onDelete: SetNull)
  trainingRecords TrainingRecord[]
  competencies  Competency[]

  @@index([status])
}

// Training: TrainingRecord (instance, site-owned)
model TrainingRecord {
  id                String   @id @default(cuid())
  code              String   // unique per site
  employeeId        String
  requiredTrainingId String?
  siteId            String
  trainedByUserId   String?
  trainedAt         DateTime @default(now())
  status            String   @default("SCHEDULED") // SCHEDULED | COMPLETED | EXPIRED
  expiresAt         DateTime?
  notes             String?
  isDemo            Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  employee        Employee          @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  requiredTraining RequiredTraining? @relation(fields: [requiredTrainingId], references: [id], onDelete: SetNull)
  site            Site              @relation(fields: [siteId], references: [id], onDelete: Restrict)
  trainer         User?             @relation("TrainingTrainer", fields: [trainedByUserId], references: [id], onDelete: SetNull)
  assessment      Assessment?

  @@unique([siteId, code])
  @@index([employeeId])
  @@index([siteId])
  @@index([status])
}

// Training: Assessment (evaluation, 1:1 with TrainingRecord)
model Assessment {
  id                String   @id @default(cuid())
  trainingRecordId  String   @unique
  assessedByUserId  String?
  assessedAt        DateTime @default(now())
  result            String   // PASS | FAIL
  score             String?
  notes             String?
  createdAt         DateTime @default(now())

  trainingRecord TrainingRecord @relation(fields: [trainingRecordId], references: [id], onDelete: Cascade)
  assessor       User?          @relation("AssessmentAssessor", fields: [assessedByUserId], references: [id], onDelete: SetNull)

  @@index([trainingRecordId])
}

// Training: Competency (authorization result, site-owned via employee)
model Competency {
  id                String   @id @default(cuid())
  employeeId        String
  requiredTrainingId String?
  trainingRecordId  String?
  competencyLevel   String   @default("AUTHORIZED") // AUTHORIZED | CONDITIONAL | NOT_AUTHORIZED
  authorizedByUserId String?
  authorizedAt      DateTime?
  expiresAt         DateTime?
  status            String   @default("ACTIVE") // ACTIVE | EXPIRED | REVOKED
  isDemo            Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  employee        Employee          @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  requiredTraining RequiredTraining? @relation(fields: [requiredTrainingId], references: [id], onDelete: SetNull)
  trainingRecord TrainingRecord?    @relation(fields: [trainingRecordId], references: [id], onDelete: SetNull)
  authorizer      User?             @relation("CompetencyAuthorizer", fields: [authorizedByUserId], references: [id], onDelete: SetNull)

  @@index([employeeId])
  @@index([status])
}

// Supplier Audit (D7: formal controlled record)
model SupplierAudit {
  id                  String   @id @default(cuid())
  code                String   // unique per site
  supplierId          String
  siteId              String
  auditType           String   @default("PERIODIC") // INITIAL | PERIODIC | FOR_CAUSE | FOLLOW_UP
  scheduledDate       DateTime?
  completedDate       DateTime?
  auditorUserId       String?
  findings            String?
  result              String?  // PASS | CONDITIONAL_PASS | FAIL
  capaId              String?  // link to CAPA if findings require corrective action
  qualificationImpact String   @default("NO_CHANGE") // NO_CHANGE | UPGRADE_TO_APPROVED | DOWNGRADE_TO_CONDITIONAL | DISQUALIFY
  status              String   @default("SCHEDULED") // SCHEDULED | IN_PROGRESS | COMPLETED | CLOSED
  evidenceDocumentId  String?  // FK to ControlledDocument (audit report)
  isDemo              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  supplier  Supplier            @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  site      Site                @relation(fields: [siteId], references: [id], onDelete: Restrict)
  auditor   User?               @relation("SupplierAuditor", fields: [auditorUserId], references: [id], onDelete: SetNull)
  capa      CAPA?               @relation("SupplierAuditCapa", fields: [capaId], references: [id], onDelete: SetNull)
  evidenceDocument ControlledDocument? @relation(fields: [evidenceDocumentId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([supplierId])
  @@index([siteId])
  @@index([status])
}
```

**Relation additions:** `User` gets named relation arrays for doc approver, trainer, assessor, competency authorizer, supplier auditor. `Employee` gets `trainingRecords[]`, `competencies[]`. `Site` gets `trainingRecords[]`, `supplierAudits[]`. `Supplier` gets `audits[]`. `CAPA` gets `supplierAudits[]`. `ControlledDocument` gets `requiredTrainings[]`, `supplierAudits[]`.

**D3 migration:** existing `evidenceDocumentRef`/`documentRef`/`certificateOfAnalysis` string fields get a nullable `controlledDocumentId` FK added alongside (not replacing the string). Entities: NCR, Deviation, Investigation, CAPA, ChangeControl, TestMethod, MaterialLot, TestResult.

---

## 5. API design

New permission modules `docs.*`, `training.*`, `supplieraudit.*`.

```
# Controlled Documents
GET    /api/docs/documents
POST   /api/docs/documents
GET    /api/docs/documents/:id
POST   /api/docs/documents/:id/transition    (DRAFT->REVIEW->APPROVED->EFFECTIVE->SUPERSEDED->OBSOLETE)

# Training
GET    /api/training/required
POST   /api/training/required
GET    /api/training/records
POST   /api/training/records
POST   /api/training/records/:id/transition  (SCHEDULED->COMPLETED->EXPIRED)
POST   /api/training/records/:id/assessment  (record assessment)
POST   /api/training/competencies            (authorize competency)
GET    /api/training/competencies

# Supplier Audits
GET    /api/supplier-audits
POST   /api/supplier-audits
GET    /api/supplier-audits/:id
POST   /api/supplier-audits/:id/transition   (SCHEDULED->IN_PROGRESS->COMPLETED->CLOSED)
```

---

## 6. UI architecture

Pages under `[locale]/(app)/`:
- `docs/documents/` — document list (type, version, status badges), create, transition.
- `training/required/` — required training templates.
- `training/records/` — training records per employee (status, assessment, competency).
- `training/competencies/` — competency matrix (employee × required training).
- `supplier-audits/` — audit list (type, result, qualification impact, CAPA link).

---

## 7. Security & audit

- **Permissions:** `docs.document.{read,create,transition,approve}`, `training.required.{read,create}`, `training.record.{read,create,transition}`, `training.assessment.{read,create}`, `training.competency.{read,authorize}`, `supplieraudit.{read,create,transition}`. Least-privilege. AI never gets `approve`/`authorize`/`transition` for controlled actions.
- **Document immutability (D2):** once EFFECTIVE, a ControlledDocument cannot be edited; revision requires a new document.
- **Training-RBAC (D6):** competency does NOT auto-grant permissions; it's a prerequisite flag.
- **Supplier audit qualification impact (D7):** informational only; a human must change Supplier.qualificationStatus via a controlled action.
- **Audit:** every transition/approval/authorization audited.

---

## 8. Multi-site

- **GLOBAL:** ControlledDocument, RequiredTraining (shared catalog).
- **SITE-OWNED:** TrainingRecord, Competency (via employee), SupplierAudit.
- Cross-site leakage = CRITICAL defect.

---

## 9. Testing

- **T-DOC-01:** Document state machine (DRAFT→REVIEW→APPROVED→EFFECTIVE→SUPERSEDED→OBSOLETE; immutability when EFFECTIVE).
- **T-DOC-02:** Document approval is human-only (AI must never approve).
- **T-TRAIN-01:** TrainingRecord state machine (SCHEDULED→COMPLETED→EXPIRED).
- **T-TRAIN-02:** Assessment records PASS/FAIL; Competency created only on PASS.
- **T-TRAIN-03:** Competency does NOT auto-modify RBAC (D6).
- **T-SA-01:** SupplierAudit state machine (SCHEDULED→IN_PROGRESS→COMPLETED→CLOSED).
- **T-SA-02:** Qualification impact is informational (no auto-change to Supplier).
- **T-ISOL-07:** Cross-site training/audit isolation.
- **T-AI-GUARD-04:** AI governance (no approve/authorize/transition for AI).
- **Regression:** all 196 Phase 1-6 tests pass.

---

## 10. Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| P7-R1 | D1-D8 unconfirmed | H | Critical | this plan flags them |
| P7-R2 | Document file storage (filesystem) — no upload UI | M | Medium | Phase 7 stores file path; upload UI deferred |
| P7-R3 | D3 migration adds nullable FKs to many tables | L | Low | additive; no breaking change |
| P7-R4 | Training competency confused with RBAC authorization | M | High | D6 explicitly separates them |
| P7-R5 | Supplier audit qualification impact auto-applied | L | High | D7: informational only; human action required |

---

## 11. Acceptance criteria (definition of done)

1. ControlledDocument entity with D2 state machine + immutability; tested T-DOC-01.
2. Doc approval human-only; tested T-DOC-02.
3. D3 migration: nullable FK added to 8 existing entities.
4. RequiredTraining, TrainingRecord, Assessment, Competency entities; tested T-TRAIN-01/02/03.
5. Competency does NOT auto-modify RBAC; tested T-TRAIN-03.
6. SupplierAudit entity with state machine + CAPA linkage; tested T-SA-01/02.
7. Qualification impact informational only; tested T-SA-02.
8. All site-owned entities respect SiteScope; tested T-ISOL-07.
9. RBAC + AI governance; tested T-AI-GUARD-04.
10. i18n FR/EN/AR + RTL.
11. Demo seed.
12. All 196 Phase 1-6 tests pass + new Phase 7 tests pass.
13. Lint 0 errors; typecheck clean.
14. Browser-verified.
15. Phase 7 Validation Report; STOP; owner approval.

---

## 12. Open questions (require owner decision)

- **D1 — Document content storage:** confirm metadata + file reference (no binary in DB)? *(Recommendation: yes)*
- **D2 — Document versioning:** confirm new row per revision; immutable when Effective? *(Recommendation: yes)*
- **D3 — Document reference migration:** confirm nullable FK alongside existing string (incremental)? *(Recommendation: yes)*
- **D4 — Training model:** confirm 4 entities (RequiredTraining, TrainingRecord, Assessment, Competency)? *(Recommendation: yes)*
- **D5 — Training-Document link:** confirm RequiredTraining → ControlledDocument optional FK? *(Recommendation: yes)*
- **D6 — Training-RBAC link:** confirm NO automatic RBAC modification; competency is a prerequisite flag? *(Recommendation: yes)*
- **D7 — Supplier Audit:** confirm formal controlled record with CAPA linkage + informational qualification impact? *(Recommendation: yes)*
- **D8 — Audit scope:** confirm Supplier Audits only in Phase 7; internal audits deferred? *(Recommendation: yes)*

---

```
PHASE 7 PLAN STATUS: WAITING FOR OWNER APPROVAL (and D1-D8 confirmation)
```

**I am stopping here.** Awaiting your approval and confirmation of D1–D8.
