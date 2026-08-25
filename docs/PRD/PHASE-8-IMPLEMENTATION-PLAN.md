# CIRCUM — PHASE 8 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 8 — Equipment / Maintenance / Calibration / Qualification / Validation
> **Predecessor:** Phases 1-7 (all approved/closed). WorkCenter exists from Phase 3 (ADR-0009); TestMethod has `equipmentType` string ref; OperationExecution references WorkCenter.
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only).
> **Source of truth:** Circum Master PRD §5 (Equipment: equipment master, maintenance, calibration, status VALID/EXPIRING/EXPIRED/OUT OF SERVICE; Validation: IQ, OQ, PQ, process validation, equipment qualification, Workflow: Requirement → Protocol → Execution → Result → Deviation → Approval → Report. Never invent acceptance criteria), §9 (AI governance), §10 (Traceability: Equipment in genealogy), §18 (Phase 8: Equipment / maintenance / calibration / qualification / validation), §19/§20 (Phase Gate/Report). GLM Master Prompt §9, §10.
> **Critical owner constraint:** "Never invent acceptance criteria." "Do not invent entities, terminology, workflows, regulatory requirements, or functionality."

---

## 0. Context: what Phase 8 covers

PRD §18 Phase 8: "Equipment / maintenance / calibration / qualification / validation."

**Existing (Phase 3, ADR-0009):** WorkCenter entity (site-owned location/station). Operation has optional `workCenterId`. OperationExecution references WorkCenter. TestMethod has `equipmentType` string ref. No Equipment entity, no maintenance/calibration, no qualification/validation records.

**Phase 8 scope:**
1. **Equipment Master** — the physical machine/instrument entity. Links to WorkCenter (D3 from Phase 3: "future Equipment can be associated with WorkCenters"). Site-owned.
2. **Maintenance** — maintenance records and scheduling for Equipment.
3. **Calibration** — calibration records and status tracking (VALID / EXPIRING / EXPIRED / OUT OF SERVICE).
4. **Qualification (IQ/OQ/PQ)** — equipment qualification records following the Validation workflow.
5. **Validation** — process validation, cleanroom qualification, test-method validation (the Validation workflow: Requirement → Protocol → Execution → Result → Deviation → Approval → Report).

---

## 1. Objectives

1. **Equipment** — physical machine/instrument master with code, name, type, serial number, WorkCenter link, site ownership, status (OPERATIONAL / MAINTENANCE / OUT_OF_SERVICE).
2. **MaintenanceRecord** — scheduled and unscheduled maintenance events on Equipment. Fields: type (PREVENTIVE / CORRECTIVE / PREDICTIVE), scheduledDate, completedDate, performedByUserId, findings, status (SCHEDULED → IN_PROGRESS → COMPLETED).
3. **CalibrationRecord** — calibration events on Equipment. Fields: standard, result (PASS/FAIL), calibratedAt, nextCalibrationDue, performedByUserId. The Equipment's calibration status is derived from the latest calibration + nextCalibrationDue (VALID / EXPIRING / EXPIRED / OUT OF_SERVICE).
4. **Qualification** — IQ/OQ/PQ records for Equipment. State machine: Requirement → Protocol → Execution → Result → Deviation → Approval → Report (per PRD §5 Validation workflow). Never invents acceptance criteria.
5. **Link Equipment to existing entities** — OperationExecution can reference the specific Equipment used (not just WorkCenter). TestMethod's `equipmentType` string can be matched against Equipment.type.
6. **Traceability** — Equipment appears in the genealogy chain (PRD §10: "...Operations → Equipment → Operators →..."). The Phase 6 traceability layer can traverse Equipment links.
7. **Full RBAC + audit + multi-site** — reuse Phase 1-7 infrastructure.
8. **AI governance (PRD §9)** — AI may assist with equipment/maintenance/calibration Q&A but must never approve qualifications, modify calibration status, or close maintenance records.

**Out of scope:** Cleanroom monitoring (Phase 9), Packaging/Sterilization (Phase 9), Batch Review/Release (Phase 9), OEE/VSM (Phase 10), AI Assistant (Phase 12), Customer/Project (deferred). Process validation for products (not equipment) — Phase 8 covers equipment qualification; product process validation is broader and may require a future phase.

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 8 coverage |
|---|---|---|---|
| R1 | Equipment master, maintenance, calibration, status tracking | §5 | Equipment, MaintenanceRecord, CalibrationRecord |
| R2 | Calibration statuses: VALID / EXPIRING / EXPIRED / OUT OF SERVICE | §5 | Derived status from latest CalibrationRecord |
| R3 | Validation: IQ, OQ, PQ, equipment qualification | §5 | Qualification entity (IQ/OQ/PQ) |
| R4 | Validation workflow: Requirement → Protocol → Execution → Result → Deviation → Approval → Report | §5 | Qualification state machine |
| R5 | Never invent acceptance criteria | §5, §17 | Qualification stores user-defined criteria; system never creates them |
| R6 | Equipment in traceability genealogy | §10 | Equipment linked to OperationExecution; traceable via Phase 6 |
| R7 | AI must never approve qualifications, modify calibration | §9 | human-only guards |
| R8 | Controlled records: unique ID, status, owner, evidence, audit trail | §5 | all Phase 8 entities carry these |
| R9 | Phase Gate (§19) + Phase Validation Report (§20) | §19, §20 | full gate |
| R10 | PostgreSQL-portable (ADR-0002) | §11 | no SQLite-only types |

---

## 3. Domain model (grill-with-docs + domain-modeling)

### 3.1 Equipment vs WorkCenter (D1)

**Context:** Phase 3 ADR-0009 established WorkCenter (location/station) and deferred Equipment to Phase 8. "A WorkCenter may later have one or more Equipment items linked to it."

**Proposed resolution (D1):** **Equipment is a separate entity, linked to WorkCenter (M:1 — an Equipment belongs to one WorkCenter; a WorkCenter may have multiple Equipment).** Equipment is the physical machine; WorkCenter is the location/station. This matches ADR-0009's design ("Equipment composes with WorkCenter; a WorkCenter has-many Equipment").

- Equipment fields: `code` (unique per site), `name`, `equipmentType` (e.g., "Universal Testing Machine", "Molding Machine"), `serialNumber?`, `manufacturer?`, `model?`, `workCenterId?` (optional — some equipment may not be assigned to a specific work center), `siteId`, `operationalStatus` (OPERATIONAL / MAINTENANCE / OUT_OF_SERVICE), `calibrationStatus` (VALID / EXPIRING / EXPIRED / OUT_OF_SERVICE — derived, not stored directly), `isDemo`.
- The `calibrationStatus` is computed from the latest CalibrationRecord's `nextCalibrationDue` date vs. now (VALID = due in future; EXPIRING = due within 30 days; EXPIRED = past due; OUT_OF_SERVICE = equipment is out of service regardless).
- OperationExecution gets an optional `equipmentId` FK (the specific equipment used for that execution, in addition to the WorkCenter).

**Recommendation: Equipment 1:N WorkCenter (Equipment belongs to a WorkCenter).** **Please confirm D1.**

### 3.2 Calibration status derivation (D2)

**Question:** Is calibrationStatus stored on Equipment (updated when a calibration record is created) or computed on-the-fly?

**Proposed resolution (D2):** **Stored on Equipment (updated by the service layer when a CalibrationRecord is created/transitioned), NOT computed on-the-fly.** Rationale:
- Computing on-the-fly requires querying the latest CalibrationRecord for every Equipment list view (performance).
- The service layer updates `calibrationStatus` when a CalibrationRecord is created or when a scheduled job checks expiry.
- A background job (Phase 13) can periodically update EXPIRING/EXPIRED statuses; Phase 8 updates the status at calibration-record creation time and on manual status checks.
- The status is: VALID (nextCalibrationDue is in the future, >30 days), EXPIRING (nextCalibrationDue within 30 days), EXPIRED (nextCalibrationDue past), OUT_OF_SERVICE (equipment operationalStatus is OUT_OF_SERVICE).

**Recommendation: stored (updated by service on calibration events + manual checks).** **Please confirm D2.**

### 3.3 Qualification scope: equipment only or also process/product? (D3 — CRITICAL)

**PRD evidence:** §5 "Validation: IQ, OQ, PQ, process validation, equipment qualification, cleanroom qualification and test-method validation."

**Question:** Phase 8 covers equipment qualification (IQ/OQ/PQ for a specific Equipment). Does it also cover process validation (validating a manufacturing process for a Product Revision) and cleanroom qualification and test-method validation?

**Proposed resolution (D3):** **Phase 8 covers Equipment Qualification only.** Process validation, cleanroom qualification, and test-method validation are deferred:
- Process validation (validating that a process for Product Revision X meets requirements) depends on Batch Review/Release (Phase 9) and is broader than equipment.
- Cleanroom qualification depends on the Cleanroom module (Phase 9).
- Test-method validation is a formal validation of a TestMethod (Phase 5 has TestMethod; validation of it is a future refinement).
- **Equipment Qualification** = IQ (Installation Qualification: is the equipment installed correctly?), OQ (Operational Qualification: does it operate per spec?), PQ (Performance Qualification: does it perform reliably under load?). These are specific to an Equipment entity and are Phase 8 scope.

**Recommendation: Equipment Qualification only in Phase 8; process/cleanroom/test-method validation deferred.** **Please confirm D3.**

### 3.4 Qualification entity model (D4)

**Proposed resolution (D4):** A single **Qualification** entity with a `qualificationType` field (IQ / OQ / PQ), rather than three separate entities. Fields: `code`, `equipmentId`, `qualificationType` (IQ/OQ/PQ), `protocol?` (text — the qualification protocol), `acceptanceCriteria?` (text — user-defined, never invented by system), `executionResult?` (text), `status` (REQUIREMENT → PROTOCOL → EXECUTION → RESULT → DEVIATION → APPROVAL → REPORT), `deviationId?` (link to Deviation if a deviation was found), `approvedByUserId?`, `approvedAt?`, `reportRef?` (document reference), `evidenceDocumentId?` (Phase 7 ControlledDocument FK), `isDemo`. Site-owned.

State machine: `REQUIREMENT → PROTOCOL → EXECUTION → RESULT → DEVIATION → APPROVAL → REPORT` (per PRD §5). The DEVIATION state is optional (if a deviation is found during execution, it's recorded; otherwise skip to APPROVAL).

**Recommendation: single Qualification entity with type field.** **Please confirm D4.**

### 3.5 Maintenance scheduling (D5)

**Proposed resolution (D5):** **MaintenanceRecord** supports both scheduled (preventive) and unscheduled (corrective) maintenance. Fields: `code`, `equipmentId`, `maintenanceType` (PREVENTIVE / CORRECTIVE / PREDICTIVE), `scheduledDate?`, `startedAt?`, `completedAt?`, `performedByUserId?`, `findings?`, `partsReplaced?`, `downtimeHours?`, `status` (SCHEDULED → IN_PROGRESS → COMPLETED), `evidenceDocumentId?`, `isDemo`. Site-owned.

No automatic work-order generation from maintenance (a human decides if a work order is needed). No automatic equipment status change from maintenance scheduling (a human sets equipment to OUT_OF_SERVICE when starting maintenance, and back to OPERATIONAL when completed — this is an explicit controlled action, not automatic).

**Recommendation: scheduled + unscheduled; no auto-actions.** **Please confirm D5.**

### 3.6 Equipment-OperationExecution link (D6)

**Proposed resolution (D6):** OperationExecution gets an optional `equipmentId` FK. This records which specific Equipment was used for an execution (in addition to the WorkCenter). This enables genealogy: "which equipment produced this batch/lot?" (PRD §10). The WorkCenter remains on OperationExecution (the location); Equipment is the specific machine.

**Recommendation: optional equipmentId on OperationExecution.** **Please confirm D6.**

### 3.7 Site ownership (D7)

**Proposed resolution (D7):** Equipment, MaintenanceRecord, CalibrationRecord, Qualification are all **site-owned** (siteId required, SiteScope enforced). Cross-site leakage = CRITICAL defect. Consistent with all prior phases.

**Recommendation: all site-owned.** **Please confirm D7.**

### 3.8 Summary of proposed domain decisions

| # | Decision | Proposed | Recommendation |
|---|---|---|---|
| D1 | Equipment vs WorkCenter | Equipment is separate entity, M:1 to WorkCenter (belongs to a WorkCenter) | **Confirm** |
| D2 | Calibration status | Stored on Equipment (updated by service on calibration events) | **Confirm** |
| D3 | Qualification scope | Equipment Qualification only (IQ/OQ/PQ); process/cleanroom/test-method validation deferred | **Confirm** |
| D4 | Qualification entity | Single Qualification entity with type field (IQ/OQ/PQ); state machine per PRD §5 | **Confirm** |
| D5 | Maintenance scheduling | Scheduled + unscheduled; no auto-actions (no auto work-order, no auto status change) | **Confirm** |
| D6 | Equipment-OperationExecution link | Optional equipmentId FK on OperationExecution | **Confirm** |
| D7 | Site ownership | All Phase 8 entities site-owned | **Confirm** |

---

## 4. Database schema (proposed, pending §3 confirmation)

```prisma
model Equipment {
  id                String   @id @default(cuid())
  code              String   // unique per site
  name              String
  equipmentType     String   // e.g., "Universal Testing Machine"
  serialNumber      String?
  manufacturer      String?
  model             String?
  workCenterId      String?  // optional link to WorkCenter (D1)
  siteId            String   // SITE-OWNED
  operationalStatus String   @default("OPERATIONAL") // OPERATIONAL | MAINTENANCE | OUT_OF_SERVICE
  calibrationStatus String   @default("VALID") // VALID | EXPIRING | EXPIRED | OUT_OF_SERVICE (D2: stored, updated by service)
  isDemo            Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  workCenter        WorkCenter?        @relation(fields: [workCenterId], references: [id], onDelete: SetNull)
  site              Site               @relation(fields: [siteId], references: [id], onDelete: Restrict)
  maintenanceRecords MaintenanceRecord[]
  calibrationRecords CalibrationRecord[]
  qualifications    Qualification[]
  executions        OperationExecution[]

  @@unique([siteId, code])
  @@index([siteId])
  @@index([operationalStatus])
  @@index([calibrationStatus])
}

model MaintenanceRecord {
  id                  String   @id @default(cuid())
  code                String   // unique per site
  equipmentId         String
  siteId              String
  maintenanceType     String   @default("PREVENTIVE") // PREVENTIVE | CORRECTIVE | PREDICTIVE
  scheduledDate       DateTime?
  startedAt           DateTime?
  completedAt         DateTime?
  performedByUserId   String?
  findings            String?
  partsReplaced       String?
  downtimeHours       Decimal?
  status              String   @default("SCHEDULED") // SCHEDULED | IN_PROGRESS | COMPLETED
  evidenceDocumentId  String?  // Phase 7 ControlledDocument FK
  isDemo              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  equipment  Equipment          @relation(fields: [equipmentId], references: [id], onDelete: Restrict)
  site       Site               @relation(fields: [siteId], references: [id], onDelete: Restrict)
  performer  User?              @relation("MaintenancePerformer", fields: [performedByUserId], references: [id], onDelete: SetNull)
  evidenceDocument ControlledDocument? @relation(fields: [evidenceDocumentId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([equipmentId])
  @@index([siteId])
  @@index([status])
}

model CalibrationRecord {
  id                  String   @id @default(cuid())
  code                String   // unique per site
  equipmentId         String
  siteId              String
  standard            String?  // calibration standard used
  result              String   // PASS | FAIL
  calibratedAt        DateTime @default(now())
  nextCalibrationDue  DateTime
  performedByUserId   String?
  notes               String?
  evidenceDocumentId  String?
  isDemo              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  equipment  Equipment          @relation(fields: [equipmentId], references: [id], onDelete: Restrict)
  site       Site               @relation(fields: [siteId], references: [id], onDelete: Restrict)
  performer  User?              @relation("CalibrationPerformer", fields: [performedByUserId], references: [id], onDelete: SetNull)
  evidenceDocument ControlledDocument? @relation(fields: [evidenceDocumentId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([equipmentId])
  @@index([siteId])
  @@index([result])
}

model Qualification {
  id                  String   @id @default(cuid())
  code                String   // unique per site
  equipmentId         String
  siteId              String
  qualificationType   String   // IQ | OQ | PQ
  protocol            String?
  acceptanceCriteria  String?  // user-defined, NEVER invented by system (PRD §5)
  executionResult     String?
  status              String   @default("REQUIREMENT") // REQUIREMENT | PROTOCOL | EXECUTION | RESULT | DEVIATION | APPROVAL | REPORT
  deviationId         String?  // link to Deviation if found
  approvedByUserId    String?
  approvedAt          DateTime?
  reportRef           String?
  evidenceDocumentId  String?
  isDemo              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  equipment  Equipment          @relation(fields: [equipmentId], references: [id], onDelete: Restrict)
  site       Site               @relation(fields: [siteId], references: [id], onDelete: Restrict)
  deviation  Deviation?         @relation("QualificationDeviation", fields: [deviationId], references: [id], onDelete: SetNull)
  approver   User?              @relation("QualificationApprover", fields: [approvedByUserId], references: [id], onDelete: SetNull)
  evidenceDocument ControlledDocument? @relation(fields: [evidenceDocumentId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([equipmentId])
  @@index([siteId])
  @@index([status])
  @@index([qualificationType])
}
```

**Relation additions:** `WorkCenter` gets `equipment Equipment[]`. `OperationExecution` gets optional `equipmentId String?` + `equipment Equipment? @relation(...)`. `Site` gets `equipment Equipment[]`, `maintenanceRecords MaintenanceRecord[]`, `calibrationRecords CalibrationRecord[]`, `qualifications Qualification[]`. `User` gets named relation arrays. `Deviation` gets `qualifications Qualification[] @relation("QualificationDeviation")`. `ControlledDocument` gets `maintenanceRecords[]`, `calibrationRecords[]`, `qualifications[]`.

---

## 5. API design

New permission module `equipment.*`.

```
# Equipment
GET    /api/equipment
POST   /api/equipment
GET    /api/equipment/:id
PATCH  /api/equipment/:id

# Maintenance
GET    /api/equipment/:id/maintenance
POST   /api/equipment/:id/maintenance
POST   /api/maintenance/:id/transition       (SCHEDULED->IN_PROGRESS->COMPLETED)

# Calibration
GET    /api/equipment/:id/calibration
POST   /api/equipment/:id/calibration        (creates record; updates equipment.calibrationStatus D2)

# Qualification
GET    /api/equipment/:id/qualifications
POST   /api/equipment/:id/qualifications
POST   /api/qualifications/:id/transition    (REQUIREMENT->PROTOCOL->EXECUTION->RESULT->DEVIATION->APPROVAL->REPORT)
POST   /api/qualifications/:id/approve       (human-only; AI MUST NEVER)
```

---

## 6. UI architecture

Pages under `[locale]/(app)/equipment/`:
- `equipment/` — list (code, type, operational/calibration status badges, WorkCenter link).
- `equipment/[id]/` — detail (maintenance tab, calibration tab, qualification tab).

**Nav:** add "Equipment" group to sidebar.

---

## 7. Security & audit

- **Permissions:** `equipment.read`, `equipment.create`, `equipment.update`, `equipment.maintenance.{read,create,transition}`, `equipment.calibration.{read,create}`, `equipment.qualification.{read,create,transition,approve}`. Least-privilege. AI never gets `approve` or `transition` for controlled actions.
- **Qualification approval:** human-only (AI must never approve; PRD §9).
- **Calibration status:** updated by service on calibration record creation (D2); not directly editable by users (derived from calibration records).
- **Never invent acceptance criteria:** Qualification.acceptanceCriteria is user-entered text; the system never populates it.

---

## 8. Testing

- **T-EQP-01:** Equipment CRUD + WorkCenter link.
- **T-CAL-01:** CalibrationRecord creation updates Equipment.calibrationStatus (D2).
- **T-CAL-02:** Calibration status logic (VALID/EXPIRING/EXPIRED/OUT_OF_SERVICE).
- **T-MAINT-01:** MaintenanceRecord state machine (SCHEDULED→IN_PROGRESS→COMPLETED).
- **T-QUAL-01:** Qualification state machine (REQUIREMENT→...→REPORT).
- **T-QUAL-02:** Qualification approval is human-only (AI must never approve).
- **T-QUAL-03:** Acceptance criteria never invented by system (field is user-entered).
- **T-ISOL-08:** Cross-site equipment isolation.
- **T-AI-GUARD-05:** AI governance.
- **Regression:** all 223 Phase 1-7 tests pass.

---

## 9. Open questions

- **D1 — Equipment vs WorkCenter:** confirm Equipment is separate, M:1 to WorkCenter? *(Recommendation: yes)*
- **D2 — Calibration status:** confirm stored on Equipment, updated by service? *(Recommendation: yes)*
- **D3 — Qualification scope:** confirm Equipment Qualification only (IQ/OQ/PQ); process/cleanroom/test-method validation deferred? *(Recommendation: yes)*
- **D4 — Qualification entity:** confirm single entity with type field (IQ/OQ/PQ)? *(Recommendation: yes)*
- **D5 — Maintenance scheduling:** confirm scheduled + unscheduled; no auto-actions? *(Recommendation: yes)*
- **D6 — Equipment-OperationExecution link:** confirm optional equipmentId on OperationExecution? *(Recommendation: yes)*
- **D7 — Site ownership:** confirm all site-owned? *(Recommendation: yes)*

---

```
PHASE 8 PLAN STATUS: WAITING FOR OWNER APPROVAL (and D1-D7 confirmation)
```

**I am stopping here.** Awaiting your approval and confirmation of D1–D7.
