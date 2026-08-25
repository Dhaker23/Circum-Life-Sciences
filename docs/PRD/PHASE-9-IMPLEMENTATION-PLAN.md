# CIRCUM — PHASE 9 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 9 — Cleanroom / Packaging / Sterilization / Batch Review / Release-Disposition
> **Predecessor:** Phases 1-8 (all approved/closed). ManufacturingBatch currently stops at `READY_FOR_REVIEW` (Phase 3 D7). 55 existing models.
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only).
> **Source of truth:** Circum Master PRD §5 (Cleanroom, Packaging, Sterilization), §6 (Batch Review / Release), §9 (AI governance — AI must never release product), §10 (Traceability: Packaging → Sterilization → Disposition → Shipment in genealogy), §18 (Phase 9), §19/§20 (Phase Gate/Report). GLM Master Prompt §9, §10.
> **Critical owner constraint:** "Do not invent entities, workflows, terminology, regulatory requirements, acceptance criteria, business rules, permissions, architecture, or functionality. If something is ambiguous, explicitly identify it as an OWNER DECISION REQUIRED item."

---

## 0. Context: Phase 9 scope and complexity

PRD §18 Phase 9: "Cleanroom / packaging / sterilization / batch review / release-disposition."

This is the **largest and most complex phase** in the roadmap, covering four distinct sub-domains:

1. **Cleanroom Monitoring** — configurable environmental monitoring (rooms, classifications, points, parameters, limits, results, excursions).
2. **Packaging** — packaging materials/lots, configuration, process, equipment, operators, parameters, inspection.
3. **Sterilization** — configurable sterilization processes (EtO, Gamma, Beta, X-ray), tracking device lots through sterilization cycles, release status.
4. **Batch Review / Release** — the culmination of the QMS: a QA review of a batch's complete record (production, materials, traceability, equipment, operators, inspection, laboratory, deviations, NCR, CAPA, packaging, sterilization, controlled documents), followed by a human-only disposition (Approved/Hold/Rework/Reject).

**Existing state:** ManufacturingBatch has status `READY_FOR_REVIEW` as its terminal state (Phase 3 D7). Phase 9 extends this to the full review/release workflow. No cleanroom, packaging, or sterilization entities exist.

---

## 1. Objectives

1. **Cleanroom** — environmental monitoring with configurable rooms, classification levels, monitoring points, parameters, units, alert/action limits (never hard-coded), monitoring results, and excursion tracking.
2. **Packaging** — packaging process records applied to Device Lots/Batches, with packaging materials, configuration, equipment, operators, parameters, and inspection.
3. **Sterilization** — sterilization cycle records for Device Lots, with configurable process types (EtO/Gamma/Beta/X-ray), cycle parameters, equipment, validation status, testing, deviations, and release status. **Software must never autonomously release sterile product.**
4. **Batch Review / Release** — the formal QA review of a Manufacturing Batch's complete record, with a controlled disposition workflow: `READY_FOR_REVIEW → QA_REVIEW → APPROVED (Released) / HOLD / REWORK / REJECT`. **Release/disposition requires authorized human action. AI must never release product.**
5. **Genealogy completion** — Phase 9 completes the traceability genealogy chain: `...Batch/Device Lot → Operations → Equipment → Operators → Inspection/Testing → Packaging → Sterilization → Disposition → Shipment`.
6. **Full RBAC + audit + multi-site + AI governance** — reuse Phase 1-8 infrastructure.

**Out of scope:** OEE/VSM (Phase 10), Analytics/Reporting (Phase 11), AI Assistant (Phase 12), Integrations/Deployment (Phase 13), Customer/Project (deferred), Shipment (not yet defined in PRD as a module — the genealogy mentions it but no PRD §5 module describes it; Phase 9 covers up to Disposition).

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 9 coverage |
|---|---|---|---|
| R1 | Cleanroom: configurable room, classification, point, parameter, unit, alert/action limits, results, excursions | §5 | Cleanroom entities |
| R2 | Never hard-code cleanroom limits | §5 | Limits are user-configurable data |
| R3 | Packaging: materials/lots, configuration, process, equipment, operators, parameters, inspection | §5 | Packaging entities |
| R4 | Sterilization: EtO/Gamma/Beta/X-ray; track device lot, sterilization lot, cycle, equipment, parameters, validation status, routine cycle, testing, deviations, release status | §5 | Sterilization entities |
| R5 | Software must never autonomously release sterile product | §5 | Human-only release guard |
| R6 | Batch Review: includes production, materials, traceability, equipment, operators, inspection, laboratory, deviations, NCR, CAPA, packaging, sterilization, controlled documents | §6 | BatchReview aggregates all prior data |
| R7 | Batch Review workflow: Ready for Review → QA Review → Approved / Hold / Rework / Reject | §6 | Extends ManufacturingBatch state machine |
| R8 | Release/disposition requires authorized human action | §6 | Human-only disposition |
| R9 | AI must never release product, approve batch disposition | §9 | AI governance |
| R10 | Genealogy: Packaging → Sterilization → Disposition in traceability | §10 | Entities linked for genealogy |
| R11 | Phase Gate (§19) + Phase Validation Report (§20) | §19, §20 | full gate |

---

## 3. Domain model (grill-with-docs + domain-modeling)

### 3.1 Phase 9 scope splitting (D1 — CRITICAL, OWNER DECISION REQUIRED)

**Question:** Phase 9 covers four sub-domains (Cleanroom, Packaging, Sterilization, Batch Review/Release). Should it be implemented as one phase, or split into sub-phases (9a/9b/9c/9d)?

**Analysis:**
- Batch Review/Release depends on Packaging and Sterilization being trackable (PRD §6: "Batch review may include... packaging, sterilization...").
- Cleanroom is independent of Packaging/Sterilization.
- Packaging and Sterilization are sequential (packaging → sterilization in the genealogy).
- All four are needed before Batch Review can be complete.

**Proposed resolution (D1):** **Implement as one phase (Phase 9) with internal slice ordering:**
1. Slice 1: Cleanroom (independent).
2. Slice 2: Packaging (depends on DeviceLot/Batch from Phase 3).
3. Slice 3: Sterilization (depends on Packaging + DeviceLot).
4. Slice 4: Batch Review/Release (depends on all prior + Cleanroom/Packaging/Sterilization).

This keeps the PRD phase structure intact while managing complexity through internal slicing.

**Alternative:** Split into Phase 9a (Cleanroom + Packaging) and Phase 9b (Sterilization + Batch Review). More manageable but deviates from PRD roadmap.

**Recommendation: one phase, internal slicing.** **Please confirm D1.**

### 3.2 Cleanroom model (D2)

**PRD evidence:** §5 "configurable room, classification, point, parameter, unit, alert/action limits, results and excursions. Never hard-code limits."

**Proposed resolution (D2):** Four entities:
- **Cleanroom** — a monitored room. Fields: `code` (unique per site), `name`, `siteId`, `classification` (e.g., "ISO 7", "ISO 8" — configurable string, not hard-coded), `status` (ACTIVE/INACTIVE), `isDemo`. Site-owned.
- **MonitoringPoint** — a measurement point in a Cleanroom. Fields: `cleanroomId`, `code`, `name`, `parameter` (e.g., "Particle Count", "Air Changes", "Temperature", "Humidity"), `unit` (e.g., "CFU/m³", "°C", "%RH"), `alertLimit` (Decimal — user-configurable, never hard-coded), `actionLimit` (Decimal — user-configurable), `status` (ACTIVE/INACTIVE), `isDemo`. Belongs to Cleanroom (site-scoped via Cleanroom).
- **MonitoringResult** — a reading at a MonitoringPoint. Fields: `code`, `monitoringPointId`, `siteId`, `value` (Decimal), `unit`, `resultStatus` (NORMAL / ALERT / ACTION_EXCEEDANCE), `measuredAt`, `measuredByUserId?`, `notes?`, `isDemo`. Site-owned. The `resultStatus` is auto-evaluated: if value > actionLimit → ACTION_EXCEEDANCE; if value > alertLimit → ALERT; else NORMAL.
- **Excursion** — a record when a result exceeds limits. Fields: `monitoringResultId`, `cleanroomId`, `siteId`, `excursionType` (ALERT / ACTION), `description`, `investigationRequired` (Boolean), `ncrId?` (link to NCR if an NCR is raised), `status` (OPEN / INVESTIGATING / CLOSED), `isDemo`. Site-owned.

**Key rule:** Limits are NEVER hard-coded. They are user-configurable on MonitoringPoint. The system auto-evaluates results against the configured limits but never invents them.

**Recommendation: 4 entities (Cleanroom, MonitoringPoint, MonitoringResult, Excursion).** **Please confirm D2.**

### 3.3 Packaging: new entities vs reuse existing Material/MaterialLot (D3)

**PRD evidence:** §5 "packaging materials/lots, configuration, process, equipment, operators, parameters and inspection."

**Question:** Are packaging materials a new entity, or do they reuse the existing Material/MaterialLot (which has a `materialType` field that could include PACKAGING)?

**Proposed resolution (D3):** **Reuse existing Material/MaterialLot** (the `materialType` field already supports "PACKAGING" from Phase 2). Packaging materials are Materials with `materialType = PACKAGING`. No new entity for packaging materials/lots.

However, the **packaging process** (applying packaging to a DeviceLot/Batch) is a new entity:
- **PackagingRecord** — a record of packaging applied to a DeviceLot or Batch. Fields: `code`, `siteId`, `targetEntityType` (DEVICE_LOT / BATCH), `targetEntityId`, `packagingConfiguration?` (text — description of the packaging config), `equipmentId?` (Phase 8 Equipment FK), `operatorEmployeeId?` (Phase 3 D4 pattern: Employee), `loggedByUserId?`, `parameters?` (Json), `inspectionResult?` (PASS/FAIL/CONDITIONAL), `status` (IN_PROGRESS / COMPLETED / FAILED), `consumedMaterialLotIds?` (Json array — links to MaterialLots consumed during packaging), `notes?`, `isDemo`. Site-owned.

**Recommendation: reuse Material/MaterialLot for packaging materials; new PackagingRecord for the packaging process.** **Please confirm D3.**

### 3.4 Sterilization model (D4)

**PRD evidence:** §5 "configurable support for applicable processes such as EtO, Gamma, Beta/e-beam or X-ray. Track device lot, sterilization lot, cycle, equipment, parameters, validation status, routine cycle, testing, deviations and release status."

**Proposed resolution (D4):** Two entities:
- **SterilizationLot** — a sterilization batch/cycle. Fields: `code`, `siteId`, `processType` (ETO / GAMMA / BETA / X_RAY — configurable), `sterilizationLotCode` (the external lot code from the sterilization provider), `equipmentId?` (Phase 8 Equipment), `cycleNumber?`, `parameters?` (Json — cycle parameters like temperature, duration, dose), `validationStatus?` (VALIDATED / PENDING / NOT_VALIDATED), `status` (SCHEDULED / IN_PROGRESS / COMPLETED / RELEASED / REJECTED), `releaseByUserId?`, `releaseAt?`, `releaseNotes?`, `evidenceDocumentId?`, `isDemo`. Site-owned. **Status RELEASED requires human action; AI must never release.**
- **SterilizationLotDeviceLot** — join table: which DeviceLots went through which SterilizationLot. Fields: `sterilizationLotId`, `deviceLotId`, `siteId`. Many-to-Many.

**Key rule:** "Software must never autonomously release sterile product." The `RELEASED` status transition is human-only.

**Recommendation: 2 entities (SterilizationLot + SterilizationLotDeviceLot join).** **Please confirm D4.**

### 3.5 Batch Review / Release: new entity vs extend ManufacturingBatch (D5 — CRITICAL)

**PRD evidence:** §6 "Workflow: Ready for Review → QA Review → Approved / Hold / Rework / Reject."

**Question:** Is BatchReview a new entity, or does it extend the existing ManufacturingBatch state machine (which currently stops at READY_FOR_REVIEW)?

**Proposed resolution (D5):** **Extend ManufacturingBatch state machine + new BatchReviewRecord entity.**
- ManufacturingBatch state machine extended: `READY_FOR_REVIEW → QA_REVIEW → APPROVED (RELEASED) / HOLD / REWORK / REJECT` (per PRD §6).
- A **BatchReviewRecord** captures the review itself: `batchId`, `reviewedByUserId`, `reviewedAt`, `reviewFindings?`, `disposition` (APPROVED / HOLD / REWORK / REJECT), `dispositionedByUserId`, `dispositionedAt`, `dispositionNotes?`, `evidenceDocumentId?`, `isDemo`. Site-owned (via batch).
- The disposition is **human-only** (AI must never release product; PRD §9).
- A BatchReviewRecord aggregates references to all relevant data (production records, material consumption, traceability, equipment, operators, inspection results, lab results, deviations, NCRs, CAPAs, packaging records, sterilization records, controlled documents) — these are queried from existing entities, not duplicated.

**Recommendation: extend ManufacturingBatch state + new BatchReviewRecord.** **Please confirm D5.**

### 3.6 Cleanroom qualification (D6)

**Question:** Phase 8 D3 deferred cleanroom qualification. Does Phase 9 include it?

**Proposed resolution (D6):** **Phase 9 covers Cleanroom Monitoring only (environmental monitoring), not Cleanroom Qualification.** Cleanroom Qualification (IQ/OQ/PQ for a cleanroom) is a validation activity that depends on the Qualification entity (Phase 8). It can be added in a future phase by extending Qualification to support `qualificationSubjectType = CLEANROOM`. Phase 9 focuses on the monitoring (results, excursions) which is the operational use of cleanrooms.

**Recommendation: monitoring only; qualification deferred.** **Please confirm D6.**

### 3.7 Site ownership (D7)

**Proposed resolution (D7):** All Phase 9 entities (Cleanroom, MonitoringPoint, MonitoringResult, Excursion, PackagingRecord, SterilizationLot, SterilizationLotDeviceLot, BatchReviewRecord) are **site-owned**. Cross-site leakage = CRITICAL defect.

**Recommendation: all site-owned.** **Please confirm D7.**

### 3.8 AI governance for release (D8)

**Proposed resolution (D8):** AI must never:
- Release sterile product (SterilizationLot → RELEASED).
- Approve batch disposition (ManufacturingBatch → APPROVED/RELEASED).
- Close a cleanroom excursion.
- Override any disposition decision.

AI may:
- Summarize batch review data.
- Highlight potential issues (open NCRs, failed tests, excursions).
- Suggest review focus areas.

**Recommendation: AI read-only + suggest; no release/disposition.** **Please confirm D8.**

### 3.9 Summary of proposed domain decisions

| # | Decision | Proposed | Recommendation |
|---|---|---|---|
| D1 | Phase 9 scope splitting | One phase, internal slicing (Cleanroom → Packaging → Sterilization → Batch Review) | **Confirm** |
| D2 | Cleanroom model | 4 entities: Cleanroom, MonitoringPoint, MonitoringResult, Excursion. Limits never hard-coded. | **Confirm** |
| D3 | Packaging materials | Reuse existing Material/MaterialLot (materialType=PACKAGING). New PackagingRecord for the process. | **Confirm** |
| D4 | Sterilization model | 2 entities: SterilizationLot + SterilizationLotDeviceLot join. Human-only release. | **Confirm** |
| D5 | Batch Review/Release | Extend ManufacturingBatch state machine + new BatchReviewRecord. Human-only disposition. | **Confirm** |
| D6 | Cleanroom qualification | Monitoring only; qualification deferred (can extend Phase 8 Qualification in future). | **Confirm** |
| D7 | Site ownership | All Phase 9 entities site-owned. | **Confirm** |
| D8 | AI governance for release | AI must never release sterile product, approve batch disposition, or close excursions. | **Confirm** |

---

## 4. Database schema (proposed, pending §3 confirmation)

```prisma
// Cleanroom (D2)
model Cleanroom {
  id             String   @id @default(cuid())
  code           String   // unique per site
  name           String
  siteId         String
  classification String?  // e.g., "ISO 7" — configurable, never hard-coded
  status         String   @default("ACTIVE")
  isDemo         Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  monitoringPoints MonitoringPoint[]
  excursions       Excursion[]
  site             Site    @relation(fields: [siteId], references: [id], onDelete: Restrict)
  @@unique([siteId, code])
  @@index([siteId])
}

model MonitoringPoint {
  id             String   @id @default(cuid())
  cleanroomId    String
  code           String
  name           String
  parameter      String   // e.g., "Particle Count"
  unit           String   // e.g., "CFU/m³"
  alertLimit     Decimal  // user-configurable, NEVER hard-coded
  actionLimit    Decimal  // user-configurable, NEVER hard-coded
  status         String   @default("ACTIVE")
  isDemo         Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  cleanroom      Cleanroom @relation(fields: [cleanroomId], references: [id], onDelete: Cascade)
  results        MonitoringResult[]
  @@unique([cleanroomId, code])
  @@index([cleanroomId])
}

model MonitoringResult {
  id               String   @id @default(cuid())
  code             String
  monitoringPointId String
  siteId           String
  value            Decimal
  unit             String
  resultStatus     String   @default("NORMAL") // NORMAL | ALERT | ACTION_EXCEEDANCE (auto-evaluated)
  measuredAt       DateTime @default(now())
  measuredByUserId String?
  notes            String?
  isDemo           Boolean  @default(false)
  createdAt        DateTime @default(now())
  monitoringPoint  MonitoringPoint @relation(fields: [monitoringPointId], references: [id], onDelete: Restrict)
  site             Site            @relation(fields: [siteId], references: [id], onDelete: Restrict)
  excursion        Excursion?
  @@unique([siteId, code])
  @@index([monitoringPointId])
  @@index([resultStatus])
}

model Excursion {
  id                  String   @id @default(cuid())
  monitoringResultId  String   @unique
  cleanroomId         String
  siteId              String
  excursionType       String   // ALERT | ACTION
  description         String?
  investigationRequired Boolean @default(false)
  ncrId               String?
  status              String   @default("OPEN") // OPEN | INVESTIGATING | CLOSED
  isDemo              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  monitoringResult    MonitoringResult @relation(fields: [monitoringResultId], references: [id], onDelete: Cascade)
  cleanroom           Cleanroom        @relation(fields: [cleanroomId], references: [id], onDelete: Restrict)
  site                Site             @relation(fields: [siteId], references: [id], onDelete: Restrict)
  ncr                 NCR?             @relation("ExcursionNcr", fields: [ncrId], references: [id], onDelete: SetNull)
  @@index([cleanroomId])
  @@index([status])
}

// Packaging (D3)
model PackagingRecord {
  id                  String   @id @default(cuid())
  code                String
  siteId              String
  targetEntityType    String   // DEVICE_LOT | BATCH
  targetEntityId      String
  packagingConfiguration String?
  equipmentId         String?
  operatorEmployeeId  String?
  loggedByUserId      String?
  parameters          Json?
  inspectionResult    String?  // PASS | FAIL | CONDITIONAL
  status              String   @default("IN_PROGRESS") // IN_PROGRESS | COMPLETED | FAILED
  notes               String?
  isDemo              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  site                Site      @relation(fields: [siteId], references: [id], onDelete: Restrict)
  equipment           Equipment? @relation(fields: [equipmentId], references: [id], onDelete: SetNull)
  operator            Employee?  @relation("PackagingOperator", fields: [operatorEmployeeId], references: [id], onDelete: SetNull)
  logger              User?      @relation("PackagingLogger", fields: [loggedByUserId], references: [id], onDelete: SetNull)
  @@unique([siteId, code])
  @@index([targetEntityType, targetEntityId])
  @@index([status])
}

// Sterilization (D4)
model SterilizationLot {
  id                String   @id @default(cuid())
  code              String
  siteId            String
  processType       String   // ETO | GAMMA | BETA | X_RAY
  sterilizationLotCode String? // external lot code from sterilization provider
  equipmentId       String?
  cycleNumber       String?
  parameters        Json?
  validationStatus  String   @default("NOT_VALIDATED") // VALIDATED | PENDING | NOT_VALIDATED
  status            String   @default("SCHEDULED") // SCHEDULED | IN_PROGRESS | COMPLETED | RELEASED | REJECTED
  releaseByUserId   String?
  releaseAt         DateTime?
  releaseNotes      String?
  evidenceDocumentId String?
  isDemo            Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  site              Site      @relation(fields: [siteId], references: [id], onDelete: Restrict)
  equipment         Equipment? @relation(fields: [equipmentId], references: [id], onDelete: SetNull)
  releaseBy         User?      @relation("SterilizationReleaseBy", fields: [releaseByUserId], references: [id], onDelete: SetNull)
  evidenceDocument  ControlledDocument? @relation(fields: [evidenceDocumentId], references: [id], onDelete: SetNull)
  deviceLots        SterilizationLotDeviceLot[]
  @@unique([siteId, code])
  @@index([siteId])
  @@index([status])
}

model SterilizationLotDeviceLot {
  sterilizationLotId String
  deviceLotId        String
  siteId             String
  createdAt          DateTime @default(now())
  sterilizationLot   SterilizationLot @relation(fields: [sterilizationLotId], references: [id], onDelete: Cascade)
  deviceLot          DeviceLot        @relation(fields: [deviceLotId], references: [id], onDelete: Cascade)
  site               Site             @relation(fields: [siteId], references: [id], onDelete: Restrict)
  @@id([sterilizationLotId, deviceLotId])
  @@index([deviceLotId])
}

// Batch Review / Release (D5)
model BatchReviewRecord {
  id                  String   @id @default(cuid())
  batchId             String   @unique // 1:1 with ManufacturingBatch
  siteId              String
  reviewedByUserId    String?
  reviewedAt          DateTime?
  reviewFindings      String?
  disposition         String?  // APPROVED | HOLD | REWORK | REJECT
  dispositionedByUserId String?
  dispositionedAt     DateTime?
  dispositionNotes    String?
  evidenceDocumentId  String?
  isDemo              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  batch               ManufacturingBatch @relation(fields: [batchId], references: [id], onDelete: Restrict)
  site                Site              @relation(fields: [siteId], references: [id], onDelete: Restrict)
  reviewer            User?             @relation("BatchReviewReviewer", fields: [reviewedByUserId], references: [id], onDelete: SetNull)
  dispositionedBy     User?             @relation("BatchReviewDispositioner", fields: [dispositionedByUserId], references: [id], onDelete: SetNull)
  evidenceDocument    ControlledDocument? @relation(fields: [evidenceDocumentId], references: [id], onDelete: SetNull)
  @@index([siteId])
  @@index([disposition])
}
```

**ManufacturingBatch state machine extended (D5):**
Current: `PLANNED → IN_PRODUCTION → COMPLETED → READY_FOR_REVIEW` (+ON_HOLD)
Phase 9 adds: `READY_FOR_REVIEW → QA_REVIEW → APPROVED (RELEASED) / HOLD / REWORK / REJECT`

**Relation additions:** NCR gets `excursions Excursion[] @relation("ExcursionNcr")`. Equipment gets `packagingRecords[]`, `sterilizationLots[]`. Employee gets `packagingRecords[]`. User gets named relation arrays. Site gets `cleanrooms[]`, `monitoringResults[]`, `excursions[]`, `packagingRecords[]`, `sterilizationLots[]`, `batchReviewRecords[]`. DeviceLot gets `sterilizationLots[]`. ControlledDocument gets `sterilizationLots[]`, `batchReviewRecords[]`. ManufacturingBatch gets `batchReviewRecord BatchReviewRecord?`.

---

## 5. API design

New permission modules: `cleanroom.*`, `packaging.*`, `sterilization.*`, `batchreview.*`.

```
# Cleanroom
GET/POST /api/cleanroom/rooms
POST    /api/cleanroom/rooms/:id/points
POST    /api/cleanroom/results             (auto-evaluates against limits)
POST    /api/cleanroom/excursions/:id/transition  (OPEN->INVESTIGATING->CLOSED)

# Packaging
GET/POST /api/packaging/records
POST    /api/packaging/records/:id/transition  (IN_PROGRESS->COMPLETED/FAILED)

# Sterilization
GET/POST /api/sterilization/lots
POST    /api/sterilization/lots/:id/device-lots  (link DeviceLots)
POST    /api/sterilization/lots/:id/transition   (SCHEDULED->IN_PROGRESS->COMPLETED)
POST    /api/sterilization/lots/:id/release      (human-only; AI MUST NEVER)

# Batch Review
GET     /api/batch-review/batches/:id           (aggregate review data)
POST    /api/batch-review/batches/:id/transition (READY_FOR_REVIEW->QA_REVIEW)
POST    /api/batch-review/batches/:id/disposition (human-only; AI MUST NEVER; APPROVED/HOLD/REWORK/REJECT)
```

---

## 6. UI architecture

Pages under `[locale]/(app)/`:
- `cleanroom/rooms/` — cleanroom list + monitoring points + results.
- `packaging/records/` — packaging records list.
- `sterilization/lots/` — sterilization lots list + device lot links.
- `batch-review/` — batches ready for review + review form + disposition.

---

## 7. Testing

- **T-CR-01:** Cleanroom + MonitoringPoint CRUD.
- **T-CR-02:** MonitoringResult auto-evaluates resultStatus (NORMAL/ALERT/ACTION_EXCEEDANCE) against configured limits.
- **T-CR-03:** Excursion created when result exceeds limits.
- **T-PKG-01:** PackagingRecord state machine (IN_PROGRESS→COMPLETED/FAILED).
- **T-STER-01:** SterilizationLot state machine (SCHEDULED→IN_PROGRESS→COMPLETED→RELEASED/REJECTED).
- **T-STER-02:** Sterilization release is human-only (AI must never release).
- **T-BR-01:** Batch Review state machine (READY_FOR_REVIEW→QA_REVIEW→APPROVED/HOLD/REWORK/REJECT).
- **T-BR-02:** Batch disposition is human-only (AI must never release product).
- **T-ISOL-09:** Cross-site isolation for all Phase 9 entities.
- **T-AI-GUARD-06:** AI governance (no release/disposition for AI).
- **Regression:** all 248 Phase 1-8 tests pass.

---

## 8. Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| P9-R1 | Phase 9 is very large (4 sub-domains) | H | Medium | Internal slicing; each slice independently testable |
| P9-R2 | Batch Review aggregation is complex (queries many entities) | M | Medium | Service layer aggregates; no data duplication |
| P9-R3 | Cleanroom limits accidentally hard-coded | L | High | Limits are Decimal fields on MonitoringPoint; zod validates they're provided |
| P9-R4 | Sterilization release bypassed by AI | M | Critical | Human-only guard; tested T-STER-02 |
| P9-R5 | Batch disposition bypassed by AI | M | Critical | Human-only guard; tested T-BR-02 |
| P9-R6 | Cross-site leakage in batch review (batch at Site A, review by Site B user) | M | Critical | SiteScope on batch review; tested T-ISOL-09 |

---

## 9. Open questions (require owner decision)

- **D1 — Scope splitting:** confirm one phase with internal slicing? *(Recommendation: yes)*
- **D2 — Cleanroom model:** confirm 4 entities (Cleanroom, MonitoringPoint, MonitoringResult, Excursion) with configurable limits? *(Recommendation: yes)*
- **D3 — Packaging materials:** confirm reuse existing Material/MaterialLot; new PackagingRecord for the process? *(Recommendation: yes)*
- **D4 — Sterilization model:** confirm 2 entities (SterilizationLot + SterilizationLotDeviceLot join) with human-only release? *(Recommendation: yes)*
- **D5 — Batch Review/Release:** confirm extend ManufacturingBatch state machine + new BatchReviewRecord with human-only disposition? *(Recommendation: yes)*
- **D6 — Cleanroom qualification:** confirm monitoring only; qualification deferred? *(Recommendation: yes)*
- **D7 — Site ownership:** confirm all Phase 9 entities site-owned? *(Recommendation: yes)*
- **D8 — AI governance for release:** confirm AI must never release sterile product, approve batch disposition, or close excursions? *(Recommendation: yes)*

---

```
PHASE 9 PLAN STATUS: WAITING FOR OWNER APPROVAL (and D1-D8 confirmation)
```

**I am stopping here.** Awaiting your approval and confirmation of D1–D8.
