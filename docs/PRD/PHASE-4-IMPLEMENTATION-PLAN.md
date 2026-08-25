# CIRCUM — PHASE 4 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 4 — Quality Foundation: Nonconformity (NCR), Deviation, Investigation (RCA), CAPA, Risk, Change Control
> **Predecessor:** Phase 3 (approved/closed). Builds on Production (WorkOrder/Batch/DeviceLot/Execution/Consumption) + Identity/Org/RBAC/Audit.
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only). Implementation gated on owner approval of this plan AND the domain decisions in §3.
> **Source of truth:** Circum Master PRD §5 (Quality/QMS: inspection, NCR/nonconformity, deviations, RCA, CAPA, change control, risk management, supplier quality, audits), §9 (AI governance — AI must never close CAPA/approve deviations/changes), §10 (Traceability), §6 (Batch Review references these), §16 (Docs), §17 (Validation-minded), §19/§20 (Phase Gate/Report). GLM Master Prompt §9 (Controlled Workflows state machines).
> **Scope rule (owner):** Phase 4 = Quality foundation. No Laboratory/Testing (Phase 5), no Equipment/Calibration (Phase 8), no Batch Review/Release (Phase 9), no OEE/VSM (Phase 10), no AI (Phase 12). Document Control is a *separate* phase (Phase 7 per PRD §18 roadmap) — Phase 4 does NOT build Document Control, but designs Quality entities to reference future controlled documents.
> **Critical owner constraint:** NCR ≠ Deviation ≠ CAPA. Investigation ≠ CAPA. Do NOT create duplicate/overlapping entities. Identify all ambiguities; if one affects the data model or controlled workflow, STOP and ask.

---

## 0. Reading guide

§1 Objectives. §2 PRD traceability. **§3 Domain model (the core) + 9 critical ambiguities (D1-D9) requiring owner confirmation.** §4 Proposed schema (pending §3). §5 API design. §6 UI architecture. §7 Security/Audit. §8 Multi-site. §9 Testing. §10 Migration. §11 Skills. §12 Files. §13 Risks. §14 Dependencies. §15 Acceptance. §16 Test plan. §17 Open questions.

```
PHASE 4 PLAN STATUS: WAITING FOR OWNER APPROVAL (and §3 domain decisions D1-D9)
```

---

## 1. Objectives

Phase 4 establishes the **Quality foundation**: the controlled records that capture nonconformities, planned departures, investigations, corrective/preventive actions, risk, and change control. These are the most regulated entities in the platform — every transition must be authorized, validated, audited, and preserve history (PRD §9, GLM §9). **AI must never** close CAPA, approve deviations/changes, or close critical problems (PRD §9).

This phase connects Quality to Production: an NCR can be raised against a Batch/DeviceLot/MaterialLot; a Deviation can authorize a planned departure from a Routing/BOM; a CAPA can link to a ProductionScrap/Rework. The genealogy (PRD §10) now extends: `...MaterialConsumption → [NCR/Deviation/CAPA can reference any production entity]`.

**Concrete objectives:**

1. **NCR (Nonconformity Report)** — record that something does not conform to requirements; link to the production entity it concerns; trigger containment → investigation → disposition → closure.
2. **Deviation** — a *planned* departure from an approved process/spec/BOM/routing, with assessment → investigation → review → closure. Distinct from NCR (unplanned).
3. **Investigation (RCA)** — the structured root-cause analysis linked to an NCR or Deviation. Distinct from CAPA (investigation finds the cause; CAPA acts on it).
4. **CAPA (Corrective and Preventive Action)** — actions to correct and prevent recurrence, with effectiveness verification before closure. Links to an Investigation.
5. **Risk** — a managed record of hazards, severity, probability, mitigations for a product/process. Foundation for risk-based decisions in Deviation/Change Control.
6. **Change Control** — governs changes to products/processes/documents/equipment, with impact → risk → approval → implementation → verification → effectiveness → closure.
7. **Full RBAC + audit + multi-site** — reuse Phase 1/2/3 infrastructure; new `quality.*` permissions; Quality records are site-scoped (the entity they concern is site-scoped); every transition audited with previousState/newState + reason.
8. **Future integration hooks** — design so Batch Review (Phase 9) can query NCR/Deviation/CAPA against a batch; Document Control (Phase 7) can link to Quality records; AI (Phase 12) can assist with hypotheses but never approve.

**Out of scope (explicit, per owner + PRD roadmap):** Laboratory/Testing/Inspection/Sample/Specification/Result (Phase 5), Equipment/Calibration/Maintenance (Phase 8), Cleanroom Monitoring (Phase 9), Packaging/Sterilization (Phase 9), Batch Review/Release/Disposition (Phase 9), OEE/VSM (Phase 10), AI Assistant (Phase 12), Document Control subsystem (Phase 7 — Phase 4 stores document *references* only, no document lifecycle), Training (Phase 7), Supplier Quality/Audits (Phase 7 — Phase 4's Supplier exists from Phase 2; full supplier quality is Phase 7).

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 4 coverage |
|---|---|---|---|
| R1 | NCR/nonconformity | §5 | NCR entity + state machine |
| R2 | Deviations | §5, GLM §9 | Deviation entity + state machine (planned departure) |
| R3 | RCA (root cause analysis) | §5, §10 | Investigation entity (linked to NCR/Deviation, distinct from CAPA) |
| R4 | CAPA | §5, GLM §9 | CAPA entity + state machine (effectiveness verification before closure) |
| R5 | Change control | §5, GLM §9 | ChangeControl entity + state machine |
| R6 | Risk management | §5 | RiskAssessment entity (hazards × severity × probability × mitigations) |
| R7 | Controlled records: unique ID, status, owner, evidence, approval history, audit trail, closure criteria | §5 | all Phase 4 entities carry these |
| R8 | Every controlled transition: authorize + validate + record actor/timestamp + audit + preserve history | §9, GLM §9 | explicit /transition endpoints, audited, state-machine-guarded |
| R9 | AI must NEVER close CAPA, close critical problems, approve deviations/changes/documents | §9 | AI (Phase 12) gets read-only + hypothesis permissions only; quality transitions require human authorization |
| R10 | Traceability: NCR/Deviation/CAPA reference production entities | §10 | links to Batch/DeviceLot/MaterialLot/WorkOrder/OperationExecution |
| R11 | DB constraints prevent duplicates, broken refs, unauthorized transitions | §10, §11 | FKs, uniques, state-machine guards |
| R12 | Normal users cannot edit/delete audit history | §10, §13 | reuse Phase 1 audit (append-only) |
| R13 | Layered architecture; critical logic not only in UI | §11 | modules/quality/{api,service,domain,infrastructure} |
| R14 | Local-first | §12 | all local DB |
| R15 | FR/EN/AR + RTL | §4 | next-intl catalogs extended |
| R16 | Professional industrial UI | §14 | quality pages (NCR/Deviation/CAPA/Change/Risk) |
| R17 | Phase Gate (§19) + Phase Validation Report (§20) | §19, §20 | full gate |
| R18 | PostgreSQL-portable (ADR-0002) | §11, ADR-0002 | no SQLite-only types |

---

## 3. Domain model (grill-with-docs + domain-modeling)

> This is the heart of Phase 4. Terms are extracted from the PRD (§5, §9, §10) and GLM §9, sharpened via the `domain-modeling` discipline. **The owner explicitly directed: NCR ≠ Deviation ≠ CAPA, and Investigation ≠ CAPA. Do NOT create duplicate/overlapping entities.** Where the PRD is silent on a precise boundary, the resolution is marked PROPOSED and requires owner confirmation (§3.10). Nothing is invented; every proposal traces to a PRD concept.

### 3.1 NCR vs Deviation (D1 — CRITICAL, owner-flagged)

**PRD evidence:** §5 "NCR/nonconformity, deviations"; §10 "NCR" in genealogy context; CONTEXT.md "Deviation = a controlled record of a *planned* departure"; "NCR = a record that something does not conform to requirements."

**Owner constraint:** "NCR ≠ Deviation."

**Proposed resolution (D1):** They are separate entities with distinct semantics:
- **NCR (Nonconformity Report)**: an **unplanned** discovery that something does not conform to requirements (e.g., a failed in-process check, a defective device lot found, a material lot out of spec). Reactive. State machine: `DRAFT → CONTAINMENT → INVESTIGATION → DISPOSITION → CLOSED` (+CANCELLED).
- **Deviation**: a **planned** departure from an approved process/spec/BOM/routing, requested *before* execution (e.g., "we need to use a substitute material for this one batch because the specified one is unavailable"). Proactive/authorized. State machine (GLM §9): `DRAFT → ASSESSMENT → INVESTIGATION → REVIEW → CLOSED` (+REJECTED, +CANCELLED).

**Key distinction:** NCR = "something went wrong" (reactive); Deviation = "we plan to do something different" (proactive, pre-authorized). An NCR may *trigger* an Investigation which may *trigger* a CAPA. A Deviation is a separate controlled record that authorizes a one-time departure.

**If the owner disagrees:** alternative is a single "QualityEvent" entity with a type field. Rejected — the PRD and GLM §9 give them different state machines, confirming they are distinct controlled records. **Please confirm D1.**

### 3.2 Investigation (RCA) vs CAPA (D2 — CRITICAL, owner-flagged)

**PRD evidence:** §5 "RCA, CAPA"; GLM §9: Deviation has "Investigation" as a state; CAPA has "Investigation" as a state too. CONTEXT.md "RCA = the structured investigation identifying the root cause"; "CAPA = actions to correct and prevent recurrence."

**Owner constraint:** "Investigation ≠ CAPA."

**Proposed resolution (D2):** Investigation is a **distinct entity** (not a state inside CAPA). It is the structured root-cause analysis. An Investigation links to the source record (NCR or Deviation) and *may* produce one or more CAPAs.
- **Investigation (RCA)**: entity. Fields: sourceNcrId?, sourceDeviationId?, methodology, findings, rootCause, concludedAt, status. An NCR/Deviation transitions to INVESTIGATION state by *creating* an Investigation linked to it.
- **CAPA**: entity. Fields: investigationId (the source investigation), type (CORRECTIVE/PREVENTIVE/BOTH), actionPlan, implementationOwner, implementedAt?, effectivenessVerifiedAt?, status. State machine (GLM §9): `OPEN → ACTION_PLAN → IMPLEMENTATION → EFFECTIVENESS → CLOSED`.

**Key distinction:** Investigation *finds the cause*; CAPA *acts on the cause*. One Investigation may yield multiple CAPAs (a corrective action + a preventive action). CAPA cannot exist without a preceding Investigation. This avoids the "Investigation as a CAPA state" anti-pattern that conflates analysis with action.

**If the owner prefers Investigation embedded in CAPA:** would duplicate the investigation logic across NCR and CAPA. The separate-entity approach is cleaner and matches "Investigation ≠ CAPA." **Please confirm D2.**

### 3.3 NCR state machine (D3)

**PRD evidence:** GLM §9 does not give an NCR state machine (only Deviation, CAPA, Change, Batch). DOMAIN_GLOSSARY §4.6 proposed: `Draft → Containment → Investigation → Disposition → Closure`.

**Proposed resolution (D3):**
```
DRAFT → CONTAINMENT → INVESTIGATION → DISPOSITION → CLOSED
                ↓           ↓
            CANCELLED    (links to Investigation entity, which may spawn CAPA)
```
- `DRAFT`: NCR created, not yet acted upon.
- `CONTAINMENT`: immediate containment action taken (quarantine the lot, stop production, etc.).
- `INVESTIGATION`: an Investigation (RCA) entity is created and linked; root cause being determined.
- `DISPOSITION`: decision on the nonconforming item (use-as-is, rework, regrade, scrap, return to supplier). Links to ProductionScrap/ProductionRework if applicable.
- `CLOSED`: closure criteria met (containment done, investigation done, disposition done, CAPA effectiveness verified if a CAPA was opened).
- `CANCELLED`: withdrawn before containment (terminal).

**Please confirm D3.**

### 3.4 Deviation state machine (D4)

**PRD evidence:** GLM §9: `Draft → Assessment → Investigation → Review → Closure`.

**Proposed resolution (D4):**
```
DRAFT → ASSESSMENT → INVESTIGATION → REVIEW → CLOSED
                ↓           ↓             ↓
            REJECTED    (Investigation)  REJECTED
```
- `DRAFT`: deviation requested.
- `ASSESSMENT`: impact assessment (what does this departure affect? quality? safety? regulatory?).
- `INVESTIGATION`: optional — if the deviation needs root-cause analysis (not all deviations do; some are simple "we can't get part X, use Y" with no investigation needed). An Investigation entity *may* be created here.
- `REVIEW`: QA review of the assessment (+ investigation if any) and decision: approve the deviation (proceed with the departure) or reject.
- `CLOSED`: the deviation is closed (either the one-time departure was completed, or it was rejected).
- `REJECTED`: QA rejected the deviation (terminal).

**Key point:** A Deviation's Investigation is *optional* (some deviations are trivial); an NCR's Investigation is expected (something went wrong, find out why). Both use the same Investigation entity.

**Please confirm D4.**

### 3.5 CAPA state machine (D5)

**PRD evidence:** GLM §9: `Open → Investigation → Action Plan → Implementation → Effectiveness → Closure`.

**Proposed resolution (D5):** Adapted to the separate Investigation entity (D2):
```
OPEN → ACTION_PLAN → IMPLEMENTATION → EFFECTIVENESS → CLOSED
```
- `OPEN`: CAPA created, linked to an Investigation (which is already complete or in progress).
- `ACTION_PLAN`: the corrective/preventive action is planned (what will be done, by whom, by when).
- `IMPLEMENTATION`: the action is being implemented.
- `EFFECTIVENESS`: effectiveness verification (did the action work? evidence required).
- `CLOSED`: effectiveness verified, CAPA closed. **AI must never close a CAPA** (PRD §9).

Note: the GLM "Investigation" state in CAPA is removed because Investigation is now a separate entity (D2) that precedes CAPA creation. CAPA starts at OPEN after the Investigation concludes.

**Please confirm D5.**

### 3.6 Change Control state machine (D6)

**PRD evidence:** GLM §9: `Request → Impact → Risk → Approval → Implementation → Verification → Effectiveness → Closure`.

**Proposed resolution (D6):**
```
REQUEST → IMPACT → RISK → APPROVAL → IMPLEMENTATION → VERIFICATION → EFFECTIVENESS → CLOSED
                                    ↓
                                 REJECTED
```
- `REQUEST`: change requested (what changes, why).
- `IMPACT`: impact assessment (what does this change affect? products? processes? documents? equipment? validation?).
- `RISK`: risk assessment (link to RiskAssessment entity if a new risk is identified, or reference existing).
- `APPROVAL`: QA/management approval decision (approve/reject). **AI must never approve a change** (PRD §9).
- `IMPLEMENTATION`: the change is being implemented.
- `VERIFICATION`: verification that the change was implemented correctly.
- `EFFECTIVENESS`: effectiveness verification (did the change achieve its goal?).
- `CLOSED`: closure.
- `REJECTED`: rejected at approval (terminal).

**Please confirm D6.**

### 3.7 Risk model (D7)

**PRD evidence:** §5 "risk management"; CONTEXT.md "Risk = hazards × severity × probability × mitigations."

**Proposed resolution (D7):** A **RiskAssessment** entity (not a state machine — it's a record):
- Fields: `subjectType` (PRODUCT/PROCESS/EQUIPMENT/BATCH/DEVIATION/CHANGE), `subjectId`, `hazard`, `severity` (1-5 configurable), `probability` (1-5 configurable), `riskPriorityNumber` (severity × probability, computed), `mitigations` (text), `residualRisk?`, `assessedBy`, `assessedAt`, `status` (OPEN/MITIGATED/CLOSED), `linkedChangeControlId?`, `linkedDeviationId?`.
- A RiskAssessment can be referenced by a Deviation (impact assessment) or Change Control (risk step).
- This is the foundation; full FMEA/risk matrix UI is a future refinement.

**Please confirm D7.**

### 3.8 Linkage to Production (D8)

**PRD evidence:** §10 genealogy; §6 Batch Review includes "deviations, NCR, CAPA."

**Proposed resolution (D8):** Quality records link to production entities via a polymorphic-ish reference (stored as `entityType` + `entityId` strings, validated in the service layer against the actual entity):
- NCR: `concernsEntityType` (BATCH/DEVICE_LOT/MATERIAL_LOT/WORK_ORDER/OPERATION_EXECUTION/PRODUCT_REVISION/MATERIAL/SUPPLIER) + `concernsEntityId`.
- Deviation: `appliesToEntityType` + `appliesToEntityId` (what the departure applies to: a ROUTING/OPERATION/BOM/BATCH).
- CAPA: links via Investigation → NCR/Deviation → production entity (transitive).
- ProductionScrap/ProductionRework (Phase 3) can reference an NCR via a new optional `ncrId` field (added in Phase 4).
- This avoids hard foreign keys to every production entity (which would be many nullable FKs) while preserving traceability. The service layer validates the entity exists.

**Alternative:** hard FKs to each production entity type (many nullable columns). Rejected — sparse, hard to extend. **Please confirm D8 (polymorphic reference).**

### 3.9 Document Control boundary (D9)

**PRD evidence:** §5 Document Control is a separate module; PRD §18 roadmap puts it in Phase 7.

**Proposed resolution (D9):** Phase 4 does **NOT** build Document Control. Quality entities store document *references* as strings (e.g., `evidenceDocumentRef`, `procedureRef`) — a placeholder for the future controlled-document link (Phase 7). When Phase 7 lands, these become foreign keys to a `ControlledDocument` entity. No document lifecycle, no approval workflow, no versioning in Phase 4.

**Please confirm D9.**

### 3.10 Summary of proposed domain decisions (all require owner confirmation)

| # | Decision | Proposed | Alternative | Recommendation |
|---|---|---|---|---|
| D1 | NCR vs Deviation | Separate entities: NCR = unplanned nonconformity (reactive); Deviation = planned departure (proactive) | Single QualityEvent with type | **Proposed** (PRD/GLM give different state machines) |
| D2 | Investigation vs CAPA | Investigation = separate entity (finds cause); CAPA = separate entity (acts on cause). 1 Investigation : N CAPAs | Investigation as a CAPA state | **Proposed** (owner: Investigation ≠ CAPA) |
| D3 | NCR state machine | DRAFT→CONTAINMENT→INVESTIGATION→DISPOSITION→CLOSED +CANCELLED | Simpler | **Proposed** (DOMAIN_GLOSSARY §4.6) |
| D4 | Deviation state machine | DRAFT→ASSESSMENT→INVESTIGATION→REVIEW→CLOSED +REJECTED (Investigation optional) | Mandatory investigation | **Proposed** (GLM §9; investigation optional for trivial deviations) |
| D5 | CAPA state machine | OPEN→ACTION_PLAN→IMPLEMENTATION→EFFECTIVENESS→CLOSED (Investigation removed, it's a separate entity) | GLM's 6-state with Investigation | **Proposed** (D2 makes Investigation separate) |
| D6 | Change Control state machine | REQUEST→IMPACT→RISK→APPROVAL→IMPLEMENTATION→VERIFICATION→EFFECTIVENESS→CLOSED +REJECTED | Simpler | **Proposed** (GLM §9) |
| D7 | Risk model | RiskAssessment entity (hazard×severity×probability=RPN, mitigations, status) | FMEA matrix | **Proposed** (foundation; full FMEA later) |
| D8 | Linkage to Production | Polymorphic reference (entityType + entityId strings, service-validated) | Hard FKs to every production entity | **Proposed** (extensible, avoids sparse FKs) |
| D9 | Document Control boundary | Phase 4 stores document *references* (strings) only; no Document Control subsystem (Phase 7) | Build Document Control now | **Proposed** (PRD §18 roadmap: Phase 7) |

**If any of D1–D9 is not confirmed, the schema in §4 cannot be finalized.** I will NOT implement until these are resolved.

### 3.11 Entity definitions (assuming D1–D9 as proposed)

- **NCR** — Nonconformity Report. Fields: `code` (unique per site), `siteId`, `concernsEntityType`, `concernsEntityId`, `description`, `severity` (MINOR/MAJOR/CRITICAL), `status` (D3 state machine), `containmentAction?`, `disposition?` (USE_AS_IS/REWORK/REGRADE/SCRAP/RETURN_TO_SUPPLIER), `createdByUserId`, `assignedToUserId?`, `investigationId?` (linked when INVESTIGATION), `evidenceDocumentRef?`, `closedAt?`, `closureNotes?`, `isDemo`. Site-owned.
- **Deviation** — planned departure. Fields: `code`, `siteId`, `appliesToEntityType`, `appliesToEntityId`, `description`, `justification`, `impactAssessment?`, `riskAssessmentId?`, `status` (D4), `approvedByUserId?`, `approvedAt?`, `investigationId?` (optional), `evidenceDocumentRef?`, `validFrom?`, `validUntil?`, `isDemo`. Site-owned.
- **Investigation** — RCA. Fields: `code`, `siteId`, `sourceType` (NCR/DEVIATION), `sourceNcrId?`, `sourceDeviationId?`, `methodology`, `findings`, `rootCause`, `concludedAt?`, `status` (IN_PROGRESS/CONCLUDED), `conductedByUserId?`, `evidenceDocumentRef?`, `isDemo`. Site-owned.
- **CAPA** — corrective/preventive action. Fields: `code`, `siteId`, `investigationId`, `type` (CORRECTIVE/PREVENTIVE/BOTH), `actionPlan`, `implementationOwnerUserId?`, `implementedAt?`, `effectivenessVerification?`, `effectivenessVerifiedAt?`, `effectivenessVerifiedByUserId?`, `status` (D5), `closedByUserId?`, `closedAt?`, `evidenceDocumentRef?`, `isDemo`. Site-owned.
- **ChangeControl** — governed change. Fields: `code`, `siteId`, `changeType` (PRODUCT/PROCESS/DOCUMENT/EQUIPMENT/OTHER), `description`, `reason`, `impactAssessment?`, `riskAssessmentId?`, `status` (D6), `approvedByUserId?`, `approvedAt?`, `implementationPlan?`, `verificationPlan?`, `effectivenessVerification?`, `closedAt?`, `evidenceDocumentRef?`, `isDemo`. Site-owned.
- **RiskAssessment** — risk record. Fields: `code`, `siteId`, `subjectType`, `subjectId`, `hazard`, `severity` (Int 1-5), `probability` (Int 1-5), `riskPriorityNumber` (Int, computed = severity × probability), `mitigations`, `residualRisk?`, `status` (OPEN/MITIGATED/CLOSED), `assessedByUserId?`, `linkedChangeControlId?`, `linkedDeviationId?`, `isDemo`. Site-owned.

**Relation additions to existing models:** `ProductionScrap.ncrId?`, `ProductionRework.ncrId?` (optional link to an NCR for traceability).

---

## 4. Database schema (proposed, pending §3 confirmation)

PG-portable Prisma additions. No SQLite-only types. Additive to Phase 1+2+3.

```prisma
// ============================================================================
// Quality foundation (Phase 4)
// D1: NCR (unplanned) ≠ Deviation (planned). D2: Investigation (finds cause) ≠ CAPA (acts).
// D8: polymorphic reference (entityType + entityId) to production entities.
// D9: document references are strings (Phase 7 adds ControlledDocument FK).
// Genealogy: NCR/Deviation/CAPA reference any production entity (Batch/DeviceLot/MaterialLot/...).
// ============================================================================

model NCR {
  id                  String   @id @default(cuid())
  code                String // unique per site
  siteId              String // SITE-OWNED
  concernsEntityType  String // BATCH | DEVICE_LOT | MATERIAL_LOT | WORK_ORDER | OPERATION_EXECUTION | PRODUCT_REVISION | MATERIAL | SUPPLIER
  concernsEntityId    String
  description         String
  severity            String   @default("MAJOR") // MINOR | MAJOR | CRITICAL
  status              String   @default("DRAFT") // DRAFT | CONTAINMENT | INVESTIGATION | DISPOSITION | CLOSED | CANCELLED
  containmentAction   String?
  disposition         String? // USE_AS_IS | REWORK | REGRADE | SCRAP | RETURN_TO_SUPPLIER
  createdByUserId     String?
  assignedToUserId    String?
  investigationId     String? // linked when INVESTIGATION
  evidenceDocumentRef String? // D9: string ref; Phase 7 adds ControlledDocument FK
  closedAt            DateTime?
  closureNotes        String?
  isDemo              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  site          Site           @relation(fields: [siteId], references: [id], onDelete: Restrict)
  creator       User?          @relation("NcrCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)
  assignee      User?          @relation("NcrAssignee", fields: [assignedToUserId], references: [id], onDelete: SetNull)
  investigation Investigation? @relation(fields: [investigationId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([siteId])
  @@index([status])
  @@index([concernsEntityType, concernsEntityId])
}

model Deviation {
  id                   String   @id @default(cuid())
  code                 String // unique per site
  siteId               String // SITE-OWNED
  appliesToEntityType  String // ROUTING | OPERATION | BOM | BOM_LINE | BATCH | PRODUCT_REVISION
  appliesToEntityId    String
  description          String
  justification        String
  impactAssessment     String?
  riskAssessmentId     String?
  status               String   @default("DRAFT") // DRAFT | ASSESSMENT | INVESTIGATION | REVIEW | CLOSED | REJECTED
  approvedByUserId     String?
  approvedAt           DateTime?
  investigationId      String? // optional (D4)
  evidenceDocumentRef  String?
  validFrom            DateTime?
  validUntil           DateTime?
  isDemo               Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  site          Site            @relation(fields: [siteId], references: [id], onDelete: Restrict)
  approver      User?           @relation("DeviationApprover", fields: [approvedByUserId], references: [id], onDelete: SetNull)
  investigation Investigation?  @relation(fields: [investigationId], references: [id], onDelete: SetNull)
  riskAssessment RiskAssessment? @relation(fields: [riskAssessmentId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([siteId])
  @@index([status])
  @@index([appliesToEntityType, appliesToEntityId])
}

model Investigation {
  id                   String   @id @default(cuid())
  code                 String // unique per site
  siteId               String // SITE-OWNED
  sourceType           String // NCR | DEVIATION
  sourceNcrId          String?
  sourceDeviationId    String?
  methodology          String
  findings             String?
  rootCause            String?
  concludedAt          DateTime?
  status               String   @default("IN_PROGRESS") // IN_PROGRESS | CONCLUDED
  conductedByUserId    String?
  evidenceDocumentRef  String?
  isDemo               Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  site     Site   @relation(fields: [siteId], references: [id], onDelete: Restrict)
  ncr      NCR?   @relation(fields: [sourceNcrId], references: [id], onDelete: SetNull)
  deviation Deviation? @relation(fields: [sourceDeviationId], references: [id], onDelete: SetNull)
  conductor User?  @relation("InvestigationConductor", fields: [conductedByUserId], references: [id], onDelete: SetNull)
  capas    CAPA[]

  @@unique([siteId, code])
  @@index([siteId])
  @@index([sourceType])
}

model CAPA {
  id                       String   @id @default(cuid())
  code                     String // unique per site
  siteId                   String // SITE-OWNED
  investigationId          String
  type                     String   @default("CORRECTIVE") // CORRECTIVE | PREVENTIVE | BOTH
  actionPlan               String
  implementationOwnerUserId String?
  implementedAt            DateTime?
  effectivenessVerification String?
  effectivenessVerifiedAt  DateTime?
  effectivenessVerifiedByUserId String?
  status                   String   @default("OPEN") // OPEN | ACTION_PLAN | IMPLEMENTATION | EFFECTIVENESS | CLOSED
  closedByUserId           String?
  closedAt                 DateTime?
  evidenceDocumentRef      String?
  isDemo                   Boolean  @default(false)
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt

  site           Site          @relation(fields: [siteId], references: [id], onDelete: Restrict)
  investigation  Investigation @relation(fields: [investigationId], references: [id], onDelete: Restrict)
  implementer    User?         @relation("CapaImplementer", fields: [implementationOwnerUserId], references: [id], onDelete: SetNull)
  effectivenessVerifier User? @relation("CapaEffectivenessVerifier", fields: [effectivenessVerifiedByUserId], references: [id], onDelete: SetNull)
  closer         User?         @relation("CapaCloser", fields: [closedByUserId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([siteId])
  @@index([status])
  @@index([investigationId])
}

model ChangeControl {
  id                   String   @id @default(cuid())
  code                 String // unique per site
  siteId               String // SITE-OWNED
  changeType           String // PRODUCT | PROCESS | DOCUMENT | EQUIPMENT | OTHER
  description          String
  reason               String
  impactAssessment     String?
  riskAssessmentId     String?
  status               String   @default("REQUEST") // REQUEST | IMPACT | RISK | APPROVAL | IMPLEMENTATION | VERIFICATION | EFFECTIVENESS | CLOSED | REJECTED
  approvedByUserId     String?
  approvedAt           DateTime?
  implementationPlan   String?
  verificationPlan     String?
  effectivenessVerification String?
  closedAt             DateTime?
  evidenceDocumentRef  String?
  isDemo               Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  site            Site            @relation(fields: [siteId], references: [id], onDelete: Restrict)
  approver        User?           @relation("ChangeApprover", fields: [approvedByUserId], references: [id], onDelete: SetNull)
  riskAssessment  RiskAssessment? @relation(fields: [riskAssessmentId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([siteId])
  @@index([status])
  @@index([changeType])
}

model RiskAssessment {
  id                     String   @id @default(cuid())
  code                   String // unique per site
  siteId                 String // SITE-OWNED
  subjectType            String // PRODUCT | PROCESS | EQUIPMENT | BATCH | DEVIATION | CHANGE
  subjectId              String
  hazard                 String
  severity               Int // 1-5 (configurable)
  probability            Int // 1-5 (configurable)
  riskPriorityNumber     Int // severity × probability (computed in service)
  mitigations            String
  residualRisk           String?
  status                 String   @default("OPEN") // OPEN | MITIGATED | CLOSED
  assessedByUserId       String?
  linkedChangeControlId  String?
  linkedDeviationId      String?
  isDemo                 Boolean  @default(false)
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  site      Site      @relation(fields: [siteId], references: [id], onDelete: Restrict)
  assessor  User?     @relation("RiskAssessor", fields: [assessedByUserId], references: [id], onDelete: SetNull)
  change    ChangeControl? @relation("RiskForChange", fields: [linkedChangeControlId], references: [id], onDelete: SetNull)
  deviation Deviation?    @relation("RiskForDeviation", fields: [linkedDeviationId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([siteId])
  @@index([status])
  @@index([subjectType, subjectId])
}
```

**Relation additions to existing models:** `ProductionScrap.ncrId?`, `ProductionRework.ncrId?` (optional NCR link for traceability). `Site` gets `ncrs[]`, `deviations[]`, `investigations[]`, `capas[]`, `changeControls[]`, `riskAssessments[]`. `User` gets the named relation arrays for each role (creator/approver/assignee/conductor/implementer/verifier/closer/assessor).

---

## 5. API design

New permission module `quality`. Thin handlers, zod-validated, envelope, RBAC-guarded. Explicit `/transition` endpoints for all state machines.

```
# NCR
GET    /api/quality/ncrs
POST   /api/quality/ncrs
GET    /api/quality/ncrs/:id
POST   /api/quality/ncrs/:id/transition        (DRAFT->CONTAINMENT->INVESTIGATION->DISPOSITION->CLOSED; +CANCELLED)

# Deviation
GET    /api/quality/deviations
POST   /api/quality/deviations
GET    /api/quality/deviations/:id
POST   /api/quality/deviations/:id/transition  (DRAFT->ASSESSMENT->INVESTIGATION->REVIEW->CLOSED; +REJECTED)

# Investigation
GET    /api/quality/investigations
POST   /api/quality/investigations              (created from an NCR or Deviation)
GET    /api/quality/investigations/:id
PATCH  /api/quality/investigations/:id           (update findings/rootCause)
POST   /api/quality/investigations/:id/conclude  (IN_PROGRESS -> CONCLUDED)

# CAPA
GET    /api/quality/capas
POST   /api/quality/capas                        (created from an Investigation)
GET    /api/quality/capas/:id
POST   /api/quality/capas/:id/transition         (OPEN->ACTION_PLAN->IMPLEMENTATION->EFFECTIVENESS->CLOSED)

# Change Control
GET    /api/quality/changes
POST   /api/quality/changes
GET    /api/quality/changes/:id
POST   /api/quality/changes/:id/transition       (REQUEST->...->CLOSED; +REJECTED)

# Risk Assessment
GET    /api/quality/risks
POST   /api/quality/risks
GET    /api/quality/risks/:id
PATCH  /api/quality/risks/:id
```

**Controlled transitions:** every `/transition` endpoint validates the current state → target state (state-machine guard), authorizes via `requirePermission`, records the actor, emits an AuditEvent with previousState/newState + reason. **No arbitrary state mutation.**

**CAPA closure guard:** CAPA cannot transition to CLOSED unless `effectivenessVerification` is non-empty and `effectivenessVerifiedByUserId` is set (human verification required; PRD §9 — AI must never close CAPA).

**Change Control approval guard:** APPROVAL → IMPLEMENTATION requires `approvedByUserId` + `approvedAt` (human approval; PRD §9 — AI must never approve a change).

---

## 6. UI architecture

New pages under `[locale]/(app)/quality/`:
- `ncrs/` — NCR list (site-scoped, status badges, severity badges), create dialog, detail (transition buttons, linked investigation/disposition).
- `deviations/` — Deviation list + detail (impact assessment, approval, valid-from/until).
- `investigations/` — Investigation list + detail (methodology, findings, root cause, link to CAPAs).
- `capas/` — CAPA list + detail (action plan, implementation, effectiveness verification, closure).
- `changes/` — Change Control list + detail (impact, risk, approval, implementation, verification, effectiveness).
- `risks/` — Risk Assessment list + detail (hazard, severity/probability/RPN, mitigations).

**Nav:** add "Quality" group to sidebar (NCRs, Deviations, Investigations, CAPAs, Changes, Risks), permission-gated.

**i18n:** extend catalogs with `quality.*` keys (FR/EN/AR). RTL-safe.

**Demo seed:** add to `prisma/seed.ts`: a demo NCR against BATCH-CH-001 (CRITICAL, INVESTIGATION), an Investigation linked to it (CONCLUDED, root cause found), a CAPA linked to the Investigation (IMPLEMENTATION), a Deviation for a substitute material (REVIEW), a Change Control (APPROVAL), a RiskAssessment for a product. All `isDemo: true`.

---

## 7. Security & audit

- **Permissions:** new `quality.*` catalog: `quality.ncr.{read,create,transition}`, `quality.deviation.{read,create,transition,approve}`, `quality.investigation.{read,create,conclude}`, `quality.capa.{read,create,transition,close}`, `quality.change.{read,create,transition,approve}`, `quality.risk.{read,create,update}`. Least-privilege grants (Quality Manager/QA Reviewer/Quality Engineer create+transition; Production Manager read; Auditor read-only; Operator read-only; Site Admin read+create; super_admin full).
- **3-layer enforcement** (reuse Phase 1).
- **AI governance (PRD §9):** no `quality.*.transition` or `quality.*.approve` permission is ever granted to an AI role (Phase 12). The service layer enforces human-only on CAPA closure, Deviation approval, Change approval. Documented in ADR.
- **Audit:** every create/update/transition/approve/conclude emits AuditEvent with previousState/newState + reason.
- **Controlled-record defense in depth:** state machines enforced in service; future DB-level guards (Phase 13).

---

## 8. Multi-site (site scope)

All Phase 4 entities (NCR, Deviation, Investigation, CAPA, ChangeControl, RiskAssessment) are **site-owned** (`siteId` required, SiteScope + assertSiteAccess). Cross-site leakage = CRITICAL defect. A Quality record at Site A cannot be seen/transitioned by a user scoped to Site B (unless super_admin global). When PG lands (ADR-0002), RLS policies on all quality tables.

---

## 9. Testing

Reuse Phase 1/2/3 test infrastructure. New critical tests:
- **T-NCR-01:** NCR state machine (DRAFT→CONTAINMENT→INVESTIGATION→DISPOSITION→CLOSED; DRAFT→CLOSED invalid; +CANCELLED).
- **T-DEV-01:** Deviation state machine (DRAFT→ASSESSMENT→REVIEW→CLOSED; +REJECTED; Investigation optional).
- **T-INV-01:** Investigation created from NCR; links; CONCLUDED status; can spawn CAPA.
- **T-CAPA-01:** CAPA state machine (OPEN→ACTION_PLAN→IMPLEMENTATION→EFFECTIVENESS→CLOSED); **closure blocked without effectiveness verification** (PRD §9 guard).
- **T-CHG-01:** Change Control state machine (REQUEST→...→CLOSED; +REJECTED); **implementation blocked without human approval** (PRD §9 guard).
- **T-RISK-01:** RPN computed = severity × probability; range 1-25.
- **T-ISOL-04:** Cross-site Quality isolation (Site-A user sees 0 Site-B NCRs).
- **T-LINK-01:** NCR links to a Batch (polymorphic reference, D8); genealogy queryable.
- **T-AI-GUARD-01:** (static/contract) no `quality.*.transition`/`approve` permission exists for an AI role; service rejects non-human actors on CAPA closure/Deviation approval/Change approval.
- **Regression:** all 84 Phase 1+2+3 tests still pass.

---

## 10. Migration strategy

- **Schema:** additive Prisma migration (`phase4_quality`) on top of Phase 3. No changes to Phase 1/2/3 tables except adding `ncrId?` to ProductionScrap/ProductionRework + relation arrays to Site/User.
- **Seed:** extend `prisma/seed.ts` with Phase 4 demo data (idempotent upserts).
- **PG-portable:** no SQLite-only types. PG migration will add CHECK constraints (severity 1-5, probability 1-5).
- **No data loss:** Phase 1/2/3 data preserved.

---

## 11. Matt Pocock skills to use

| Activity | Skill |
|---|---|
| Resolve D1-D9 ambiguities | `grill-with-docs` (→ `grilling` + `domain-modeling`) — this plan IS the grilled output |
| Maintain CONTEXT.md / DOMAIN_GLOSSARY.md | `domain-modeling` |
| Design the quality module seams | `codebase-design` |
| Turn this plan into a spec | `to-spec` |
| Break into tickets | `to-tickets` |
| Implement (after approval) | `tdd` + `implement` |
| Debug hard issues (state machine guards) | `diagnosing-bugs` |
| Phase gate quality | `code-review` |

Skills never override the PRD (ADR-0001).

---

## 12. Files / modules to change (after approval)

**New:**
- `src/modules/quality/{domain,service}/index.ts`
- `src/app/api/quality/**` (route handlers)
- `src/app/[locale]/(app)/quality/{ncrs,deviations,investigations,capas,changes,risks}/page.tsx`
- `src/components/app/quality/*.tsx`
- `prisma/migrations/<ts>_phase4_quality/migration.sql`
- `docs/adr/0010-ncr-vs-deviation-vs-capa-distinction.md` (D1/D2)
- `docs/adr/0011-quality-production-polymorphic-linkage.md` (D8)
- `docs/api/quality.md`
- `.scratch/phase-4/{spec.md,issues/NN-*.md}`

**Modified:** `prisma/schema.prisma` (Phase 4 models + ProductionScrap/Rework ncrId + Site/User relations), `prisma/seed.ts` (Phase 4 demo data), `src/lib/permissions.ts` (quality.* permissions + grants), `src/components/app/app-sidebar.tsx` (Quality nav group), `src/messages/{en,fr,ar}.json` (quality.* keys), `CONTEXT.md` + `DOMAIN_GLOSSARY.md` (Phase 4 terms), `docs/architecture/rbac-matrix.md` (quality permissions).

---

## 13. Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| P4-R1 | D1-D9 unconfirmed → schema blocked | H | Critical | this plan flags them; NO implementation until confirmed |
| P4-R2 | NCR/Deviation/CAPA overlap → duplicate records | M | High | D1/D2 strictly separate them; state machines differ; service prevents mis-creation |
| P4-R3 | Polymorphic reference (D8) loses referential integrity | M | Medium | service validates entity exists; PG could add a validation trigger; acceptable for Phase 4 |
| P4-R4 | CAPA closed without effectiveness (regulatory failure) | M | Critical | service guard blocks CLOSED without effectivenessVerification + verifier; audited |
| P4-R5 | Change approved without human (PRD §9 violation) | M | Critical | service guard blocks IMPLEMENTATION without approvedByUserId; AI never gets approve permission |
| P4-R6 | Document Control needed now (not Phase 7) | L | M | D9 stores string refs; Phase 7 adds ControlledDocument FK; no rework |
| P4-R7 | Risk model too simple (no FMEA matrix) | L | L | foundation is sufficient; FMEA is a future UI refinement on RiskAssessment |
| P4-R8 | Quality records cross-reference Phase 3 production entities that don't exist at the site | L | M | service validates the production entity's site matches the quality record's site |

---

## 14. Dependencies

- **No new runtime deps.** Reuses Phase 1/2/3 stack.
- **Phase 3 foundation required:** Production (Batch/DeviceLot/MaterialLot/WorkOrder/Execution/Scrap/Rework) for linkage (D8).
- **Phase 1 foundation required:** User/Employee, Site/SiteScope, audit, RBAC (all present).

---

## 15. Acceptance criteria (definition of done)

Phase 4 is DONE only when ALL hold (PRD §19 Phase Gate):

1. NCR/Deviation/Investigation/CAPA/ChangeControl/RiskAssessment entities exist with the §4 schema (after D1-D9 confirmation).
2. NCR/Deviation/CAPA/ChangeControl state machines enforced + audited (D3/D4/D5/D6); tested T-NCR-01, T-DEV-01, T-CAPA-01, T-CHG-01.
3. Investigation is a separate entity (D2); links to NCR/Deviation; can spawn CAPAs; tested T-INV-01.
4. CAPA closure blocked without effectiveness verification (PRD §9); tested T-CAPA-01.
5. Change implementation blocked without human approval (PRD §9); tested T-CHG-01.
6. RiskAssessment RPN computed (severity × probability); tested T-RISK-01.
7. Polymorphic linkage to production entities (D8); NCR references a Batch; tested T-LINK-01.
8. All site-owned quality entities respect SiteScope; cross-site isolation tested (T-ISOL-04).
9. Every create/update/transition/approve/conclude audited with previousState/newState + reason.
10. RBAC: quality.* permissions, 3-layer, least-privilege; AI never gets transition/approve perms (T-AI-GUARD-01).
11. i18n: all UI strings from catalogs; FR/EN/AR; RTL-safe.
12. Demo seed: synthetic, labelled DEMO/TEST, covers all quality entities + linkage to production.
13. All Phase 1+2+3 tests still pass (84); new Phase 4 tests pass.
14. Lint 0 errors; typecheck clean.
15. Browser-verified: create NCR → investigate → CAPA → close; cross-site denial visible.
16. ADRs 0010 (NCR/Deviation/CAPA distinction) + 0011 (polymorphic linkage) written.
17. Phase 4 Validation Report produced; STOP; owner approval.

---

## 16. Test plan (summary)

| Layer | What | Critical tests |
|---|---|---|
| Unit | state machines (NCR/Deviation/CAPA/Change), RPN computation, closure guards | T-NCR-01, T-DEV-01, T-CAPA-01, T-CHG-01, T-RISK-01 |
| Integration | NCR → Investigation → CAPA flow; Deviation approval; Change approval | T-INV-01, T-LINK-01 |
| API | envelope, 401/403/400/409/422/200 | each endpoint |
| Authz | can() per role; AI-guard | T-AI-GUARD-01 |
| Multi-site | cross-site Quality isolation | T-ISOL-04 |
| Audit | every transition audited | T-AUDIT-05 |
| Regression | Phase 1+2+3 tests | all 84 pass |

---

## 17. Open questions (require owner decision before implementation)

> **These are the 9 critical domain decisions from §3. I will NOT implement Phase 4 until these are confirmed.**

- **D1 — NCR vs Deviation:** confirm NCR = unplanned nonconformity (reactive); Deviation = planned departure (proactive); separate entities? *(Recommendation: yes)*
- **D2 — Investigation vs CAPA:** confirm Investigation = separate entity (finds cause); CAPA = separate entity (acts); 1 Investigation : N CAPAs? *(Recommendation: yes; owner: Investigation ≠ CAPA)*
- **D3 — NCR state machine:** confirm DRAFT→CONTAINMENT→INVESTIGATION→DISPOSITION→CLOSED +CANCELLED? *(Recommendation: yes)*
- **D4 — Deviation state machine:** confirm DRAFT→ASSESSMENT→INVESTIGATION→REVIEW→CLOSED +REJECTED, with Investigation optional? *(Recommendation: yes)*
- **D5 — CAPA state machine:** confirm OPEN→ACTION_PLAN→IMPLEMENTATION→EFFECTIVENESS→CLOSED (Investigation removed, it's a separate entity D2)? *(Recommendation: yes)*
- **D6 — Change Control state machine:** confirm REQUEST→IMPACT→RISK→APPROVAL→IMPLEMENTATION→VERIFICATION→EFFECTIVENESS→CLOSED +REJECTED? *(Recommendation: yes)*
- **D7 — Risk model:** confirm RiskAssessment entity (hazard×severity×probability=RPN, mitigations, status)? *(Recommendation: yes; foundation; full FMEA later)*
- **D8 — Linkage to Production:** confirm polymorphic reference (entityType + entityId strings, service-validated) rather than hard FKs? *(Recommendation: yes; extensible)*
- **D9 — Document Control boundary:** confirm Phase 4 stores document references (strings) only; no Document Control subsystem (Phase 7)? *(Recommendation: yes)*

**Additional open questions (lower priority):**
- D10: Should an NCR's DISPOSITION automatically create a ProductionScrap/ProductionRework record, or just reference an existing one? *(Recommendation: reference existing; creation stays in Production)*
- D11: Should Deviation have a `validUntil` (one-time departure expires) or is it perpetual until closed? *(Recommendation: validUntil optional; perpetual if null)*
- D12: Should RiskAssessment severity/probability scales be 1-3 (low/med/high) or 1-5 (fine-grained)? *(Recommendation: 1-5, configurable)*

---

```
PHASE 4 PLAN STATUS: WAITING FOR OWNER APPROVAL (and §3 / §17 domain decisions D1-D9)
```

**I am stopping here.** I will not implement Phase 4, will not create Phase 4 tickets under `.scratch/phase-4/` beyond this plan, and will not modify the schema until the owner (a) approves this plan and (b) confirms D1–D9. Awaiting your decisions.
