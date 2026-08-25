# CIRCUM — PHASE 6 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 6 — Traceability / Genealogy / Impact Analysis (PRD Roadmap Phase 4, filling the gap skipped in our implementation sequence)
> **Predecessor:** Phases 1-5 (all approved/closed). Builds on ALL prior phases: Product/Revision/BOM/Material (P2) + WorkOrder/Batch/DeviceLot/Consumption (P3) + NCR/Deviation/CAPA (P4) + Sample/TestResult/Inspection (P5).
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only). Implementation gated on owner approval of this plan AND the domain decisions in §3.
> **Source of truth:** Circum Master PRD §10 (Traceability genealogy), §5 (genealogy chain), §18 (Phase 4: Traceability / genealogy / impact analysis), §9 (AI governance), §10 (Data Integrity), §16 (Docs), §17 (Validation-minded), §19/§20 (Phase Gate/Report). GLM Master Prompt §10 (TRACEABILITY).
> **Critical PRD constraint (§10):** "Traceability errors are critical defects."

---

## 0. Context: why Phase 6 = Traceability (not NCR/CAPA)

The PRD §18 roadmap defines:
- Phase 4: Traceability / genealogy / impact analysis
- Phase 5: Quality / inspection / laboratory / specifications / testing
- Phase 6: NCR / nonconformity / deviation / RCA / CAPA

Our implementation sequence was:
- Our Phase 4 = NCR/Deviation/Investigation/CAPA/ChangeControl/Risk (PRD Phase 6 + parts of Phase 7) — **done early**
- Our Phase 5 = Laboratory/Inspection/Testing/Specifications (PRD Phase 5) — **done**

**PRD Phase 4 (Traceability/Genealogy/Impact Analysis) was skipped** — we built the genealogy *data* (all relationships wired across Phases 2-5) but never built the dedicated *query, reporting, and impact-analysis layer*. This is the gap our Phase 6 fills.

The genealogy chain (PRD §10) is:
```
Customer/Project → Product → Revision → BOM → Material Lot → Work Order → Batch/Device Lot → Operations → Equipment → Operators → Inspection/Testing → Packaging → Sterilization → Disposition → Shipment
```

**What exists today (data):** Product→Revision→BOM→Material, WorkOrder→Batch→DeviceLot, Consumption→MaterialLot, NCR/Deviation→production entities (polymorphic), TestResult/Inspection→production entities (polymorphic). All relationships are in the database.

**What's missing (Phase 6 scope):** Forward-trace queries, backward-trace queries, impact analysis, genealogy visualization, traceability audit, and export. No new entities are needed for the core genealogy — this is a query/reporting layer over existing data.

---

## 1. Objectives

Phase 6 establishes the **Traceability query, reporting, and impact-analysis layer**: the ability to answer the genealogy questions the PRD §10 and the owner require:

- **"Which Material Lots were actually consumed to manufacture this Device Lot?"** (backward trace)
- **"Which Device Lots were produced from this Manufacturing Batch?"** (forward trace)
- **"Which Work Order produced this Batch?"** (backward trace)
- **"Which Product Revision, BOM and Routing governed this production?"** (backward trace)
- **"If Material Lot X is recalled, which Batches/Device Lots/Inspections/TestResults are affected?"** (impact analysis)

**Concrete objectives:**

1. **Forward-trace API** — given a starting entity (MaterialLot, Material, Product, ProductRevision, WorkOrder, Batch), trace forward to all downstream entities (Batches, DeviceLots, TestResults, Inspections, NCRs).
2. **Backward-trace API** — given a terminal entity (DeviceLot, Batch, TestResult, Inspection, NCR), trace backward to all upstream entities (MaterialLots, Materials, BOM, ProductRevision, Product, WorkOrder).
3. **Impact analysis API** — given a starting entity + a scenario (recall, quarantine, deviation), compute the set of all affected entities across the genealogy chain.
4. **Genealogy visualization UI** — a tree/graph view showing the full genealogy chain for any entity.
5. **Traceability audit** — record who queried what genealogy, when (regulatory expectation).
6. **Traceability export** — export genealogy/impact results as CSV/JSON for regulatory review.
7. **Full RBAC + multi-site** — reuse Phase 1-5 infrastructure; new `traceability.*` permissions; site-scoped queries (a user at Site A cannot trace genealogy at Site B unless authorized).
8. **AI governance (PRD §9)** — AI may assist with traceability analysis (summarize, highlight) but must never release/approve/modify based on traceability results.

**Out of scope (explicit):** Customer/Project entities (D5 — deferred unless owner confirms), Packaging/Sterilization/Disposition/Shipment (not yet implemented; future phases), Equipment master (Phase 8), Document Control (Phase 7), new data entities (Phase 6 is a query layer over existing data, not new entities — unless D1 confirms otherwise).

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 6 coverage |
|---|---|---|---|
| R1 | Forward and backward genealogy | §5, §10 | Forward-trace + backward-trace APIs |
| R2 | Full chain: Product → Revision → BOM → Material Lot → Work Order → Batch/Device Lot → Operations → Equipment → Operators → Inspection/Testing | §10 | All existing data relationships traversed |
| R3 | "Which Material Lots were consumed to manufacture this Device Lot?" | Owner | Backward-trace from DeviceLot → MaterialLots |
| R4 | "Which Device Lots were produced from this Batch?" | Owner | Forward-trace from Batch → DeviceLots |
| R5 | "Which Work Order produced this Batch?" | Owner | Backward-trace from Batch → WorkOrder |
| R6 | "Which Product Revision, BOM and Routing governed this production?" | Owner | Backward-trace from Batch → ProductRevision → BOM/Routing |
| R7 | Impact analysis (recall, quarantine) | §18 Phase 4 | Impact-analysis API |
| R8 | Traceability errors are critical defects | §10 | tested (T-TRACE-01: genealogy integrity) |
| R9 | AI may assist but never release/approve | §9 | AI gets read-only traceability perms; no release/approve |
| R10 | Controlled records: audit trail | §5, §13 | traceability queries audited |
| R11 | Site isolation | §3, §10 | site-scoped genealogy queries; cross-site rejected |
| R12 | Phase Gate (§19) + Phase Validation Report (§20) | §19, §20 | full gate |
| R13 | PostgreSQL-portable (ADR-0002) | §11 | no schema changes (query layer); PG portable |

---

## 3. Domain model (grill-with-docs + domain-modeling)

> This is the heart of Phase 6. The owner directed: "Identify every ambiguity that could affect the data model, controlled workflow, traceability, regulatory workflow, authorization, auditability, AI governance, or site isolation." **No new entities are proposed unless confirmed by the owner (D1).** Phase 6 is primarily a query/reporting layer over existing data.

### 3.1 Query layer vs new entities (D1 — CRITICAL)

**Question:** Does Phase 6 introduce new entities (e.g., `TraceabilityRecord`, `GenealogySnapshot`), or is it a pure query layer over existing data?

**Proposed resolution (D1):** **Pure query layer + a `TraceabilityQueryLog` audit entity.** No `TraceabilityRecord` or `GenealogySnapshot` entity.
- The genealogy data already exists across Phases 2-5 (all relationships are in the DB).
- Forward/backward trace and impact analysis are computed at query time by traversing the existing relationship graph.
- A `TraceabilityQueryLog` entity records who queried what, when (regulatory audit expectation — who looked at genealogy and when).
- **No genealogy snapshot** — the live data IS the genealogy. Snapshots would risk staleness and divergence from the source of truth.
- **If the owner needs a snapshot** (e.g., a "frozen genealogy at time of batch release" for regulatory evidence), that can be a future feature. Phase 6 does live queries.

**Recommendation: yes (pure query layer + TraceabilityQueryLog).** **Please confirm D1.**

### 3.2 Forward-trace scope and hops (D2)

**Question:** How many hops does a forward-trace traverse? Starting from a MaterialLot, does it stop at DeviceLot, or continue to TestResults/Inspections/NCRs?

**Proposed resolution (D2):** **Full chain, configurable depth.** A forward trace from any starting entity traverses ALL downstream relationships:
- From MaterialLot: → MaterialConsumption → Batch → DeviceLot → TestResults, Inspections, NCRs, ProductionScrap, ProductionRework.
- From Batch: → DeviceLots → (same downstream).
- From WorkOrder: → Batches → DeviceLots → (same downstream).
- From Product/Revision: → WorkOrders → Batches → DeviceLots → (same downstream).
- From Material: → MaterialLots → (same as MaterialLot).
- The API accepts a `maxDepth` parameter (default: unlimited; configurable for performance).

**Recommendation: yes (full chain, configurable depth).** **Please confirm D2.**

### 3.3 Backward-trace scope and hops (D3)

**Question:** From a DeviceLot, how far back does the trace go?

**Proposed resolution (D3):** **Full chain back to Product.**
- From DeviceLot: → Batch → WorkOrder → ProductRevision → Product → BOM → BOMLines → Materials.
- From DeviceLot: → Batch → MaterialConsumptions → MaterialLots → Materials → Suppliers.
- From DeviceLot: → Batch → OperationExecutions → Operations → Routing.
- From DeviceLot: → TestResults → Samples (if any).
- From DeviceLot: → Inspections (if any).
- From DeviceLot: → NCRs (if any, via polymorphic ref).
- From TestResult: → Sample → Batch → (full backward from Batch).
- From NCR: → concernsEntity (Batch/DeviceLot/MaterialLot) → (full backward from that entity).

**Recommendation: yes (full chain to Product).** **Please confirm D3.**

### 3.4 Impact analysis definition (D4 — CRITICAL)

**Question:** What does "impact analysis" mean? If a MaterialLot is recalled, what entities are "impacted"?

**Proposed resolution (D4):** **Impact = all downstream entities in the genealogy chain that directly or transitively depend on the starting entity.** An impact analysis:
1. Takes a starting entity (e.g., MaterialLot X) + a scenario type (RECALL, QUARANTINE, DEVIATION, AUDIT).
2. Computes the forward-trace (all Batches that consumed MaterialLot X, all DeviceLots from those Batches, all TestResults/Inspections/NCRs on those Batches/DeviceLots).
3. Returns a structured result: `{ scenario, startingEntity, affectedBatches, affectedDeviceLots, affectedTestResults, affectedInspections, affectedNCRs, affectedScraps, affectedReworks }`.
4. Does NOT automatically create any records (no auto-NCR, no auto-hold) — the impact analysis is informational; human action is required to act on it.
5. **AI must never act on impact analysis results** (no auto-release, no auto-hold; PRD §9).

**Recommendation: yes (forward-trace = impact; informational only; human action required).** **Please confirm D4.**

### 3.5 Customer/Project (D5)

**PRD evidence:** §10 genealogy starts with "Customer/Project → Product → ..."

**Question:** Does Phase 6 introduce Customer/Project entities to complete the genealogy chain prefix?

**Proposed resolution (D5):** **DEFER Customer/Project.** Phase 6 traces from Product onward (Product → Revision → BOM → ... → DeviceLot). Customer/Project linkage is a future phase (it was deferred in Phase 2 D8 and Phase 3 D11). The genealogy chain is complete from Product to DeviceLot + quality records. Customer/Project would extend the *prefix* of the chain but is not needed for the core traceability queries (backward from DeviceLot reaches Product; forward from MaterialLot reaches DeviceLot).

**Recommendation: defer (same as Phase 2 D8 / Phase 3 D11).** **Please confirm D5.**

### 3.6 Cross-site traceability (D6 — CRITICAL for site isolation)

**Question:** Can a traceability query cross site boundaries? E.g., if a MaterialLot at Site A was consumed by a Batch at Site A (same site — fine), but what if a DeviceLot is at Site B and the user is scoped to Site A?

**Proposed resolution (D6):** **Site-scoped queries.** A traceability query respects the user's `resolvedSites`:
- A user scoped to Site A can only trace genealogy for entities at Site A.
- If a forward-trace from a Site-A MaterialLot reaches a Batch at Site A → DeviceLot at Site A → all fine.
- If somehow an entity at Site B appears in the chain (shouldn't happen given cross-site consumption is rejected at the service layer), the trace STOPS at the site boundary and returns a `crossSiteBoundaryDetected` flag.
- Super Admin (global scope) can trace across all sites.
- **Cross-site traceability is NOT a leakage** — it's a read-only query that respects site scope. The query never returns entities the user isn't authorized to see; it simply stops at the boundary.

**Recommendation: yes (site-scoped; stop at boundary; super-admin global).** **Please confirm D6.**

### 3.7 Traceability query audit (D7)

**Question:** Should traceability queries be audited? (Who looked at what genealogy, when?)

**Proposed resolution (D7):** **Yes — a `TraceabilityQueryLog` entity records each query.** Fields: `actorUserId`, `queryType` (FORWARD_TRACE / BACKWARD_TRACE / IMPACT_ANALYSIS), `startEntityType`, `startEntityId`, `scenario?` (for impact analysis), `resultSummary` (Json: counts of affected entities by type), `siteId?`, `ipAddress?`, `createdAt`. This is a regulatory expectation (who investigated genealogy and when). Append-only (same as AuditEvent). Readable by `audit.read` permission.

**Recommendation: yes (TraceabilityQueryLog entity, append-only, auditable).** **Please confirm D7.**

### 3.8 AI governance (D8)

**Proposed resolution (D8):** AI may:
- Read traceability query results (with `traceability.read` permission).
- Summarize genealogy ("DeviceLot DL-001 was produced from Batch BATCH-001, which consumed MaterialLots LOT-A and LOT-B").
- Suggest impact analysis hypotheses ("if MaterialLot LOT-A is recalled, 3 DeviceLots may be affected").
- Highlight unusual patterns (e.g., a MaterialLot consumed across many batches).

AI must NOT:
- Automatically act on impact analysis (no auto-hold, no auto-release, no auto-NCR).
- Override site scope.
- Modify any production/quality records based on traceability results.
- Bypass human authorization for any action resulting from traceability.

**Recommendation: yes (AI read-only + suggest; no action).** **Please confirm D8.**

### 3.9 Summary of proposed domain decisions

| # | Decision | Proposed | Recommendation |
|---|---|---|---|
| D1 | Query layer vs new entities | Pure query layer + TraceabilityQueryLog (no TraceabilityRecord/Snapshot) | **Confirm** |
| D2 | Forward-trace scope | Full chain, configurable depth (MaterialLot → ... → DeviceLots → Quality records) | **Confirm** |
| D3 | Backward-trace scope | Full chain to Product (DeviceLot → Batch → WorkOrder → Revision → Product → BOM → Materials) | **Confirm** |
| D4 | Impact analysis definition | Forward-trace = impact; informational only; no auto-action; human action required | **Confirm** |
| D5 | Customer/Project | DEFER (same as Phase 2 D8 / Phase 3 D11; trace starts at Product) | **Confirm** |
| D6 | Cross-site traceability | Site-scoped queries; stop at boundary; super-admin global | **Confirm** |
| D7 | Traceability query audit | TraceabilityQueryLog entity (append-only, who/what/when) | **Confirm** |
| D8 | AI governance | AI read-only + suggest; no auto-action on impact results | **Confirm** |

**If any of D1–D8 is not confirmed, the implementation cannot proceed.** I will NOT implement until these are resolved.

---

## 4. Database schema (proposed, pending §3 confirmation)

Minimal — only one new entity (TraceabilityQueryLog). No changes to existing models.

```prisma
model TraceabilityQueryLog {
  id              String   @id @default(cuid())
  actorUserId     String?
  queryType       String   // FORWARD_TRACE | BACKWARD_TRACE | IMPACT_ANALYSIS
  startEntityType String   // MATERIAL_LOT | BATCH | DEVICE_LOT | WORK_ORDER | PRODUCT | PRODUCT_REVISION | MATERIAL | TEST_RESULT | INSPECTION | NCR
  startEntityId   String
  scenario        String?  // RECALL | QUARANTINE | DEVIATION | AUDIT (for impact analysis)
  resultSummary   Json?    // { affectedBatches: N, affectedDeviceLots: N, ... }
  siteId          String?  // the site scope of the query (null if global)
  ipAddress       String?
  createdAt       DateTime @default(now())

  actor User? @relation("TraceabilityQueryActor", fields: [actorUserId], references: [id], onDelete: SetNull)
  site  Site? @relation(fields: [siteId], references: [id], onDelete: SetNull)

  @@index([actorUserId])
  @@index([startEntityType, startEntityId])
  @@index([createdAt])
}
```

**Relation additions:** `User` gets `traceabilityQueriesLogged TraceabilityQueryLog[] @relation("TraceabilityQueryActor")`. `Site` gets `traceabilityQueries TraceabilityQueryLog[]`.

---

## 5. API design

New permission module `traceability.*`.

```
# Forward trace (from a starting entity, trace downstream)
POST   /api/traceability/forward-trace         { startEntityType, startEntityId, maxDepth? }
      → { startEntity, affectedBatches, affectedDeviceLots, affectedTestResults, affectedInspections, affectedNCRs, affectedScraps, affectedReworks }

# Backward trace (from a terminal entity, trace upstream)
POST   /api/traceability/backward-trace        { startEntityType, startEntityId }
      → { startEntity, product, productRevision, bom, workOrder, batch, materialLots, materials, suppliers, operations, testResults, inspections, ncrs }

# Impact analysis (forward trace + scenario)
POST   /api/traceability/impact-analysis       { startEntityType, startEntityId, scenario, maxDepth? }
      → { scenario, startEntity, affectedBatches, affectedDeviceLots, affectedTestResults, affectedInspections, affectedNCRs, affectedScraps, affectedReworks }

# Genealogy tree (full visualization)
GET    /api/traceability/genealogy/:entityType/:entityId
      → { tree: { entity, children: [...] } }  (nested tree structure for UI rendering)

# Traceability query log (audit)
GET    /api/traceability/query-log             (list of past traceability queries; audit.read perm)
```

**All queries are POST** (not GET) because they take a body with startEntityType/startEntityId + options. **All queries are site-scoped** (the service checks `assertSiteAccess` on the starting entity). **All queries are audited** (a TraceabilityQueryLog is created for each query).

---

## 6. UI architecture

New pages under `[locale]/(app)/traceability/`:
- `trace/` — a search form (select entity type + enter code/ID) + a genealogy tree visualization (nested cards or a D3/tree view).
- `impact/` — an impact analysis form (select entity + scenario) + a results summary (affected entity counts + lists).
- `query-log/` — a table of past traceability queries (actor, type, start entity, timestamp).

**Nav:** add "Traceability" group to sidebar (Genealogy Trace, Impact Analysis, Query Log), permission-gated.

**i18n:** extend catalogs with `traceability.*` keys (FR/EN/AR). RTL-safe.

**Demo seed:** no new demo data needed (uses existing Phase 2-5 demo data). The TraceabilityQueryLog is populated by actual queries.

---

## 7. Security & audit

- **Permissions:** `traceability.read` (read/query genealogy), `traceability.forward-trace`, `traceability.backward-trace`, `traceability.impact-analysis`, `traceability.query-log.read`. Least-privilege: all production/quality roles get `traceability.read` + trace perms; Auditor gets `traceability.query-log.read`; Operator gets `traceability.read` only (no impact analysis); Executive Viewer gets `traceability.read`.
- **3-layer enforcement** (reuse Phase 1).
- **AI governance (PRD §9):** AI gets `traceability.read` only; no `impact-analysis` action perm (AI may read results but not trigger impact analysis or act on results).
- **Audit:** every query creates a TraceabilityQueryLog (append-only, like AuditEvent). Readable by `traceability.query-log.read` / `audit.read`.
- **Site isolation:** queries are site-scoped (D6); cross-site entities not returned.

---

## 8. Multi-site (site scope)

- Traceability queries respect the user's `resolvedSites`.
- The starting entity must be at a site the user is authorized for (`assertSiteAccess`).
- If the genealogy chain reaches an entity at a different site (shouldn't happen given cross-site consumption is rejected), the trace stops and returns a `crossSiteBoundaryDetected` flag.
- Super Admin (global) can trace across all sites.

---

## 9. Testing

Reuse Phase 1-5 test infrastructure. New critical tests:
- **T-TRACE-01:** Genealogy integrity — the data chain is complete (Product→Revision→BOM→Material→MaterialLot→Consumption→Batch→DeviceLot→TestResult/Inspection/NCR). Verify all links exist.
- **T-TRACE-02:** Forward-trace from MaterialLot → affected Batches/DeviceLots.
- **T-TRACE-03:** Backward-trace from DeviceLot → MaterialLots/WorkOrder/ProductRevision.
- **T-TRACE-04:** Impact analysis (RECALL scenario) → correct affected entity set.
- **T-TRACE-05:** Impact analysis does NOT auto-create records (informational only).
- **T-ISOL-06:** Cross-site traceability isolation (Site-A user cannot trace Site-B genealogy).
- **T-TRACE-06:** Traceability query log created for each query (audit).
- **T-AI-GUARD-03:** AI governance (AI gets read-only; no impact-analysis action).
- **T-TRACE-07:** Full chain queryable (backward from DeviceLot reaches Product; forward from MaterialLot reaches DeviceLots + quality records).
- **Regression:** all 181 Phase 1-5 tests still pass.

---

## 10. Migration strategy

- **Schema:** additive migration (`phase6_traceability`) — only the `TraceabilityQueryLog` model + relation arrays on User/Site.
- **No data migration** — Phase 6 queries existing Phase 2-5 data.
- **PG-portable:** no SQLite-only types.
- **No data loss.**

---

## 11. Matt Pocock skills to use

| Activity | Skill |
|---|---|
| Resolve D1-D8 ambiguities | `grill-with-docs` |
| Design the traceability module seams | `codebase-design` (query layer; deep modules) |
| Turn this plan into a spec | `to-spec` |
| Break into tickets | `to-tickets` |
| Implement (after approval) | `tdd` + `implement` |
| Debug genealogy traversal logic | `diagnosing-bugs` |
| Phase gate quality | `code-review` |

---

## 12. Files / modules to change (after approval)

**New:**
- `src/modules/traceability/{domain,service}/index.ts` (genealogy traversal logic + impact analysis)
- `src/app/api/traceability/**` (route handlers)
- `src/app/[locale]/(app)/traceability/{trace,impact,query-log}/page.tsx`
- `prisma/migrations/<ts>_phase6_traceability/migration.sql`
- `docs/adr/0014-traceability-query-layer-vs-snapshot.md` (D1)
- `docs/adr/0015-traceability-site-scoping.md` (D6)
- `docs/api/traceability.md`
- `.scratch/phase-6/{spec.md,issues/NN-*.md}`

**Modified:** `prisma/schema.prisma` (TraceabilityQueryLog + User/Site relations), `src/lib/permissions.ts` (traceability.* permissions), `src/components/app/app-sidebar.tsx` (Traceability nav), `src/messages/{en,fr,ar}.json` (traceability.* keys), `CONTEXT.md` + `DOMAIN_GLOSSARY.md`.

---

## 13. Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| P6-R1 | D1-D8 unconfirmed → implementation blocked | H | Critical | this plan flags them; NO implementation until confirmed |
| P6-R2 | Genealogy traversal performance (deep queries) | M | Medium | configurable `maxDepth`; database indexes on all FK columns (already present); future caching |
| P6-R3 | Broken genealogy link (data integrity gap from prior phases) | L | Critical | T-TRACE-01 verifies chain integrity; if a link is broken, it's a Phase 2-5 regression to fix |
| P6-R4 | Cross-site leakage via traceability query | M | Critical | D6 site-scoped queries; T-ISOL-06 tests |
| P6-R5 | Impact analysis misinterpreted as automatic action | L | High | D4: informational only; no auto-action; tested T-TRACE-05 |
| P6-R6 | Polymorphic references (NCR/Inspection) not traversable | L | Medium | service resolves polymorphic refs (same pattern as Phase 4/5) |

---

## 14. Dependencies

- **No new runtime deps.** Reuses Phase 1-5 stack.
- **Phase 2-5 data required:** all genealogy relationships must exist (they do).

---

## 15. Acceptance criteria (definition of done)

1. TraceabilityQueryLog entity exists (after D1-D8 confirmation).
2. Forward-trace API works from MaterialLot/Material/Product/Revision/WorkOrder/Batch → downstream entities; tested T-TRACE-02.
3. Backward-trace API works from DeviceLot/Batch/TestResult/Inspection/NCR → upstream entities; tested T-TRACE-03.
4. Impact analysis API works (RECALL/QUARANTINE/DEVIATION/AUDIT scenarios); tested T-TRACE-04.
5. Impact analysis is informational only (no auto-action); tested T-TRACE-05.
6. Full chain queryable (backward to Product, forward to quality records); tested T-TRACE-07.
7. All queries site-scoped; cross-site isolation tested T-ISOL-06.
8. Every query creates a TraceabilityQueryLog (audit); tested T-TRACE-06.
9. RBAC: traceability.* permissions, 3-layer, least-privilege; AI governance tested T-AI-GUARD-03.
10. i18n: all UI strings from catalogs; FR/EN/AR; RTL-safe.
11. All Phase 1-5 tests still pass (181); new Phase 6 tests pass.
12. Lint 0 errors; typecheck clean.
13. Browser-verified: trace a DeviceLot backward to Product; impact analysis from a MaterialLot.
14. ADRs 0014-0015 written.
15. Phase 6 Validation Report produced; STOP; owner approval.

---

## 16. Open questions (require owner decision before implementation)

- **D1 — Query layer vs new entities:** confirm pure query layer + TraceabilityQueryLog (no TraceabilityRecord/Snapshot)? *(Recommendation: yes)*
- **D2 — Forward-trace scope:** confirm full chain, configurable depth? *(Recommendation: yes)*
- **D3 — Backward-trace scope:** confirm full chain to Product? *(Recommendation: yes)*
- **D4 — Impact analysis definition:** confirm forward-trace = impact; informational only; no auto-action; human action required? *(Recommendation: yes)*
- **D5 — Customer/Project:** confirm DEFER (trace starts at Product)? *(Recommendation: yes, defer)*
- **D6 — Cross-site traceability:** confirm site-scoped queries; stop at boundary; super-admin global? *(Recommendation: yes)*
- **D7 — Traceability query audit:** confirm TraceabilityQueryLog entity (append-only)? *(Recommendation: yes)*
- **D8 — AI governance:** confirm AI read-only + suggest; no auto-action on impact results? *(Recommendation: yes)*

---

```
PHASE 6 PLAN STATUS: WAITING FOR OWNER APPROVAL (and D1-D8 confirmation)
```

**I am stopping here.** I will not implement Phase 6, will not create Phase 6 tickets, and will not modify the schema until the owner approves this plan and confirms D1–D8. Awaiting your decisions.
