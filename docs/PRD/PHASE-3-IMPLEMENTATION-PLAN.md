# CIRCUM — PHASE 3 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 3 — Production Planning / Work Orders / Routing / Operations / Shifts / Execution
> **Predecessor:** Phase 2 (approved/closed). Builds on Product/Revision/BOM/Material/MaterialLot/Supplier.
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only). Implementation gated on owner approval of this plan AND the domain decisions in §3.
> **Source of truth:** Circum Master PRD §5 (Manufacturing: routing, work orders, batches/device lots, production execution, shifts/handover), §10 (Traceability genealogy), §6 (Batch Review/Release — referenced but not built in Phase 3), §11 (Architecture), §16 (Docs), §17 (Validation-minded), §19/§20 (Phase Gate/Report).
> **Scope rule (owner):** Phase 3 = manufacturing execution. No quality records (NCR/Deviation/CAPA — Phase 6), no equipment maintenance/calibration (Phase 8), no batch review/release (Phase 9), no OEE/VSM (Phase 10), no AI (Phase 12).
> **Critical owner constraint:** Do NOT assume Batch = Device Lot. Do NOT create a Device entity. Do NOT invent manufacturing terminology. If an important ambiguity exists, STOP and present it.

---

## 0. Reading guide

§1 Objectives. §2 PRD traceability. **§3 Domain model (the core) + 8 critical ambiguities (D1-D8) requiring owner confirmation.** §4 Proposed schema (pending §3). §5 API design. §6 UI architecture. §7 Security/Audit. §8 Multi-site. §9 Testing. §10 Migration. §11 Skills. §12 Files. §13 Risks. §14 Dependencies. §15 Acceptance. §16 Test plan. §17 Open questions.

```
PHASE 3 PLAN STATUS: WAITING FOR OWNER APPROVAL (and §3 domain decisions D1-D8)
```

---

## 1. Objectives

Phase 3 establishes the **manufacturing execution domain**: the controlled instructions to produce (Work Order, Routing, Operation), the execution of those instructions (production records, material consumption, operator/equipment involvement), and the **produced traceable units** (Manufacturing Batch, Device Lot). This is the middle of the traceability genealogy (PRD §10):

```
[Phase 2: Product → Revision → BOM → Material Lot] → [Phase 3: Work Order → Batch/Device Lot → Operations → Equipment → Operators → Consumption] → [Phase 4+: Inspection → Packaging → Sterilization → Disposition → Shipment]
```

Phase 3 covers the bolded middle. The schema must be designed so Phase 4 (full genealogy queries), Phase 5 (inspection against produced lots), Phase 6 (NCR against production), Phase 9 (batch review/release), and Phase 10 (OEE from production data) extend it without rework.

**Concrete objectives:**

1. **Routing + Operation** — the controlled sequence of steps to build a Product Revision, including Work Center references (where the operation runs).
2. **Work Order** — an authorized instruction to produce a quantity of a Product Revision by a date, following a Routing, at a Site.
3. **Production execution** — record the actual execution of a Work Order: which Operations ran, when, on which Equipment/Work Center, by which Operators, consuming which Material Lots, producing what output.
4. **Manufacturing Batch + Device Lot** — the produced traceable units, with the cardinality and lifecycle the owner confirms (D1-D2).
5. **Material consumption** — consuming Material Lots against a Work Order/Batch, decrementing `quantityAvailable`, recording genealogy (which lot went into which batch).
6. **Scrap + Rework** — recording non-conforming output (scrap) and rework (re-process), with quantity tracking.
7. **Production status + holds** — a controlled state machine for Work Order and Batch lifecycle, including HOLD (a quality hold that pauses production).
8. **Traceability foundation** — every consumption, every operation execution, every operator/equipment involvement is recorded for forward/backward genealogy (Phase 4 queries).
9. **Full RBAC + audit + multi-site** — reuse Phase 1/2 infrastructure; new `production.*` permissions; Work Orders and Batches are site-scoped; every transition audited.
10. **Future integration hooks** — design so Quality (Phase 5/6), Batch Review (Phase 9), and OEE (Phase 10) can read production data without rework.

**Out of scope (explicit, per owner):** Quality records (NCR/Deviation/CAPA — Phase 6), Equipment maintenance/calibration (Phase 8 — Phase 3 uses a minimal Equipment/WorkCenter identity only, see D3), Batch Review/Release/Disposition (Phase 9 — Phase 3 produces the batch but does not release it), OEE/VSM analytics (Phase 10), AI (Phase 12). Customer/Project linkage (D8, deferred).

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 3 coverage |
|---|---|---|---|
| R1 | Process routing / manufacturing instructions | §5 | Routing + Operation entities |
| R2 | Production planning / work orders | §5 | WorkOrder entity + state machine |
| R3 | Manufacturing batches / device lots | §5 | ManufacturingBatch + DeviceLot (cardinality per D1-D2) |
| R4 | Production execution | §5 | ProductionRecord + OperationExecution + Consumption |
| R5 | Shifts / handover | §5 | Shift entity + production record links to shift (basic) |
| R6 | Traceability genealogy: Work Order → Batch/Device Lot → Operations → Equipment → Operators → [Inspection...] | §10 | all bolded relationships wired (queries in Phase 4) |
| R7 | Material Lot → Work Order → Batch genealogy | §10 | Consumption records link MaterialLot → WorkOrder/Batch |
| R8 | Controlled records: unique ID, status, owner, evidence, audit trail | §5 | all Phase 3 entities carry these |
| R9 | DB constraints prevent duplicates, broken refs, impossible quantities | §10, §11 | FKs, uniques, quantity>0, state-machine guards |
| R10 | Normal users cannot edit/delete audit history | §10, §13 | reuse Phase 1 audit (append-only) |
| R11 | Layered architecture; critical logic not only in UI | §11 | modules/production/{api,service,domain,infrastructure} |
| R12 | Local-first | §12 | all local DB |
| R13 | FR/EN/AR + RTL | §4 | next-intl catalogs extended |
| R14 | Professional industrial UI | §14 | work-order/routing/production/batch pages |
| R15 | Phase Gate (§19) + Phase Validation Report (§20) | §19, §20 | full gate |
| R16 | PostgreSQL-portable (ADR-0002) | §11, ADR-0002 | no SQLite-only types |
| R17 | Batch Review/Release workflow exists but is NOT implemented in Phase 3 | §6 | Batch reaches "READY_FOR_REVIEW" at most; no QA Review/Release (Phase 9) |

---

## 3. Domain model (grill-with-docs + domain-modeling)

> This is the heart of Phase 3. Terms are extracted from the PRD (§5, §10) and sharpened via the `domain-modeling` discipline. **Where the PRD is silent on a precise boundary, the resolution is marked PROPOSED and requires owner confirmation (§3.9).** Nothing is invented; every proposal traces to a PRD concept. The owner's explicit constraints are honored: Batch ≠ Device Lot (assumption), no Device entity, no invented terminology.

### 3.1 Manufacturing Batch vs Device Lot (D1 — CRITICAL, owner-flagged)

**PRD evidence:** §5 "manufacturing batches/device lots"; §10 "Work Order → Batch/Device Lot → ..."; §6 "Batch Review" (singular batch). CONTEXT.md: "Manufacturing Batch = a produced quantity of a Product Revision under one Work Order"; "Device Lot = a traceable unit of finished devices, typically a subset/split of a Manufacturing Batch."

**Owner constraint:** "Do NOT assume that Batch = Device Lot."

**Ambiguity:** What is the precise relationship? Options:
- (a) **1:1** — Manufacturing Batch and Device Lot are the same thing (one traceable production run). The PRD's "Batch/Device Lot" slash notation suggests this in some places.
- (b) **1:N** — one Manufacturing Batch (the production run) is split into multiple Device Lots (traceable sub-units, e.g., for sterilization lot tracking). CONTEXT.md says "typically a subset/split."
- (c) **N:M** — complex (a Device Lot can span multiple Batches). Unlikely; breaks traceability.

**Proposed resolution (D1):** **1:N** — a Manufacturing Batch is the production run (the top-level traceable unit produced by a Work Order). A Device Lot is a traceable sub-unit of a Batch, created by **splitting** a Batch (e.g., for sterilization lot segmentation, or when a batch is physically divided). A Batch has ≥1 Device Lot; a Device Lot belongs to exactly 1 Batch. Rationale:
- The PRD §11 (Sterilization) tracks "device lot, sterilization lot" separately — implying Device Lots are the unit that goes to sterilization, which may be smaller than the production batch.
- 1:1 would make "Device Lot" redundant with "Batch" (the owner said don't assume they're the same).
- 1:N allows a Batch to be produced, then split into Device Lots for downstream processing (sterilization, packaging, shipment).
- A Batch with exactly 1 Device Lot is the simple case (1:1 effectively), but the model allows splitting.

**If the owner disagrees:** alternative is 1:1 (Batch = Device Lot, one entity). Simpler, but loses the ability to split a production run into separate sterilization lots without creating multiple "batches." **Please confirm D1.**

### 3.2 Work Order → Batch cardinality (D2)

**PRD evidence:** §10 "Work Order → Batch/Device Lot"; CONTEXT.md "produces Manufacturing Batches / Device Lots" (plural).

**Proposed resolution (D2):** **1:N** — one Work Order can produce multiple Manufacturing Batches (e.g., a work order for 1000 units might be produced in 3 batches of 300/300/400 across shifts). Each Batch belongs to exactly 1 Work Order. A Work Order has ≥0 Batches (0 while planned, ≥1 once production starts). Rationale:
- Production planning often splits a work order into batches for shift/equipment capacity reasons.
- 1:1 would force a new work order for every batch, which is operationally heavy.

**If the owner prefers 1:1:** simpler, but less flexible. **Please confirm D2.**

### 3.3 Equipment / Work Center in Phase 3 vs Phase 8 (D3 — CRITICAL)

**PRD evidence:** §5 "Operation... executed on Equipment by Operators"; §5 Equipment module (maintenance/calibration) is listed but PRD §18 roadmap puts it in Phase 8. §10 genealogy includes "Equipment."

**Ambiguity:** Phase 3 Operations need to reference Equipment, but the full Equipment master (with maintenance, calibration, status VALID/EXPIRING/EXPIRED/OUT_OF_SERVICE) is Phase 8. Do I:
- (a) Create a minimal `Equipment` entity now (identity + code + name + siteId + status), extended in Phase 8 with maintenance/calibration?
- (b) Defer equipment entirely — Operations record a free-text equipment reference?
- (c) Create a `WorkCenter` entity now (a location/grouping where operations run), and link Equipment to WorkCenters in Phase 8?

**Proposed resolution (D3):** **(c) WorkCenter now, Equipment in Phase 8.** A **WorkCenter** is a Phase 3 entity: a named location/station at a Site where an Operation runs (e.g., "Assembly Station 1", "Molding Line A"). It is site-owned. Operations reference a WorkCenter (optional — some operations may not need one). When Phase 8 introduces Equipment, Equipment can be linked to WorkCenters (a WorkCenter may have one or more Equipment items). Rationale:
- Avoids creating a half-baked Equipment entity that Phase 8 would need to restructure.
- WorkCenter is a real manufacturing concept (the place where work happens) that Phase 3 needs for production scheduling and OEE (Phase 10).
- Free-text equipment refs (option b) break traceability (PRD §10 needs Equipment in the genealogy).
- WorkCenter gives Phase 3 a stable, auditable reference without pre-empting Phase 8's Equipment design.

**If the owner prefers a minimal Equipment entity now:** possible, but risks rework when Phase 8 adds maintenance/calibration. **Please confirm D3.**

### 3.4 Operator identity: User vs Employee (D4)

**PRD evidence:** §5 "Operators"; §10 genealogy includes "Operators"; §3 RBAC includes "Operator" role. Phase 1 established User ≠ Employee (owner decision #4: "Employee = organizational/personnel identity; User = application login; not every Employee has a login").

**Ambiguity:** When a production record says "Operator X performed Operation Y," does it reference a User or an Employee?

**Proposed resolution (D4):** **Employee.** An OperationExecution records `employeeId` (the person who performed the work), not `userId`. Rationale:
- Not every operator has a User account (Phase 1 decision: "not every Employee requires a login").
- The person who physically performed the operation is an Employee (personnel identity), regardless of whether they logged in.
- If the system needs to know *who logged the record* (authentication), that's the `userId` from the AuthContext (the actor who created/updated the OperationExecution), captured in the AuditEvent — separate from the `employeeId` (who actually did the work).
- This supports kiosk/shared-terminal scenarios where a supervisor logs in but records that an operator performed the work.

**If the owner prefers User:** would exclude non-login operators. **Please confirm D4.**

### 3.5 Material reservation vs consumption (D5)

**PRD evidence:** §5 "BOM/materials"; §10 "Material Lot → Work Order → Batch" (the genealogy flows Material Lot into the Work Order/Batch). PRD does not explicitly mention "reservation."

**Ambiguity:** Is there a separate "reservation" step (allocating material to a work order before production) or is it just "consumption" (using material during production)?

**Proposed resolution (D5):** **Both, but consumption is the traceability-critical one.**
- **Consumption** (Phase 3 core): a `MaterialConsumption` record links a MaterialLot to a WorkOrder/Batch, with a quantity consumed. This decrements `MaterialLot.quantityAvailable` and records genealogy. This is the traceability link the PRD §10 requires.
- **Reservation** (Phase 3 basic): a `MaterialReservation` record allocates material to a Work Order (pre-production), decrementing a `quantityReserved` field on MaterialLot (new field). Reserved material is not yet consumed (still physically in inventory). When consumed, the reservation is fulfilled. This supports production planning but is secondary.
- If the owner wants to keep Phase 3 simpler: defer reservation to a later phase and do consumption only. **Please confirm D5 (both, or consumption-only).**

### 3.6 Routing ownership: global vs site-specific (D6)

**PRD evidence:** §5 "process routing"; Phase 2 made BOM global (D4, owner-confirmed). CONTEXT.md "A Revision carries its own BOM and routing."

**Ambiguity:** Is a Routing 1:1 with ProductRevision (global, like BOM), or can it vary by Site (the same product revision made at different sites might follow different process flows)?

**Proposed resolution (D6):** **1:1 with ProductRevision (global), like BOM.** A Routing is part of the controlled Revision, frozen when the Revision becomes EFFECTIVE (same as BOM, ADR-0006). Rationale:
- Consistency with BOM (D2, Phase 2): the Revision is the controlled design + process spec.
- If a site needs a different process flow, that's a different Revision (via Change Control).
- Site-specific differences (which WorkCenter, which Equipment) are captured at **execution time** (OperationExecution references the actual WorkCenter), not in the routing template.
- This keeps the routing as a controlled, auditable template; execution records the site-specific reality.

**If the owner needs site-specific routings:** alternative is Routing with `siteId` (a Revision has one global BOM but multiple site-specific Routings). More flexible but more complex. **Please confirm D6.**

### 3.7 Production status state machines (D7)

**PRD evidence:** §5 "production execution"; §6 "Ready for Review" (batch review); PRD does not give an explicit Work Order state machine.

**Proposed resolution (D7):**

**Work Order state machine:**
```
PLANNED → RELEASED → IN_PRODUCTION → COMPLETED → CLOSED
                ↓           ↓
            CANCELLED     ON_HOLD (→ back to IN_PRODUCTION)
```
- `PLANNED`: created, not yet authorized for production.
- `RELEASED`: authorized; production can start.
- `IN_PRODUCTION`: at least one Batch has started.
- `COMPLETED`: all planned Batches produced.
- `CLOSED`: financially/administratively closed (no more changes).
- `CANCELLED`: cancelled before/after release (terminal).
- `ON_HOLD`: a quality/operational hold pauses production (reversible).

**Manufacturing Batch state machine:**
```
PLANNED → IN_PRODUCTION → COMPLETED → READY_FOR_REVIEW
                ↓
            ON_HOLD (→ back to IN_PRODUCTION)
```
- `READY_FOR_REVIEW` is the terminal Phase 3 state. Phase 9 (Batch Review/Release) picks up from here: `READY_FOR_REVIEW → QA_REVIEW → APPROVED/HOLD/REWORK/REJECT`.
- Phase 3 does NOT implement QA_REVIEW or disposition (Phase 9).

**Device Lot state machine (simple):**
```
CREATED → IN_PROCESS → COMPLETED
```
(Device Lots are split from a Batch; they track their own status but Phase 3 doesn't release them.)

**Please confirm D7 (these state machines).**

### 3.8 Scrap and rework (D8)

**PRD evidence:** §5 does not explicitly mention scrap/rework, but §7 (Lean) mentions "scrap, rework" as OEE metrics. §6 Batch Review includes "Rework" as a disposition.

**Proposed resolution (D8):**
- **Scrap**: a `ProductionScrap` record links to a Batch/DeviceLot, recording a scrapped quantity + reason. Does not create a new entity; decrements the good-output quantity. Scrap is auditable. (Links to NCR in Phase 6.)
- **Rework**: a `ProductionRework` record links to a Batch/DeviceLot, recording that a quantity is being re-processed. Rework does NOT decrement good output (the units may become good after re-processing). Rework is auditable. (Full rework workflow with Deviation is Phase 6.)
- Phase 3 records scrap/rework events with quantities + reasons; full quality investigation (RCA/CAPA) is Phase 6.

**Please confirm D8.**

### 3.9 Summary of proposed domain decisions (all require owner confirmation)

| # | Decision | Proposed | Alternative | Recommendation |
|---|---|---|---|---|
| D1 | Batch vs Device Lot cardinality | **1:N** (Batch split into Device Lots) | 1:1 (same thing) | **Proposed** (supports sterilization lot splitting) |
| D2 | Work Order → Batch cardinality | **1:N** (one WO produces multiple Batches) | 1:1 | **Proposed** (shift/capacity splitting) |
| D3 | Equipment in Phase 3 | **WorkCenter now** (location/station); Equipment in Phase 8 | Minimal Equipment entity now; or free-text | **Proposed** (avoids Phase 8 rework) |
| D4 | Operator identity | **Employee** (not User; not every operator has a login) | User | **Proposed** (supports kiosk/non-login operators) |
| D5 | Material reservation vs consumption | **Both** (reservation = planning; consumption = traceability) | Consumption only | **Proposed** (or consumption-only if simpler) |
| D6 | Routing ownership | **1:1 with ProductRevision (global, frozen at EFFECTIVE)** like BOM | Site-specific routings | **Proposed** (consistency with BOM D2) |
| D7 | Production state machines | WO: PLANNED→RELEASED→IN_PRODUCTION→COMPLETED→CLOSED +CANCELLED/ON_HOLD; Batch: PLANNED→IN_PRODUCTION→COMPLETED→READY_FOR_REVIEW +ON_HOLD; DeviceLot: CREATED→IN_PROCESS→COMPLETED | Simpler/different | **Proposed** |
| D8 | Scrap and rework | ProductionScrap + ProductionRework records (quantities + reasons); full quality investigation in Phase 6 | Defer entirely | **Proposed** (records the event; investigation deferred) |

**If any of D1–D8 is not confirmed, the schema in §4 cannot be finalized.** I will NOT implement until these are resolved.

### 3.10 Entity definitions (assuming D1–D8 as proposed)

**Routing + Operation (global, 1:1 with ProductRevision):**
- **Routing** — the controlled sequence of Operations for a ProductRevision. 1:1 (like BOM, D6). Fields: `productRevisionId` (unique), `status` (mirrors revision), `version`. Frozen when revision EFFECTIVE (ADR-0006 pattern).
- **Operation** — a step in a Routing. Fields: `routingId`, `sequence` (order), `name`, `description`, `workCenterId?` (optional — the default WorkCenter for this step; execution may override), `estimatedDurationMinutes?`, `instructions?` (text). Global (part of the routing).

**Work Center (site-owned):**
- **WorkCenter** — a named location/station at a Site where work happens. Fields: `code` (unique per site), `name`, `siteId`, `description?`, `status` (ACTIVE/INACTIVE), `isDemo`. Site-owned (multi-site isolation applies).

**Work Order (site-owned):**
- **WorkOrder** — authorized instruction to produce. Fields: `code` (unique per site), `productRevisionId`, `siteId`, `plannedQuantity` (Decimal, >0), `unit`, `status` (D7 state machine), `plannedStartDate?`, `plannedDueDate?`, `releasedAt?`, `closedAt?`, `reason?` (for hold/cancel), `isDemo`. Site-owned.

**Manufacturing Batch (site-owned):**
- **ManufacturingBatch** — a produced traceable unit. Fields: `code` (unique per site), `workOrderId`, `productRevisionId` (denormalized from WO), `siteId`, `plannedQuantity`, `actualQuantity?`, `unit`, `status` (D7), `startedAt?`, `completedAt?`, `isDemo`. Site-owned. Has many DeviceLots.

**Device Lot (site-owned):**
- **DeviceLot** — a traceable sub-unit of a Batch (D1). Fields: `code` (unique per site), `batchId`, `siteId`, `quantity`, `unit`, `status` (CREATED/IN_PROCESS/COMPLETED), `isDemo`. Site-owned. Belongs to 1 Batch.

**Production execution (site-owned):**
- **OperationExecution** — the actual execution of an Operation against a Batch. Fields: `batchId`, `operationId`, `workCenterId?`, `startedAt`, `completedAt?`, `status` (PENDING/IN_PROGRESS/COMPLETED/SKIPPED), `operatorEmployeeId` (D4), `loggedByUserId` (the authenticated user who created the record), `parameters?` (Json), `notes?`. Site-owned (via batch).
- **MaterialConsumption** — consuming a MaterialLot against a Batch. Fields: `batchId`, `materialLotId`, `quantity` (Decimal, >0, ≤ available), `unit`, `consumedAt`, `recordedByUserId`, `notes?`. Decrements `MaterialLot.quantityAvailable`. Site-owned.
- **MaterialReservation** (if D5 = both) — allocating material to a Work Order. Fields: `workOrderId`, `materialLotId`, `quantityReserved`, `unit`, `status` (ACTIVE/FULFILLED/CANCELLED), `reservedAt`. Site-owned.
- **ProductionScrap** — scrapped quantity. Fields: `batchId?`, `deviceLotId?`, `quantity`, `unit`, `reason`, `scrapedAt`, `recordedByUserId`. Site-owned.
- **ProductionRework** — rework record. Fields: `batchId?`, `deviceLotId?`, `quantity`, `unit`, `reason`, `reworkStartedAt`, `reworkCompletedAt?`, `recordedByUserId`. Site-owned.

**Shift (site-owned, basic):**
- **Shift** — a work shift at a Site. Fields: `siteId`, `name` (e.g., "Morning", "Night"), `startTime`, `endTime`, `status`. Site-owned. OperationExecution can reference a shift (optional, for OEE Phase 10). Phase 3 includes basic shift identity; full handover is Phase 3 minimal.

---

## 4. Database schema (proposed, pending §3 confirmation)

PG-portable Prisma additions. Decimal for all quantities. No SQLite-only types. Additive to Phase 1+2.

```prisma
// ============================================================================
// Production execution (Phase 3, ADR-0006 pattern for routing immutability)
// D1: Batch 1:N DeviceLot. D3: WorkCenter now, Equipment in Phase 8.
// D4: Operator = Employee. D6: Routing 1:1 with ProductRevision (global, frozen at EFFECTIVE).
// ============================================================================

model Routing {
  id                String   @id @default(cuid())
  productRevisionId String   @unique          // 1:1 with ProductRevision (D6, like BOM)
  status            String   @default("DRAFT")
  version           Int      @default(1)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  productRevision ProductRevision @relation(fields: [productRevisionId], references: [id], onDelete: Cascade)
  operations      Operation[]

  @@index([status])
}

model Operation {
  id                   String  @id @default(cuid())
  routingId            String
  sequence             Int
  name                 String
  description          String?
  workCenterId         String?   // default WorkCenter (optional; execution may override)
  estimatedDurationMinutes Int?
  instructions         String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  routing     Routing      @relation(fields: [routingId], references: [id], onDelete: Cascade)
  workCenter  WorkCenter?  @relation(fields: [workCenterId], references: [id], onDelete: SetNull)
  executions  OperationExecution[]

  @@index([routingId])
}

model WorkCenter {
  id          String   @id @default(cuid())
  code        String                        // unique per site
  name        String
  siteId      String                        // SITE-OWNED (D4 pattern)
  description String?
  status      String   @default("ACTIVE")   // ACTIVE | INACTIVE
  isDemo      Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  site        Site          @relation(fields: [siteId], references: [id], onDelete: Restrict)
  operations  Operation[]
  executions  OperationExecution[]

  @@unique([siteId, code])
  @@index([siteId])
}

model WorkOrder {
  id                String   @id @default(cuid())
  code              String                        // unique per site
  productRevisionId String
  siteId            String                        // SITE-OWNED
  plannedQuantity   Decimal
  unit              String
  status            String   @default("PLANNED")  // PLANNED | RELEASED | IN_PRODUCTION | COMPLETED | CLOSED | CANCELLED | ON_HOLD
  plannedStartDate  DateTime?
  plannedDueDate    DateTime?
  releasedAt        DateTime?
  closedAt          DateTime?
  reason            String?                       // for hold/cancel
  isDemo            Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  productRevision ProductRevision @relation(fields: [productRevisionId], references: [id], onDelete: Restrict)
  site            Site            @relation(fields: [siteId], references: [id], onDelete: Restrict)
  batches         ManufacturingBatch[]
  reservations    MaterialReservation[]

  @@unique([siteId, code])
  @@index([siteId])
  @@index([status])
  @@index([productRevisionId])
}

model ManufacturingBatch {
  id                String   @id @default(cuid())
  code              String                        // unique per site
  workOrderId       String
  productRevisionId String                        // denormalized from WO
  siteId            String                        // SITE-OWNED
  plannedQuantity   Decimal
  actualQuantity    Decimal?
  unit              String
  status            String   @default("PLANNED")  // PLANNED | IN_PRODUCTION | COMPLETED | READY_FOR_REVIEW | ON_HOLD
  startedAt         DateTime?
  completedAt       DateTime?
  isDemo            Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  workOrder       WorkOrder       @relation(fields: [workOrderId], references: [id], onDelete: Restrict)
  productRevision ProductRevision @relation(fields: [productRevisionId], references: [id], onDelete: Restrict)
  site            Site            @relation(fields: [siteId], references: [id], onDelete: Restrict)
  deviceLots      DeviceLot[]
  executions      OperationExecution[]
  consumptions    MaterialConsumption[]
  scraps          ProductionScrap[]
  reworks         ProductionRework[]

  @@unique([siteId, code])
  @@index([workOrderId])
  @@index([siteId])
  @@index([status])
}

model DeviceLot {
  id        String   @id @default(cuid())
  code      String                        // unique per site
  batchId   String
  siteId    String                        // SITE-OWNED (via batch)
  quantity  Decimal
  unit      String
  status    String   @default("CREATED")  // CREATED | IN_PROCESS | COMPLETED
  isDemo    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  batch    ManufacturingBatch @relation(fields: [batchId], references: [id], onDelete: Restrict)
  site     Site               @relation(fields: [siteId], references: [id], onDelete: Restrict)
  scraps   ProductionScrap[]
  reworks  ProductionRework[]

  @@unique([siteId, code])
  @@index([batchId])
  @@index([siteId])
}

model OperationExecution {
  id                   String   @id @default(cuid())
  batchId              String
  operationId          String
  workCenterId         String?     // actual WorkCenter (may differ from Operation default)
  startedAt            DateTime
  completedAt          DateTime?
  status               String   @default("PENDING")  // PENDING | IN_PROGRESS | COMPLETED | SKIPPED
  operatorEmployeeId   String                        // D4: Employee (not User)
  loggedByUserId       String?                       // the authenticated user who created the record
  parameters           Json?
  notes                String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  batch      ManufacturingBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  operation  Operation          @relation(fields: [operationId], references: [id], onDelete: Restrict)
  workCenter WorkCenter?        @relation(fields: [workCenterId], references: [id], onDelete: SetNull)
  operator   Employee           @relation(fields: [operatorEmployeeId], references: [id], onDelete: Restrict)
  logger     User?              @relation(fields: [loggedByUserId], references: [id], onDelete: SetNull)

  @@index([batchId])
  @@index([operationId])
  @@index([operatorEmployeeId])
}

model MaterialConsumption {
  id              String   @id @default(cuid())
  batchId         String
  materialLotId   String
  quantity        Decimal                      // >0, <= available (service-enforced)
  unit            String
  consumedAt      DateTime @default(now())
  recordedByUserId String?
  notes           String?
  createdAt       DateTime @default(now())

  batch    ManufacturingBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  materialLot MaterialLot     @relation(fields: [materialLotId], references: [id], onDelete: Restrict)
  recorder User?              @relation(fields: [recordedByUserId], references: [id], onDelete: SetNull)

  @@index([batchId])
  @@index([materialLotId])
}

model MaterialReservation {
  id               String   @id @default(cuid())
  workOrderId      String
  materialLotId    String
  quantityReserved Decimal
  unit             String
  status           String   @default("ACTIVE")  // ACTIVE | FULFILLED | CANCELLED
  reservedAt       DateTime @default(now())
  fulfilledAt      DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  workOrder   WorkOrder   @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
  materialLot MaterialLot @relation(fields: [materialLotId], references: [id], onDelete: Restrict)

  @@index([workOrderId])
  @@index([materialLotId])
}

model ProductionScrap {
  id              String   @id @default(cuid())
  batchId         String?
  deviceLotId     String?
  quantity        Decimal
  unit            String
  reason          String
  scrapedAt       DateTime @default(now())
  recordedByUserId String?
  createdAt       DateTime @default(now())

  batch     ManufacturingBatch? @relation(fields: [batchId], references: [id], onDelete: Cascade)
  deviceLot DeviceLot?          @relation(fields: [deviceLotId], references: [id], onDelete: Cascade)
  recorder  User?               @relation(fields: [recordedByUserId], references: [id], onDelete: SetNull)

  @@index([batchId])
  @@index([deviceLotId])
}

model ProductionRework {
  id              String   @id @default(cuid())
  batchId         String?
  deviceLotId     String?
  quantity        Decimal
  unit            String
  reason          String
  reworkStartedAt  DateTime @default(now())
  reworkCompletedAt DateTime?
  recordedByUserId String?
  createdAt       DateTime @default(now())

  batch     ManufacturingBatch? @relation(fields: [batchId], references: [id], onDelete: Cascade)
  deviceLot DeviceLot?          @relation(fields: [deviceLotId], references: [id], onDelete: Cascade)
  recorder  User?               @relation(fields: [recordedByUserId], references: [id], onDelete: SetNull)

  @@index([batchId])
  @@index([deviceLotId])
}

model Shift {
  id        String   @id @default(cuid())
  siteId    String
  name      String   // e.g., "Morning", "Night"
  startTime String   // "08:00"
  endTime   String   // "16:00"
  status    String   @default("ACTIVE")
  isDemo    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  site Site @relation(fields: [siteId], references: [id], onDelete: Cascade)

  @@unique([siteId, name])
  @@index([siteId])
}
```

**Relation additions to existing models:**
- `ProductRevision`: add `routing Routing?`, `workOrders WorkOrder[]`, `batches ManufacturingBatch[]`.
- `MaterialLot`: add `quantityReserved Decimal @default(0)`, `consumptions MaterialConsumption[]`, `reservations MaterialReservation[]`.
- `Employee`: add `operationExecutions OperationExecution[]`.
- `User`: add `operationExecutionsLogged OperationExecution[]`, `consumptionsLogged MaterialConsumption[]`, `scrapsLogged ProductionScrap[]`, `reworksLogged ProductionRework[]`.
- `Site`: add `workCenters WorkCenter[]`, `workOrders WorkOrder[]`, `batches ManufacturingBatch[]`, `deviceLots DeviceLot[]`, `shifts Shift[]`.

**Constraints of note:**
- `Routing.productRevisionId` unique — 1:1 (D6).
- `WorkCenter(siteId, code)`, `WorkOrder(siteId, code)`, `ManufacturingBatch(siteId, code)`, `DeviceLot(siteId, code)` unique — codes unique per site.
- `MaterialConsumption.quantity > 0` and `≤ MaterialLot.quantityAvailable` (service-enforced; PG CHECK in migration).
- `MaterialLot.quantityReserved` + `quantityAvailable` ≤ `quantityReceived` (invariant extended from Phase 2).
- Routing frozen when revision EFFECTIVE (same as BOM, ADR-0006).

---

## 5. API design

New permission module `production`. Thin handlers, zod-validated, envelope, RBAC-guarded.

```
# Routing + Operations (global, frozen at EFFECTIVE like BOM)
GET    /api/production/routings/:revisionId
POST   /api/production/routings/:revisionId/operations       (draft/in_review only)
PATCH  /api/production/operations/:id
DELETE /api/production/operations/:id

# Work Centers (site-owned)
GET    /api/production/work-centers
POST   /api/production/work-centers
PATCH  /api/production/work-centers/:id

# Work Orders (site-owned)
GET    /api/production/work-orders
POST   /api/production/work-orders
GET    /api/production/work-orders/:id
POST   /api/production/work-orders/:id/transition            (PLANNED->RELEASED->IN_PRODUCTION->COMPLETED->CLOSED; +CANCELLED/ON_HOLD)

# Batches (site-owned)
GET    /api/production/batches
POST   /api/production/work-orders/:id/batches
GET    /api/production/batches/:id
POST   /api/production/batches/:id/transition                (PLANNED->IN_PRODUCTION->COMPLETED->READY_FOR_REVIEW; +ON_HOLD)

# Device Lots (site-owned, split from a batch)
GET    /api/production/batches/:id/device-lots
POST   /api/production/batches/:id/device-lots               (split a batch into a device lot)
POST   /api/production/device-lots/:id/transition

# Production execution (site-owned)
POST   /api/production/batches/:id/executions                (log an operation execution)
PATCH  /api/production/executions/:id
POST   /api/production/batches/:id/consumptions              (consume a material lot)
POST   /api/production/batches/:id/scraps
POST   /api/production/batches/:id/reworks

# Material reservation (site-owned)
POST   /api/production/work-orders/:id/reservations
PATCH  /api/production/reservations/:id

# Shifts (site-owned)
GET    /api/production/shifts
POST   /api/production/shifts
```

**State transitions** via explicit `/transition` endpoints (audited, with reason). **Material consumption** is transactional (decrement `quantityAvailable` + create `MaterialConsumption` in one transaction; reject if quantity > available). **Routing immutability** (D6): operation add/edit/delete rejected when revision not DRAFT/IN_REVIEW (same guard as BOM, ADR-0006).

---

## 6. UI architecture

New pages under `[locale]/(app)/production/`:
- `work-orders/` — WO list (site-scoped, status badges), create dialog, detail (batches tab, reservations tab).
- `work-orders/[id]/` — WO detail with state-transition buttons, batches list.
- `batches/` — Batch list (site-scoped), detail (device lots, executions, consumptions, scrap/rework tabs).
- `batches/[id]/` — Batch detail with state-transition buttons, device-lot split, consumption form.
- `routings/` — accessed via product revision detail (routing editor like BOM editor; frozen when EFFECTIVE).
- `work-centers/` — WorkCenter list + create.
- `shifts/` — Shift list + create.

**Nav:** add "Production" group to sidebar (Work Orders, Batches, Work Centers, Shifts), permission-gated.

**i18n:** extend catalogs with `production.*` keys (FR/EN/AR). RTL-safe.

**Demo seed:** add to `prisma/seed.ts`: WorkCenters per site, Shifts per site, a Routing+Operations for each demo product revision (EFFECTIVE), 2-3 demo Work Orders (RELEASED/IN_PRODUCTION/COMPLETED), demo Batches (one with Device Lots split, one IN_PRODUCTION with consumptions + executions), demo scrap/rework. All `isDemo: true`.

---

## 7. Security & audit

- **Permissions:** new `production.*` catalog: `production.workorder.{read,create,update,transition}`, `production.batch.{read,create,transition}`, `production.devicelot.{read,create,transition}`, `production.routing.{read,update}`, `production.workcenter.{read,create,update}`, `production.execution.{read,create}`, `production.consumption.{read,create}`, `production.scrap.{read,create}`, `production.rework.{read,create}`, `production.reservation.{read,create}`, `production.shift.{read,create,update}`. Least-privilege grants (Production Manager/Planner create WOs; Shift Supervisor/Operator execute; QA can hold; etc.).
- **3-layer enforcement** (reuse Phase 1).
- **Audit:** every create/update/transition/consumption/scrap/rework emits AuditEvent with previousState/newState + reason.
- **Routing immutability** (D6): same guard as BOM (ADR-0006).
- **Material consumption** transactional + audited; over-consumption rejected.

---

## 8. Multi-site isolation

- **Site-owned (SiteScope + assertSiteAccess):** WorkCenter, WorkOrder, ManufacturingBatch, DeviceLot, OperationExecution, MaterialConsumption, MaterialReservation, ProductionScrap, ProductionRework, Shift.
- **Global:** Routing, Operation (part of the global ProductRevision).
- Cross-site leakage remains CRITICAL (owner carry-forward #2/#4). Tests assert a Site-A user cannot see/access Site-B work orders, batches, etc.
- When PG lands (ADR-0002), RLS policies on all site-owned production tables.

---

## 9. Testing

Reuse Phase 1/2 test infrastructure. New critical tests:
- **T-WO-01:** Work Order state machine (PLANNED→RELEASED valid; PLANNED→COMPLETED invalid).
- **T-BATCH-01:** Batch state machine (PLANNED→IN_PRODUCTION→COMPLETED→READY_FOR_REVIEW; ON_HOLD reversible).
- **T-LOT-02:** Device Lot split (a Batch can have multiple Device Lots; quantities tracked).
- **T-CONS-01:** Material consumption decrements `quantityAvailable`; over-consumption rejected; transactional.
- **T-RES-01:** Material reservation decrements `quantityReserved`; `reserved + available ≤ received` invariant.
- **T-ROUTE-01:** Routing frozen when revision EFFECTIVE (operation add rejected).
- **T-ISOL-03:** Cross-site production isolation (Site-A user sees 0 Site-B work orders/batches).
- **T-EXEC-01:** OperationExecution records operator (Employee) + logger (User) separately (D4).
- **T-SCRAP-01:** Scrap records quantity + reason; does not create new entity.
- **Regression:** all 51 Phase 1+2 tests still pass.

---

## 10. Migration strategy

- **Schema:** additive Prisma migration (`phase3_production`) on top of Phase 2. No changes to Phase 1/2 tables except adding relations + `MaterialLot.quantityReserved`.
- **Seed:** extend `prisma/seed.ts` with Phase 3 demo data (idempotent upserts).
- **PG-portable:** Decimal everywhere, no SQLite-only types. PG migration will add CHECK constraints for quantity invariants.
- **No data loss:** Phase 1/2 data preserved.

---

## 11. Matt Pocock skills to use

| Activity | Skill |
|---|---|
| Resolve D1-D8 ambiguities | `grill-with-docs` (→ `grilling` + `domain-modeling`) — this plan IS the grilled output |
| Maintain CONTEXT.md / DOMAIN_GLOSSARY.md | `domain-modeling` |
| Design the production module seams | `codebase-design` |
| Turn this plan into a spec | `to-spec` |
| Break into tickets | `to-tickets` |
| Implement (after approval) | `tdd` + `implement` |
| Debug hard issues (transactional consumption) | `diagnosing-bugs` |
| Phase gate quality | `code-review` |

Skills never override the PRD (ADR-0001).

---

## 12. Files / modules to change (after approval)

**New:**
- `src/modules/production/{domain,service}/index.ts`
- `src/app/api/production/**` (route handlers)
- `src/app/[locale]/(app)/production/{work-orders,batches,work-centers,shifts,routings}/page.tsx`
- `src/components/app/production/*.tsx`
- `prisma/migrations/<ts>_phase3_production/migration.sql`
- `docs/adr/0008-batch-vs-device-lot-cardinality.md` (D1)
- `docs/adr/0009-workcenter-vs-equipment-phasing.md` (D3)
- `docs/api/production.md`
- `.scratch/phase-3/{spec.md,issues/NN-*.md}`

**Modified:** `prisma/schema.prisma` (Phase 3 models + relations), `prisma/seed.ts` (Phase 3 demo data), `src/lib/permissions.ts` (production.* permissions + grants), `src/components/app/app-sidebar.tsx` (Production nav group), `src/messages/{en,fr,ar}.json` (production.* keys), `CONTEXT.md` + `DOMAIN_GLOSSARY.md` (Phase 3 terms), `docs/architecture/rbac-matrix.md` (production permissions).

---

## 13. Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| P3-R1 | D1-D8 unconfirmed → schema blocked | H | Critical | this plan flags them; NO implementation until confirmed |
| P3-R2 | Batch/DeviceLot model wrong → Phase 4 genealogy rework | M | High | D1 (1:N) is the most flexible; grill thoroughly |
| P3-R3 | Material consumption race condition (two batches consume same lot) | M | High | transactional consumption with row-level check |
| P3-R4 | Routing immutability conflicts with site-specific process needs | M | M | D6 (global routing) + execution-time WorkCenter override handles site differences |
| P3-R5 | Equipment phasing (Phase 8) breaks WorkCenter model | L | M | D3 WorkCenter is a stable concept; Equipment links to it later |
| P3-R6 | Operator-as-Employee excludes contractors without Employee records | L | L | contractors should have Employee records (personnel identity); documented |
| P3-R7 | Production status too complex (7 WO states) | L | L | all states are necessary for controlled workflows; documented |
| P3-R8 | Scrap/rework overlaps with Phase 6 NCR | M | M | Phase 3 records the event (quantity + reason); Phase 6 adds the quality investigation |

---

## 14. Dependencies

- **No new runtime deps.** Reuses Phase 1/2 stack.
- **Phase 2 foundation required:** Product/Revision/BOM/Material/MaterialLot (all present).
- **Phase 1 foundation required:** Employee (for Operator, D4), User (for logger), Site/SiteScope, audit, RBAC (all present).

---

## 15. Acceptance criteria (definition of done)

Phase 3 is DONE only when ALL hold (PRD §19 Phase Gate):

1. Routing/Operation/WorkCenter/WorkOrder/Batch/DeviceLot/OperationExecution/MaterialConsumption/MaterialReservation/ProductionScrap/ProductionRework/Shift entities exist with the §4 schema (after D1-D8 confirmation).
2. Routing 1:1 with ProductRevision, frozen when EFFECTIVE (D6, ADR-0006 pattern); tested T-ROUTE-01.
3. Work Order + Batch + DeviceLot state machines enforced + audited (D7); tested T-WO-01, T-BATCH-01, T-LOT-02.
4. Material consumption transactional, decrements quantityAvailable, rejects over-consumption (D5); tested T-CONS-01.
5. Material reservation tracks quantityReserved; invariant holds (D5); tested T-RES-01.
6. Operator = Employee; logger = User (D4); tested T-EXEC-01.
7. Scrap/rework recorded with quantities + reasons (D8); tested T-SCRAP-01.
8. All site-owned production entities respect SiteScope; cross-site isolation tested (T-ISOL-03).
9. Every create/update/transition/consumption/scrap/rework audited.
10. RBAC: production.* permissions, 3-layer, least-privilege.
11. i18n: all UI strings from catalogs; FR/EN/AR; RTL-safe.
12. Demo seed: synthetic, labelled DEMO/TEST, multi-site testable.
13. All Phase 1+2 tests still pass (51); new Phase 3 tests pass.
14. Lint 0 errors; typecheck clean.
15. Browser-verified: create WO → release → create batch → consume material → split device lot → complete batch → READY_FOR_REVIEW.
16. ADRs 0008 (Batch vs DeviceLot) + 0009 (WorkCenter vs Equipment) written.
17. Phase 3 Validation Report produced; STOP; owner approval.

---

## 16. Test plan (summary)

| Layer | What | Critical tests |
|---|---|---|
| Unit | state machines (WO, Batch, DeviceLot), quantity invariants, routing immutability | T-WO-01, T-BATCH-01, T-LOT-02, T-CONS-01, T-RES-01, T-ROUTE-01 |
| Integration | service flows (create WO → batch → consume → complete), transactional consumption | end-to-end production flow |
| API | envelope, 401/403/400/409/422/200 | each endpoint |
| Authz | can() per role | Production Planner vs Operator vs QA on transitions |
| Multi-site | cross-site WO/Batch isolation | T-ISOL-03 |
| Audit | every transition + consumption audited | T-AUDIT-04 |
| Operator/Logger | D4 separation | T-EXEC-01 |
| Regression | Phase 1+2 tests | all 51 pass |

---

## 17. Open questions (require owner decision before implementation)

> **These are the 8 critical domain decisions from §3. I will NOT implement Phase 3 until these are confirmed.**

- **D1 — Batch vs Device Lot cardinality:** confirm 1:N (a Batch is split into Device Lots)? *(Recommendation: yes; supports sterilization lot splitting)*
- **D2 — Work Order → Batch cardinality:** confirm 1:N (one WO produces multiple Batches)? *(Recommendation: yes)*
- **D3 — Equipment/WorkCenter phasing:** confirm WorkCenter now (site-owned location/station), Equipment in Phase 8? *(Recommendation: yes; avoids Phase 8 rework)*
- **D4 — Operator identity:** confirm Employee (not User; not every operator has a login); logger = the authenticated User? *(Recommendation: yes)*
- **D5 — Material reservation vs consumption:** confirm both (reservation = planning; consumption = traceability), or consumption-only? *(Recommendation: both; or consumption-only if you prefer simpler)*
- **D6 — Routing ownership:** confirm 1:1 with ProductRevision (global, frozen at EFFECTIVE), like BOM? *(Recommendation: yes)*
- **D7 — Production state machines:** confirm the WO/Batch/DeviceLot state machines as proposed? *(Recommendation: yes)*
- **D8 — Scrap and rework:** confirm ProductionScrap + ProductionRework records (quantities + reasons; full investigation in Phase 6)? *(Recommendation: yes)*

**Additional open questions (lower priority):**
- D9: Should Phase 3 include a basic "manufacturing instructions" document rendering (viewing the routing steps as instructions for the operator), or defer the instructions UI to a later phase? *(Recommendation: basic text instructions field on Operation; rich document rendering deferred)*
- D10: Should Shift include a handover feature (shift handover record), or is basic shift identity enough for Phase 3? *(Recommendation: basic identity; handover deferred to Phase 3.1 or later)*
- D11: Should WorkOrder reference a Customer/Project (PRD §10 genealogy starts with Customer/Project)? *(Recommendation: no — out of scope, D8 from Phase 2; Customer/Project is a future phase)*

---

```
PHASE 3 PLAN STATUS: WAITING FOR OWNER APPROVAL (and §3 / §17 domain decisions D1-D8)
```

**I am stopping here.** I will not implement Phase 3, will not create Phase 3 tickets under `.scratch/phase-3/` beyond this plan, and will not modify the schema until the owner (a) approves this plan and (b) confirms D1–D8. Awaiting your decisions.
