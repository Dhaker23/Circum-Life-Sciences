# CIRCUM — PHASE 10 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 10 — Lean / OEE / VSM / Downtime / Bottlenecks
> **Predecessor:** Phases 1-9 (all approved/closed). 63 existing models. Production + Quality data is trusted and available.
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only).
> **Source of truth:** Circum Master PRD §7 (Lean/OEE/VSM), §8 (Analytics — but Phase 11 is the dedicated Analytics phase), §9 (AI governance), §18 (Phase 10: Lean / OEE / VSM / downtime / bottlenecks), §19/§20 (Phase Gate/Report).
> **Critical owner constraint:** "Do not invent entities, terminology, workflows, regulatory requirements, acceptance criteria, business rules, permissions, architecture, or functionality."

---

## 0. Context: what Phase 10 covers

PRD §18 Phase 10: "Lean / OEE / VSM / downtime / bottlenecks."

PRD §7 states: "Lean/OEE/VSM remains part of Circum, but is **built on trusted manufacturing and quality data**." This is key — Phase 10 does NOT create new manufacturing data; it **computes metrics and analysis from existing Phase 2-9 data** (WorkOrders, Batches, OperationExecutions, Equipment, MaterialConsumption, ProductionScrap, ProductionRework, Shifts).

PRD §7 defines:
- **OEE** = Availability × Performance × Quality.
- Support: takt time, cycle time, FPY (First Pass Yield), scrap, rework, downtime, MTBF, MTTR, Pareto, bottleneck analysis.
- **VSM**: Supplier → Material → Process → Inventory → Process → Customer. Calculate lead time, value-added time, non-value-added time, value-added ratio.

**Important scope boundary:** PRD §8 (Analytics/Reporting/Dashboards) is Phase 11, not Phase 10. Phase 10 is the **metrics computation layer** (the engine that calculates OEE, downtime, etc.); Phase 11 is the **dashboard/reporting UI** that displays them. Phase 10 provides the APIs; Phase 11 builds the visual dashboards. However, a minimal UI to verify the metrics is appropriate.

---

## 1. Objectives

1. **Downtime tracking** — a `DowntimeEvent` entity to record equipment downtime (reason, duration, category). This is the one new data entity Phase 10 needs (existing data doesn't explicitly track downtime events).
2. **OEE computation** — service-layer computation of OEE = Availability × Performance × Quality, per Equipment/WorkCenter/Site/Shift, for a time range. Computed from: downtime events (availability), OperationExecution durations vs planned (performance), scrap/rework rates (quality).
3. **Lean metrics** — takt time, cycle time, FPY, scrap rate, rework rate, MTBF, MTTR. Computed from existing production + equipment data.
4. **Pareto analysis** — downtime reasons ranked by frequency/duration; scrap reasons ranked by quantity.
5. **Bottleneck analysis** — identify the WorkCenter/Equipment with the lowest throughput or highest queue time.
6. **VSM (Value Stream Map)** — a `ValueStreamMap` entity that captures the VSM structure (nodes: supplier/material/process/inventory/customer; edges with lead time, value-added time). The metrics (lead time, VA time, non-VA time, VA ratio) are computed from the VSM structure.
7. **Full RBAC + audit + multi-site + AI governance** — reuse Phase 1-9 infrastructure.

**Out of scope:** Analytics dashboards/reports (Phase 11), AI Assistant (Phase 12), Integrations (Phase 13), Customer/Project (deferred — VSM "Customer" node is a placeholder).

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 10 coverage |
|---|---|---|---|
| R1 | OEE = Availability × Performance × Quality | §7 | OEE computation service |
| R2 | Takt time, cycle time, FPY, scrap, rework, downtime, MTBF, MTTR, Pareto, bottleneck | §7 | Lean metrics computation |
| R3 | VSM: Supplier → Material → Process → Inventory → Process → Customer | §7 | ValueStreamMap entity + computation |
| R4 | Calculate lead time, value-added time, non-value-added time, value-added ratio | §7 | VSM metrics |
| R5 | Built on trusted manufacturing and quality data | §7 | Queries existing Phase 2-9 data |
| R6 | Phase Gate (§19) + Phase Validation Report (§20) | §19, §20 | full gate |
| R7 | PostgreSQL-portable (ADR-0002) | §11 | no SQLite-only types |

---

## 3. Domain model (grill-with-docs + domain-modeling)

### 3.1 New data entities vs computation-only (D1 — CRITICAL, OWNER DECISION REQUIRED)

**Question:** Does Phase 10 introduce new data entities, or is it purely a computation/query layer over existing data (like Phase 6 Traceability)?

**Analysis:**
- **OEE, Lean metrics, Pareto, bottleneck analysis** — these are computed from existing data (OperationExecution, Equipment, ProductionScrap, ProductionRework, WorkOrder, Batch, Shift). No new entity needed; they're service-layer computations returning structured results.
- **Downtime tracking** — the PRD mentions "downtime" as a metric. Currently, downtime is NOT explicitly tracked as a discrete event in the system. Equipment has `operationalStatus` (OPERATIONAL/MAINTENANCE/OUT_OF_SERVICE) but there's no structured downtime-event log with reason/duration/category. **A `DowntimeEvent` entity is needed** to record when and why equipment was down, enabling availability calculation.
- **VSM** — a Value Stream Map is a structured model (nodes + edges with times). It's not derivable from existing data; it must be user-defined. **A `ValueStreamMap` entity + `VsmNode` + `VsmEdge` entities are needed.**

**Proposed resolution (D1):** **Hybrid: 2 new data entities (DowntimeEvent + ValueStreamMap with VsmNode/VsmEdge) + computation services for OEE/Lean/Pareto/Bottleneck.**
- `DowntimeEvent` — new entity (records downtime events with reason, category, duration).
- `ValueStreamMap` + `VsmNode` + `VsmEdge` — new entities (user-defined VSM structure).
- OEE, Lean metrics, Pareto, bottleneck — computation services over existing + DowntimeEvent data.

**Recommendation: hybrid (DowntimeEvent + VSM entities + computation services).** **Please confirm D1.**

### 3.2 DowntimeEvent model (D2)

**Proposed resolution (D2):**
- **DowntimeEvent** — a record of equipment downtime. Fields: `code` (unique per site), `equipmentId`, `siteId`, `workCenterId?`, `downtimeCategory` (UNPLISHED/ELECTRICAL/MECHANICAL/CHANGEOVER/MATERIAL_SHORTAGE/OPERATOR_ABSENCE/PLANNED_MAINTENANCE/OTHER — configurable), `reason` (text), `startTime`, `endTime?`, `durationMinutes?` (computed from endTime - startTime), `shiftId?`, `status` (OPEN/CLOSED), `isDemo`. Site-owned.
- When `endTime` is set, `durationMinutes` is computed.
- Downtime events feed the Availability calculation: Availability = (Planned Production Time - Downtime) / Planned Production Time.

**Recommendation: yes.** **Please confirm D2.**

### 3.3 OEE computation model (D3)

**Question:** Is OEE stored (as a snapshot) or computed on-demand?

**Proposed resolution (D3):** **Computed on-demand (no storage).** OEE is a calculation, not a controlled record. It's computed from:
- **Availability** = (Planned Production Time - Downtime Duration) / Planned Production Time. Sources: DowntimeEvent + Shift definitions.
- **Performance** = (Ideal Cycle Time × Total Count) / Run Time. Sources: OperationExecution (actual duration) + Routing (estimated duration) + Batch (quantity).
- **Quality** = Good Count / Total Count. Sources: Batch (planned/actual quantity) - ProductionScrap (scrap quantity) - ProductionRework (rework quantity).

The OEE API accepts: `equipmentId?`, `workCenterId?`, `siteId`, `fromDate`, `toDate`, `shiftId?` and returns the computed OEE + its components.

**Alternative:** Store OEE as a snapshot (OeeRecord entity) for historical trending. Rejected for Phase 10 — Phase 11 (Analytics) can add snapshot/trending if needed. Phase 10 computes on-demand.

**Recommendation: computed on-demand.** **Please confirm D3.**

### 3.4 VSM model (D4)

**Proposed resolution (D4):** Three entities:
- **ValueStreamMap** — a named VSM. Fields: `code`, `name`, `siteId?` (optional — a VSM could be cross-site or site-specific), `description?`, `status` (DRAFT/ACTIVE/ARCHIVED), `isDemo`. Fields for computed totals: `totalLeadTime?`, `totalValueAddedTime?`, `totalNonValueAddedTime?`, `valueAddedRatio?` (computed when the VSM is evaluated).
- **VsmNode** — a node in the VSM. Fields: `vsmId`, `sequence` (order), `nodeType` (SUPPLIER/MATERIAL/PROCESS/INVENTORY/CUSTOMER), `name`, `description?`, `leadTimeMinutes?`, `valueAddedMinutes?` (user-entered; non-VA = leadTime - VA). Belongs to ValueStreamMap.
- **VsmEdge** — an edge connecting nodes. Fields: `fromNodeId`, `toNodeId`, `description?`. (Edges are primarily structural; the time metrics are on the nodes.)

The VSM metrics (lead time, VA time, non-VA time, VA ratio) are computed by summing across all nodes:
- Total Lead Time = Σ leadTimeMinutes
- Total VA Time = Σ valueAddedMinutes
- Total Non-VA Time = Total Lead Time - Total VA Time
- VA Ratio = Total VA Time / Total Lead Time

**Recommendation: 3 entities (ValueStreamMap + VsmNode + VsmEdge).** **Please confirm D4.**

### 3.5 VSM site ownership (D5)

**Question:** Is a VSM site-owned or global?

**Proposed resolution (D5):** **Site-owned (optional siteId).** A VSM typically describes a value stream at a specific site. However, a VSM could be cross-site (corporate-level). Making `siteId` optional allows both. If siteId is set, SiteScope applies; if null, it's global (super_admin only).

**Recommendation: optional siteId (site-scoped if set; global if null).** **Please confirm D5.**

### 3.6 Downtime category configurability (D6)

**Question:** Are downtime categories hard-coded or configurable?

**Proposed resolution (D6):** **The `downtimeCategory` is a free-text string** (not a hard-coded enum). The PRD lists categories (unplanned, electrical, mechanical, changeover, material shortage, operator absence, planned maintenance, other) but the system should not hard-code them. The service layer can suggest common categories but the user can enter any. This allows Pareto analysis by category without being constrained to a fixed list.

**Recommendation: free-text category (not hard-coded).** **Please confirm D6.**

### 3.7 AI governance (D7)

**Proposed resolution (D7):** AI may:
- Analyze OEE data (summarize, highlight low-OEE equipment).
- Suggest bottleneck areas.
- Explain VSM metrics.

AI must NOT:
- Modify any production or quality records.
- Create or close DowntimeEvents.
- Modify VSM structure.
- Override any controlled record.

Phase 10 is primarily read-only computation; AI gets `lean.read` permission only. DowntimeEvent create/close and VSM edit require human permissions.

**Recommendation: AI read-only.** **Please confirm D7.**

### 3.8 Summary of proposed domain decisions

| # | Decision | Proposed | Recommendation |
|---|---|---|---|
| D1 | New entities vs computation-only | Hybrid: DowntimeEvent + VSM entities (new data) + OEE/Lean/Pareto/Bottleneck (computation services) | **Confirm** |
| D2 | DowntimeEvent model | New entity with category, reason, start/end, duration, status. Site-owned. | **Confirm** |
| D3 | OEE computation | Computed on-demand (no storage). Availability × Performance × Quality from existing data + DowntimeEvent. | **Confirm** |
| D4 | VSM model | 3 entities: ValueStreamMap + VsmNode + VsmEdge. Metrics computed from node times. | **Confirm** |
| D5 | VSM site ownership | Optional siteId (site-scoped if set; global if null). | **Confirm** |
| D6 | Downtime category | Free-text string (not hard-coded). | **Confirm** |
| D7 | AI governance | AI read-only (lean.read). No create/modify/close for AI. | **Confirm** |

---

## 4. Database schema (proposed, pending §3 confirmation)

```prisma
model DowntimeEvent {
  id               String   @id @default(cuid())
  code             String   // unique per site
  equipmentId      String
  siteId           String
  workCenterId     String?
  downtimeCategory String   // free-text (D6): e.g., "MECHANICAL", "CHANGEOVER"
  reason           String
  startTime        DateTime
  endTime          DateTime?
  durationMinutes  Int?     // computed when endTime is set
  shiftId          String?
  status           String   @default("OPEN") // OPEN | CLOSED
  isDemo           Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  equipment   Equipment   @relation(fields: [equipmentId], references: [id], onDelete: Restrict)
  site        Site        @relation(fields: [siteId], references: [id], onDelete: Restrict)
  workCenter  WorkCenter? @relation(fields: [workCenterId], references: [id], onDelete: SetNull)
  shift       Shift?      @relation(fields: [shiftId], references: [id], onDelete: SetNull)

  @@unique([siteId, code])
  @@index([equipmentId])
  @@index([siteId])
  @@index([status])
}

model ValueStreamMap {
  id                      String   @id @default(cuid())
  code                    String   @unique
  name                    String
  siteId                  String?  // optional (D5): site-scoped if set, global if null
  description             String?
  status                  String   @default("DRAFT") // DRAFT | ACTIVE | ARCHIVED
  totalLeadTimeMinutes    Int?     // computed
  totalValueAddedMinutes  Int?     // computed
  totalNonValueAddedMinutes Int?   // computed
  valueAddedRatio         Decimal? // computed = VA / Lead
  isDemo                  Boolean  @default(false)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  site  Site?       @relation(fields: [siteId], references: [id], onDelete: SetNull)
  nodes VsmNode[]

  @@index([status])
}

model VsmNode {
  id                  String   @id @default(cuid())
  vsmId               String
  sequence            Int
  nodeType            String   // SUPPLIER | MATERIAL | PROCESS | INVENTORY | CUSTOMER
  name                String
  description         String?
  leadTimeMinutes     Int?
  valueAddedMinutes   Int?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  vsm       ValueStreamMap @relation(fields: [vsmId], references: [id], onDelete: Cascade)
  edgesFrom VsmEdge[]      @relation("VsmEdgeFrom")
  edgesTo   VsmEdge[]      @relation("VsmEdgeTo")

  @@index([vsmId])
}

model VsmEdge {
  id          String   @id @default(cuid())
  fromNodeId  String
  toNodeId    String
  description String?
  createdAt   DateTime @default(now())

  fromNode VsmNode @relation("VsmEdgeFrom", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNode   VsmNode @relation("VsmEdgeTo", fields: [toNodeId], references: [id], onDelete: Cascade)

  @@index([fromNodeId])
  @@index([toNodeId])
}
```

**Relation additions:** `Equipment` gets `downtimeEvents[]`. `Site` gets `downtimeEvents[]`, `valueStreamMaps[]`. `WorkCenter` gets `downtimeEvents[]`. `Shift` gets `downtimeEvents[]`.

---

## 5. API design

New permission module `lean.*`.

```
# Downtime Events
GET    /api/lean/downtime
POST   /api/lean/downtime                 (create downtime event)
POST   /api/lean/downtime/:id/close       (close: set endTime, compute duration)

# OEE Computation (on-demand)
POST   /api/lean/oee                      { equipmentId?, workCenterId?, siteId, fromDate, toDate, shiftId? }
      → { availability, performance, quality, oee, downtimeEvents, plannedProductionTime, runTime, goodCount, totalCount }

# Lean Metrics
POST   /api/lean/metrics                  { siteId, fromDate, toDate, equipmentId? }
      → { taktTime, cycleTime, fpy, scrapRate, reworkRate, mtbf, mttr, paretoDowntime, paretoScrap, bottlenecks }

# VSM
GET    /api/lean/vsm
POST   /api/lean/vsm                      (create VSM)
GET    /api/lean/vsm/:id
POST   /api/lean/vsm/:id/nodes            (add node)
POST   /api/lean/vsm/:id/edges            (add edge)
POST   /api/lean/vsm/:id/evaluate         (compute metrics: lead time, VA, non-VA, ratio)
```

---

## 6. UI architecture

Pages under `[locale]/(app)/lean/`:
- `downtime/` — downtime events list (equipment, category, duration, status).
- `oee/` — OEE computation form (select equipment/site/date range) + results display.
- `vsm/` — VSM list + detail (nodes/edges + computed metrics).

**Nav:** add "Lean" group to sidebar (Downtime, OEE, VSM).

---

## 7. Testing

- **T-DOWN-01:** DowntimeEvent state machine (OPEN→CLOSED; duration computed on close).
- **T-OEE-01:** OEE computation: Availability × Performance × Quality = OEE.
- **T-LEAN-01:** Lean metrics: FPY, scrap rate, rework rate computed from existing data.
- **T-PARETO-01:** Downtime Pareto (categories ranked by total duration).
- **T-VSM-01:** VSM metrics: lead time, VA time, non-VA time, VA ratio computed from nodes.
- **T-ISOL-10:** Cross-site downtime/VSM isolation.
- **T-AI-GUARD-07:** AI governance (lean.read only; no create/close for AI).
- **Regression:** all 281 Phase 1-9 tests pass.

---

## 8. Open questions (require owner decision)

- **D1 — New entities vs computation-only:** confirm hybrid (DowntimeEvent + VSM entities + computation services)? *(Recommendation: yes)*
- **D2 — DowntimeEvent model:** confirm new entity with category, reason, start/end, duration, status? *(Recommendation: yes)*
- **D3 — OEE computation:** confirm computed on-demand (no storage)? *(Recommendation: yes)*
- **D4 — VSM model:** confirm 3 entities (ValueStreamMap + VsmNode + VsmEdge)? *(Recommendation: yes)*
- **D5 — VSM site ownership:** confirm optional siteId (site-scoped if set; global if null)? *(Recommendation: yes)*
- **D6 — Downtime category:** confirm free-text string (not hard-coded)? *(Recommendation: yes)*
- **D7 — AI governance:** confirm AI read-only (lean.read)? *(Recommendation: yes)*

---

```
PHASE 10 PLAN STATUS: WAITING FOR OWNER APPROVAL (and D1-D7 confirmation)
```

**I am stopping here.** Awaiting your approval and confirmation of D1–D7.
