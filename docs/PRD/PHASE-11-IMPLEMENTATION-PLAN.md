# CIRCUM — PHASE 11 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 11 — Analytics / Reporting / Dashboards
> **Predecessor:** Phases 1-10 (all approved/closed). 67 models (63 Phase 1-9 + 4 Phase 10). 294/294 tests pass. Trusted Phase 10 computation layer available (`src/modules/lean/service`).
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only).
> **Source of truth:** Circum Master PRD §8 (Analytics), §7 (Lean/OEE/VSM source), §9 (AI governance), §14 (UI/UX), §18 (Phase 11), §19/§20 (Phase Gate / Validation Report).
> **Critical owner constraints (verbatim from approval):**
> - "Do not invent dashboards, KPIs, formulas, regulatory requirements, reports, export formats, user roles, permissions, analytics behavior, AI capabilities, business rules."
> - "Phase 11 must consume the trusted Phase 10 computation layer. Do not independently recreate OEE formulas in dashboard components."
> - "Trusted Manufacturing/Quality Data → Phase 10 Computation Services → Phase 11 Analytics APIs / Presentation → Dashboard / Reports / Visualization."
> - "The UI must not become a second source of truth for KPI calculations."
> - "Cross-site leakage remains a CRITICAL DEFECT."

---

## 0. Context: what Phase 11 covers

PRD §18 Phase 11: **"Analytics / reporting / dashboards."**

PRD §8 defines the exact scope. There are **two deliverable families**:

### 0.1 Dashboards (PRD §8 ¶1)
> "Dashboards: planned vs actual production, OEE, availability, performance, quality, downtime, reject rate, delivery performance, critical problems, overdue actions and bottlenecks."

### 0.2 Reports (PRD §8 ¶2)
> "Reports: shift, daily, weekly, monthly, OEE trends, quality trends, downtime Pareto, equipment performance, recurrence and action effectiveness."

### 0.3 What Phase 11 is — and is not

**Phase 11 IS:**
- A **read-only presentation and aggregation layer** over trusted Phase 1-10 data.
- A **consumer** of the Phase 10 computation services (`computeOee`, `computeLeanMetrics`, `evaluateVsm`) — it must **never** re-implement those formulas in a dashboard component.
- A set of **dashboard UI views**, **report views**, and **export endpoints**.
- New **`analytics.*` permissions** and audit entries for analytics access.
- Optional **append-only AnalyticsSnapshot** entities *only if* the owner approves snapshot-based trending (D1/D2).

**Phase 11 is NOT:**
- A second source of KPI truth. Every KPI displayed must trace to a Phase 10 computation result or a direct trusted-data aggregate.
- A mutation path for manufacturing, quality, or lean data. Phase 11 introduces **zero** write paths to controlled records.
- The AI Assistant (that is Phase 12). Phase 11 may expose the analytics surface that Phase 12 AI will consume, but must not ship an AI chatbot (D13).
- A re-implementation of traceability (Phase 6), genealogy, or impact analysis.

### 0.4 The non-negotiable data-flow seam (codebase-design)

Per the owner's architectural rule, the seam is fixed:

```
┌─────────────────────────────────────────────────────────────┐
│  TRUSTED DATA (Phase 1-9) + DowntimeEvent/VSM (Phase 10)     │
│  WorkOrder, ManufacturingBatch, OperationExecution,          │
│  ProductionScrap, ProductionRework, Shift, Equipment,        │
│  NCR, Deviation, CAPA, ChangeControl, TestResult, ...        │
└──────────────────────────────────┬──────────────────────────┘
                                   │  (no UI writes back here)
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 10 COMPUTATION SERVICES  (src/modules/lean/service)   │
│  computeOee()  →  OeeResult                                  │
│  computeLeanMetrics()  →  LeanMetricsResult                  │
│  evaluateVsm()  →  VsmEvaluation                             │
└──────────────────────────────────┬──────────────────────────┘
                                   │  (pure functions, audited)
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE 11 ANALYTICS APIs  (src/modules/analytics/service)    │
│  Aggregation, bucketing, trend assembly, corporate rollup.   │
│  Calls Phase 10 services; NEVER re-derives OEE.              │
└──────────────────────────────────┬──────────────────────────┘
                                   │  (ok()/fail() envelope)
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD / REPORTS / EXPORT UI                             │
│  KPI cards, charts, tables, timelines, Pareto, VSM graph.    │
│  Renders API results. NEVER recomputes a KPI client-side.    │
└─────────────────────────────────────────────────────────────┘
```

This is a **deep module** decision (codebase-design): the analytics service interface is small (`getDashboard(...)`, `getReport(...)`, `getTrend(...)`, `exportReport(...)`), but its implementation composes Phase 10 computations + trusted-data aggregates + site-scoped filtering + caching. Callers (API routes, UI) cross the same seam and get leverage without touching the computation internals.

---

## 1. Objectives

1. **Production dashboard** — planned vs actual production (WorkOrder.plannedQuantity vs ManufacturingBatch.actualQuantity), by site / date range.
2. **OEE dashboard** — consume `computeOee()`; display availability / performance / quality / OEE + the documented source breakdown + warnings. No client-side formula.
3. **Quality dashboard** — reject rate (scrap + rework / total), FPY, open NCR/Deviation/CAPA counts, TestResult pass/fail counts. Sourced from Phase 4-5 entities.
4. **Downtime dashboard** — consume `computeLeanMetrics().paretoDowntime`; Pareto chart by category. Sourced from DowntimeEvent.
5. **Bottleneck dashboard** — consume `computeLeanMetrics().bottlenecks`; ranked list. Sourced from Phase 10.
6. **Critical-problems dashboard** (D4) — open NCR/Deviation/CAPA at high severity/risk. Definition requires owner decision.
7. **Overdue-actions dashboard** (D5) — CAPA / Change Control / Training / Calibration / Maintenance items past due. Definition requires owner decision.
8. **Delivery-performance dashboard** (D3) — **OWNER DECISION REQUIRED**: no shipment/delivery entity exists in Phase 1-10. Either return `null` + warning (like takt time) or defer the dashboard to a future phase that adds shipment tracking. **Cannot be invented.**
9. **Time-bucketed reports** — shift / daily / weekly / monthly. Aggregation over trusted data + Phase 10 computation per bucket.
10. **Trend reports** — OEE trend, quality trend. Per-bucket re-computation OR snapshot series (D1/D2).
11. **Downtime-Pareto report** — consume `paretoDowntime` over a range.
12. **Equipment-performance report** — per-equipment OEE + utilization, sourced from `computeOee` per equipment + Equipment/OperationExecution.
13. **Recurrence report** (D6) — NCR/Deviation recurrence by subject/category over time. Algorithm requires owner decision.
14. **Action-effectiveness report** (D6) — CAPA effectiveness-verification outcomes. Sourced from CAPA EFFECTIVENESS state.
15. **VSM visualization** — render VsmNode/VsmEdge (Phase 10) as a graph. Read-only.
16. **Corporate-level aggregation** (D7) — explicitly authorized cross-site rollup. Never bypasses site isolation.
17. **Export** (D9) — CSV minimum (reuse the audit CSV pattern). PDF/Excel owner decision.
18. **Full RBAC + audit + multi-site + AI governance** — reuse Phase 1-10 infrastructure.

**Out of scope:** AI Assistant chat (Phase 12), integrations (Phase 13), new manufacturing/quality/lean entities, new computation formulas, customer/shipment entities, any mutation of controlled records.

---

## 2. Requirements (PRD traceability)

| # | Requirement (PRD §8) | Phase 11 coverage | Trusted source | Owner decision |
|---|---|---|---|---|
| R1 | Dashboard: planned vs actual production | Production dashboard | WorkOrder.plannedQuantity, ManufacturingBatch.actualQuantity | — |
| R2 | Dashboard: OEE | OEE dashboard (consumes `computeOee`) | Phase 10 OeeResult | — |
| R3 | Dashboard: availability / performance / quality | OEE dashboard (components of OeeResult) | Phase 10 OeeResult.sources | — |
| R4 | Dashboard: downtime | Downtime dashboard (Pareto) | `computeLeanMetrics().paretoDowntime` | — |
| R5 | Dashboard: reject rate | Quality dashboard | ProductionScrap + ProductionRework + Batch.actualQuantity | — |
| R6 | Dashboard: delivery performance | Delivery dashboard | **No shipment source exists** | **D3 — OWNER DECISION** |
| R7 | Dashboard: critical problems | Critical-problems dashboard | NCR/Deviation/CAPA + severity/risk | **D4 — OWNER DECISION** |
| R8 | Dashboard: overdue actions | Overdue-actions dashboard | CAPA/ChangeControl/Training/Calibration/Maintenance due dates | **D5 — OWNER DECISION** |
| R9 | Dashboard: bottlenecks | Bottleneck dashboard | `computeLeanMetrics().bottlenecks` | — |
| R10 | Report: shift / daily / weekly / monthly | Time-bucketed reports | Trusted data + Phase 10 per bucket | D14 (timezone) |
| R11 | Report: OEE trends | OEE trend report | `computeOee` per bucket OR AnalyticsSnapshot | **D1/D2 — OWNER DECISION** |
| R12 | Report: quality trends | Quality trend report | Scrap/Rework/TestResult per bucket OR snapshot | **D1/D2 — OWNER DECISION** |
| R13 | Report: downtime Pareto | Downtime-Pareto report | `paretoDowntime` | — |
| R14 | Report: equipment performance | Equipment-performance report | `computeOee` per equipment + Equipment | — |
| R15 | Report: recurrence | Recurrence report | NCR/Deviation history | **D6 — OWNER DECISION** |
| R16 | Report: action effectiveness | Action-effectiveness report | CAPA EFFECTIVENESS state | **D6 — OWNER DECISION** |
| R17 | Built on trusted data (§7) | All dashboards/reports consume Phase 1-10 | — | — |
| R18 | UI must not be a second source of truth (owner rule) | No client-side KPI formulas | — | — |
| R19 | Phase Gate (§19) + Phase Validation Report (§20) | Full gate | — | — |
| R20 | PostgreSQL-portable (ADR-0002) | No SQLite-only types | — | — |
| R21 | Cross-site leakage = CRITICAL DEFECT | SiteScope on every aggregate; corporate rollup explicitly authorized | — | **D7 — OWNER DECISION** |

---

## 3. Domain model (grill-with-docs + domain-modeling)

### 3.1 Live computation vs snapshot trending (D1 — CRITICAL, OWNER DECISION REQUIRED)

**Question:** How do trend reports (OEE trend, quality trend) obtain time-series data?

**Analysis:**
- **Option A — On-demand per-bucket re-computation.** For each bucket (day/week/month) in the range, call `computeOee` / aggregate trusted data. No new entities. Preserves the single-source-of-truth principle exactly. Cost: an N-bucket trend triggers N computations; a 90-day daily OEE trend = 90 `computeOee` calls. Could be slow without caching.
- **Option B — Append-only AnalyticsSnapshot.** A periodic job (or on-demand "freeze") stores a computed OEE/quality snapshot per (site, equipment, bucket). Trend reports read snapshots. Cost: introduces a *second representation* of the metric (the snapshot), which can drift from live re-computation if the source data changes after the snapshot is taken. Must be clearly labelled "computed as of T, regenerable, never authoritative."

**Owner constraints in tension:**
- "The UI must not become a second source of truth" → favors Option A (no stored duplicate).
- "Performance considerations" + "Caching requirements" (planning requirements #18, #20) → favors Option B for long ranges.

**Proposed resolution (D1):** **Hybrid, Option A primary + Option B optional & clearly subordinate.**
- **Default:** on-demand per-bucket re-computation (Option A). This is the authoritative path; the UI always shows live computation.
- **Optional:** an append-only `AnalyticsSnapshot` entity (Option B) used **only** as a read-cache for long-range trends, with these non-negotiable controls:
  - Every snapshot row carries `computedAt`, `sourceHash` (sha256 of the inputs used), and `regenerable = true`.
  - The trend API accepts `?useSnapshots=true|false`. Default `false` (live). Snapshots are never silently substituted.
  - A snapshot is **never** an authoritative KPI; it is a cached computation. The UI labels snapshot-sourced values "cached (computed YYYY-MM-DD HH:MM)."
  - Snapshots are append-only (no UPDATE/DELETE); a regeneration creates a new row.
  - Snapshot creation is a privileged action (`analytics.snapshot.create`), audited.
- **No snapshot is ever used to override, replace, or back-fill a live computation.**

**Recommendation: hybrid (A primary + B optional cache).** **Please confirm D1.** If the owner prefers strict single-source, choose Option A only (no snapshot entity) and accept that long-range trends may be slower / capped by D15.

### 3.2 AnalyticsSnapshot entity (D2 — depends on D1)

**Only relevant if D1 approves Option B.** If D1 = Option A only, **skip this entity entirely** (no schema change).

**Proposed resolution (D2):**
- **AnalyticsSnapshot** — append-only cache of a computed metric at a point in time. Fields: `id`, `siteId`, `metricKey` (e.g., `oee`, `availability`, `quality`, `fpy`, `scrapRate`), `bucketStart` (DateTime), `bucketEnd` (DateTime), `bucketGranularity` (`HOUR`/`DAY`/`WEEK`/`MONTH`), `scope` (JSON: `{equipmentId?, workCenterId?, shiftId?}`), `value` (Decimal, nullable for null-metric cases), `sources` (JSON: the source breakdown), `warnings` (JSON), `computedAt`, `sourceHash`, `createdByUserId`. Site-owned. Append-only (no update/delete methods on the repository; DB trigger rejects UPDATE/DELETE like AuditEvent).
- **No** AnalyticsSnapshot for VSM (VSM already stores computed totals on `ValueStreamMap`; Phase 11 reads those directly).

**Recommendation: yes (only if D1 = hybrid).** **Please confirm D2.**

### 3.3 Delivery performance (D3 — CRITICAL, OWNER DECISION REQUIRED)

**Problem:** PRD §8 lists "delivery performance" as a dashboard. But Phase 1-10 has **no shipment, delivery, customer-order, or due-date-against-shipment entity**. The genealogy chain ends at "Final Disposition" (Batch Review → Disposition). There is no Customer entity (VSM "Customer" node is a placeholder, per Phase 10 plan §0).

**Cannot invent a shipment source.** Two honest options:

- **Option A (recommended):** Phase 11 implements the Delivery dashboard as a **stub that returns `null` + a documented warning** ("Delivery performance requires a shipment/delivery data source, not yet implemented in Phase 1-10; deferred to a future phase"). This mirrors the Phase 10 decision to return `taktTime = null`. The dashboard slot exists (so the UI matches PRD §8) but displays "Data source not yet available." No invented KPI.
- **Option B:** Defer the Delivery dashboard entirely to a future phase (e.g., a Phase 13 logistics/shipment module). The dashboard slot is omitted; documented as out-of-scope.

**Proposed resolution (D3):** **Option A — stub with null + warning, exactly like takt time.** The dashboard is present (PRD §8 lists it) but explicitly marked "awaiting data source." A future phase (with an approved domain decision introducing a Shipment/Delivery entity) will populate it. **No invention.**

**Recommendation: Option A.** **Please confirm D3.**

### 3.4 "Critical problems" definition (D4 — OWNER DECISION REQUIRED)

**Problem:** PRD §8 lists "critical problems" as a dashboard. "Critical" is ambiguous. Candidate definitions:
- (a) Open NCRs + Deviations + CAPAs where the linked RiskAssessment has `riskPriorityNumber >= X`.
- (b) Open NCRs + Deviations + CAPAs with a dedicated `priority` / `severity` field.
- (c) Open NCRs + Deviations + CAPAs at a specific status (e.g., CONTAINMENT / INVESTIGATION past a threshold age).

**Current schema reality:** Phase 4 entities (NCR, Deviation, CAPA) do **not** carry a dedicated `priority` field. RiskAssessment carries `severity` (1-5) × `probability` (1-5) = `riskPriorityNumber` (1-25). NCR/Deviation link polymorphically to production entities but not directly to RiskAssessment (RiskAssessment references a *subject*, which can be a DEVIATION).

**Proposed resolution (D4):** **Define "critical problem" as: any open (non-CLOSED/CANCELLED) NCR, Deviation, or CAPA that is the subject of an open RiskAssessment with `riskPriorityNumber >= 15` (severity × probability threshold).** The threshold (15) is a **configurable site parameter** (not hard-coded; stored as a Site setting or a constant in the analytics domain, owner to confirm the default). This reuses existing trusted fields; no new entity, no new `priority` field.

**Alternatives rejected:**
- Adding a `priority` field to NCR/Deviation/CAPA — rejected (invents a new field not in the PRD; would require a schema migration and a UI to set it).
- Pure age-based criticality — rejected (age is a proxy, not a severity signal; conflates "old" with "critical").

**Recommendation: RPN >= 15 (configurable threshold) on an open RiskAssessment whose subject is the open NCR/Deviation/CAPA.** **Please confirm D4 (including the default threshold value).**

### 3.5 "Overdue actions" definition (D5 — OWNER DECISION REQUIRED)

**Problem:** PRD §8 lists "overdue actions." "Action" is ambiguous. Candidate entity types with due-date semantics:
- **CAPA** — has an effectiveness-verification step; no explicit `dueDate` field in Phase 4 schema. Owner decision: does "overdue CAPA" mean (a) past an effectiveness-verification target, or (b) in IMPLEMENTATION/EFFECTIVENESS past an age threshold?
- **ChangeControl** — has an IMPLEMENTATION step; no explicit `dueDate`. Same ambiguity.
- **RequiredTraining** (Phase 7) — has `dueDate`? Need to verify the schema.
- **CalibrationRecord** (Phase 8) — has `calibrationDate` + `nextCalibrationDate` (calibration-expiry tracking exists; Phase 8 validation noted "calibration expiry not proactively monitored" as deferred to Phase 13).
- **MaintenanceRecord** (Phase 8) — has scheduled maintenance? Need to verify.
- **TrainingRecord** (Phase 7) — completion vs required-by.

**Current schema reality (to verify during implementation, not now):** The Phase 7/8 schemas may or may not carry explicit due dates. The Phase 8 validation report explicitly flagged "calibration expiry not proactively monitored by a background job (Phase 13)" — meaning the *data* exists (`nextCalibrationDate`) but no job alerts on it.

**Proposed resolution (D5):** **Phase 11 "overdue actions" = the union of:**
1. **CalibrationRecord** where `nextCalibrationDate < now()` and equipment is still `OPERATIONAL` (calibration overdue).
2. **MaintenanceRecord** where a scheduled `nextMaintenanceDate` (if the field exists) is past.
3. **RequiredTraining** where a `dueDate` (if the field exists) is past and the linked TrainingRecord is not COMPLETE.
4. **CAPA** in `IMPLEMENTATION` or `EFFECTIVENESS` state past an age threshold (configurable; default 30 days in IMPLEMENTATION, 90 days in EFFECTIVENESS) — **only if** the owner confirms no explicit `dueDate` exists; otherwise use the explicit `dueDate`.
5. **ChangeControl** in `IMPLEMENTATION` past an age threshold (configurable; default 60 days) — same caveat.

**This decision requires a schema audit** (to confirm which due-date fields actually exist) **before implementation.** The owner must confirm: (a) the entity set, (b) whether age-thresholds are acceptable where no explicit due date exists, (c) the default threshold values, and (d) whether thresholds are per-site configurable.

**Recommendation: union of (1)-(5) with configurable thresholds; age-thresholds only where no explicit due date exists.** **Please confirm D5.** Flag: implementation must NOT invent due-date fields; if a field doesn't exist, use age-threshold and label it "age-based (no explicit due date)."

### 3.6 Recurrence & action-effectiveness reports (D6 — OWNER DECISION REQUIRED)

**Problem:** PRD §8 lists "recurrence" and "action effectiveness" reports. Both require algorithm definitions.

**Recurrence:** "The same problem appearing again." Candidate definitions:
- (a) NCRs/Deviations sharing the same `entityType` + `entityId` subject over time.
- (b) NCRs/Deviations sharing the same `downtimeCategory`-equivalent (NCR has no category field; need to verify) or the same linked Product/Material.
- (c) NCRs/Deviations with textually similar `description` (fuzzy match) — **rejected** (fuzzy matching is non-deterministic; not validation-minded).

**Action effectiveness:** CAPA has an `EFFECTIVENESS` state with effectiveness-verification. The report shows: for CAPAs that reached CLOSED, whether the effectiveness verification PASSED/FAILED, and whether any subsequent NCR/Deviation recurred on the same subject (links recurrence back to CAPA).

**Proposed resolution (D6):**
- **Recurrence report:** group closed NCRs/Deviations by their polymorphic `(entityType, entityId)` subject and count occurrences over time. A subject with >1 NCR/Deviation in the range is a "recurrence." Deterministic, no fuzzy matching. Output: subject, occurrence count, dates, linked CAPAs.
- **Action-effectiveness report:** for each CLOSED CAPA, show: effectiveness-verification outcome (if the CAPA schema records it), and whether any NCR/Deviation recurred on the CAPA's source subject *after* the CAPA closed. Output: CAPA, closed date, effectiveness outcome, recurrence-since (yes/no + count).

**Owner must confirm:** (a) the recurrence grouping key (subject vs. product vs. material), (b) whether the CAPA schema records an effectiveness-verification outcome field (to verify during implementation), (c) the time window for "recurrence since CAPA closed" (default: 90 days, configurable).

**Recommendation: subject-based grouping for recurrence; CAPA-outcome + post-closure-recurrence for effectiveness.** **Please confirm D6.**

### 3.7 Corporate-level aggregation (D7 — CRITICAL, OWNER DECISION REQUIRED)

**Owner rule (verbatim):** "global dashboards must not bypass site isolation; corporate-level aggregation must be explicitly authorized. Cross-site leakage remains a CRITICAL DEFECT."

**Proposed resolution (D7):**
- **Site-scoped dashboards (default):** a user with `resolvedSites = Set<siteA>` sees analytics for siteA only. `SiteScope` filter applied to every aggregate query. This is the existing Phase 1-10 model, reused unchanged.
- **Corporate aggregation (explicit):** a new permission `analytics.corporate.read` authorizes a user to see **aggregated** metrics across multiple sites. Aggregation rules:
  - The corporate dashboard **sums / averages** per-site metrics. It does **not** expose site-identifying rows to an unauthorized user.
  - A super_admin (`resolvedSites = "*"`) sees per-site breakdowns (they are authorized for all sites).
  - A non-super_admin with `analytics.corporate.read` sees **only the aggregate** (total OEE, total scrap, etc.); per-site rows are **suppressed** unless the user is explicitly authorized for that site. This is the "Executive Viewer" pattern (PRD §3).
  - The corporate aggregation API **lists which sites contributed** to the aggregate (by count, not by identity) so the viewer knows the coverage, e.g., "Aggregate over 3 sites" — but does not name sites the viewer can't access.
  - Every corporate-aggregation call is audited (`analytics.corporate.read` with the site-set hash).
- **No corporate mutation.** Corporate aggregation is read-only. There is no "corporate write" path.

**Recommendation: site-scoped default + `analytics.corporate.read` for aggregate-only rollup; per-site rows suppressed for unauthorized sites.** **Please confirm D7.**

### 3.8 Caching strategy (D8 — OWNER DECISION REQUIRED)

**Problem:** Dashboards can be expensive (OEE over a month for a site). Caching is needed but must not become a stale second source.

**Proposed resolution (D8):**
- **In-memory cache (process-local, TTL-based).** No Redis (ADR-0002 defers infra; PRD §11 "Redis only where justified"). Cache key = hash of `(userId, permissionScope, siteId, dashboardType, params)`. TTL = 60 seconds (configurable). 
- **Cache is transparent and labeled.** Every cached response includes `cachedAt` and `cacheTtlMs`. The UI shows "cached (refreshing in Ns)" or a manual "Refresh" button.
- **Cache invalidation:** manual refresh always bypasses cache. No event-driven invalidation in Phase 11 (the data sources are controlled records; a 60s staleness is acceptable for analytics). 
- **No persistent cache** (that's the AnalyticsSnapshot in D2, which is a separate, explicitly-approved path).
- **Cache never serves a different user.** Cache key includes the user's site-scope hash; a site-scoped user never receives a super_admin's cached aggregate.

**Recommendation: in-memory, 60s TTL, per-user-scope key, transparent labeling, manual-refresh bypass.** **Please confirm D8 (including the TTL value).**

### 3.9 Export formats (D9 — OWNER DECISION REQUIRED)

**PRD §8 mentions "reports" but does not specify formats.** The audit module already has CSV export (tamper-evident, with row hashes).

**Proposed resolution (D9):**
- **CSV (minimum, mandatory):** every report exports CSV. Reuse the audit CSV pattern (sequential row number + sha256 row hash) for tamper-evidence.
- **PDF (owner decision):** a formatted PDF report (header, KPI table, chart images) is a nice-to-have but adds a dependency (e.g., the `pdf` skill / reportlab). Owner to confirm whether Phase 11 includes PDF or defers it.
- **Excel (owner decision):** same. Adds a dependency. Owner to confirm.

**Recommendation: CSV mandatory; PDF and Excel deferred unless owner explicitly requests.** **Please confirm D9.**

### 3.10 Mobile / responsive scope (D10 — OWNER DECISION REQUIRED)

**PRD §14:** "desktop-first with selected tablet/mobile workflows."

**Proposed resolution (D10):** Phase 11 dashboards/reports are **desktop-first, responsive** (Tailwind breakpoints; layouts collapse gracefully on tablet). No dedicated mobile-only dashboard views. The owner may designate specific KPI cards (e.g., "today's OEE") as mobile-optimized if desired.

**Recommendation: desktop-first responsive; no dedicated mobile views.** **Please confirm D10.**

### 3.11 Permissions — analytics module (D11 — OWNER DECISION REQUIRED)

**Proposed resolution (D11):** New permission module `analytics`:

| Key | Module | Description | AI? |
|---|---|---|---|
| `analytics.read` | analytics | Read dashboards & reports for authorized sites | **AI: yes** (read-only) |
| `analytics.export` | analytics | Export reports (CSV/PDF/Excel) | human-only |
| `analytics.corporate.read` | analytics | Read corporate-aggregated (cross-site) analytics | human-only (Executive Viewer / super_admin) |
| `analytics.snapshot.create` | analytics | Create an AnalyticsSnapshot (only if D1=D2 approved) | human-only |

**AI governance (D7 from Phase 10 + PRD §9):** AI receives `analytics.read` (and already has `lean.read`). AI must NOT: modify KPI source data, modify manufacturing/quality records, change OEE results, create snapshots, export, access corporate aggregation, or approve/release anything. AI may summarize/explain/highlight authorized analytics (advisory only). **The AI Assistant itself is Phase 12** — Phase 11 only defines the permission surface; no AI chatbot ships in Phase 11 (D13).

**Recommendation: 4 permissions as above; AI gets `analytics.read` only.** **Please confirm D11.**

### 3.12 Audit policy for analytics reads (D12 — OWNER DECISION REQUIRED)

**Problem:** Auditing every dashboard view is noisy (a manager refreshing OEE 20×/day). But corporate-aggregation and export are sensitive.

**Proposed resolution (D12):**
- **Routine dashboard/report reads:** NOT audited (volume; read-only; no controlled-record mutation). Consistent with Phase 1-10 (reads of manufacturing/quality data are not individually audited; only mutations + denials are).
- **Export actions:** AUDITED (`analytics.export` with the report type + site scope + row count). Exports produce a controlled artifact; auditable.
- **Corporate-aggregation access:** AUDITED (`analytics.corporate.read` with the site-set hash). Sensitive (cross-site visibility).
- **Snapshot creation:** AUDITED (`analytics.snapshot.create`).
- **Denials:** AUDITED (existing `authorization.denied` pattern).
- **AnalyticsSnapshot** itself is append-only (DB trigger, like AuditEvent).

**Recommendation: audit export + corporate + snapshot + denials; do not audit routine reads.** **Please confirm D12.**

### 3.13 AI integration boundary in Phase 11 (D13 — OWNER DECISION REQUIRED)

**Problem:** PRD §9 allows AI to assist with "KPI analysis, report drafting, recommendations." But the AI Assistant is Phase 12. Does Phase 11 ship any AI feature?

**Proposed resolution (D13):** **Phase 11 ships NO AI feature.** It only:
- Defines the `analytics.read` permission (which Phase 12 AI will use).
- Ensures every analytics API response is structured (KPI value + source breakdown + warnings) so a future Phase 12 AI can consume it deterministically.
- Does NOT include a chatbot, narrative generator, or any `z-ai-web-dev-sdk` call.

**Rationale:** The owner's rule "AI may summarize/explain/highlight" is a Phase 12 capability. Phase 11 is the presentation layer; AI consumes it later. Shipping AI in Phase 11 would expand scope into Phase 12.

**Recommendation: no AI feature in Phase 11; only the permission surface + structured API responses for Phase 12 consumption.** **Please confirm D13.**

### 3.14 Date-range & timezone handling (D14 — OWNER DECISION REQUIRED)

**Problem:** Reports are shift/daily/weekly/monthly. Sites are in CH/FR/TN (different timezones). The user/session timezone is `Africa/Lagos` (per environment). Shift boundaries are timezone-dependent.

**Proposed resolution (D14):**
- **Site timezone is authoritative for site-scoped dashboards/reports.** A Site carries a `timezone` field (to verify; if absent, add as a site setting — **owner decision**). All bucket boundaries (day start, shift start) use the site's timezone.
- **Corporate aggregation** uses UTC for cross-site bucketing (the only unambiguous common reference), with a note "aggregated in UTC; per-site buckets use site timezone."
- **User timezone** (`User.timezone`, default `Africa/Lagos`) is used only for display formatting, not for bucket computation.
- **Date-range presets:** `SHIFT`, `DAY`, `WEEK` (Mon-Sun, ISO 8601), `MONTH` (calendar month), `CUSTOM` (from/to). All presets resolve to concrete `fromDate`/`toDate` in the site timezone.

**Owner must confirm:** (a) whether Site carries a `timezone` field (schema audit needed); if not, whether to add it (minor migration) or default to a single CDMO timezone; (b) ISO Monday-start weeks vs Sunday-start; (c) the corporate UTC bucketing decision.

**Recommendation: site-timezone authoritative; UTC for corporate; ISO Mon-Sun weeks; add Site.timezone if absent.** **Please confirm D14.**

### 3.15 Max on-demand computation range (D15 — OWNER DECISION REQUIRED)

**Problem:** On-demand OEE over a 5-year range could be catastrophic. Need a cap.

**Proposed resolution (D15):** 
- **On-demand computation cap: 90 days** per request (configurable). Requests beyond 90 days require `?useSnapshots=true` (D1/D2) or return `400 ValidationError` with a message pointing to snapshots.
- **Trend reports** with >90-day ranges use snapshots (if D2 approved) or are capped at 90 days with a warning.
- **Corporate aggregation** uses the same cap.

**Recommendation: 90-day on-demand cap; longer ranges require snapshots (D2).** **Please confirm D15 (and the cap value).**

### 3.16 Summary of proposed domain decisions

| # | Decision | Proposed | Recommendation | Owner decision |
|---|---|---|---|---|
| D1 | Trend: live vs snapshot | Hybrid: live primary + optional append-only AnalyticsSnapshot cache | Confirm | **REQUIRED** |
| D2 | AnalyticsSnapshot entity | Append-only, site-owned, regenerable, never authoritative | Confirm (only if D1=hybrid) | **REQUIRED** |
| D3 | Delivery performance | Stub returning null + warning (no shipment source) | Confirm | **REQUIRED** |
| D4 | Critical problems | Open NCR/Deviation/CAPA subject of open RiskAssessment with RPN ≥ 15 (configurable) | Confirm | **REQUIRED** |
| D5 | Overdue actions | Union of calibration/maintenance/training/CAPA/change-control overdue; age-threshold where no dueDate | Confirm | **REQUIRED** |
| D6 | Recurrence & effectiveness | Subject-based grouping (recurrence); CAPA outcome + post-closure recurrence (effectiveness) | Confirm | **REQUIRED** |
| D7 | Corporate aggregation | `analytics.corporate.read`; aggregate-only; per-site rows suppressed for unauthorized | Confirm | **REQUIRED** |
| D8 | Caching | In-memory, 60s TTL, per-user-scope key, transparent, manual-refresh bypass | Confirm | **REQUIRED** |
| D9 | Export formats | CSV mandatory; PDF/Excel deferred unless owner requests | Confirm | **REQUIRED** |
| D10 | Mobile | Desktop-first responsive; no dedicated mobile views | Confirm | **REQUIRED** |
| D11 | Permissions | 4 perms: analytics.read / .export / .corporate.read / .snapshot.create; AI gets .read only | Confirm | **REQUIRED** |
| D12 | Audit policy | Audit export + corporate + snapshot + denials; not routine reads | Confirm | **REQUIRED** |
| D13 | AI in Phase 11 | None (permission surface + structured API only; AI chatbot is Phase 12) | Confirm | **REQUIRED** |
| D14 | Date/timezone | Site-timezone authoritative; UTC corporate; ISO Mon-Sun weeks; add Site.timezone if absent | Confirm | **REQUIRED** |
| D15 | On-demand range cap | 90-day cap; longer requires snapshots | Confirm | **REQUIRED** |

---

## 4. Database schema (proposed, pending D1/D2 confirmation)

**Phase 11 introduces AT MOST ONE new entity** (`AnalyticsSnapshot`), and only if D1=hybrid and D2=confirmed. If D1=Option A (live only), **Phase 11 introduces ZERO schema changes** (pure presentation layer over existing data + Phase 10 computation).

```prisma
// ONLY IF D1 = hybrid AND D2 = confirmed. Otherwise omit entirely.
model AnalyticsSnapshot {
  id                String   @id @default(cuid())
  siteId            String
  metricKey         String   // "oee" | "availability" | "performance" | "quality" | "fpy" | "scrapRate" | "reworkRate" | "mtbf" | "mttr"
  bucketStart       DateTime
  bucketEnd         DateTime
  bucketGranularity String   // "HOUR" | "DAY" | "WEEK" | "MONTH"
  scope             String   // JSON: { equipmentId?, workCenterId?, shiftId? }
  value             Decimal? // nullable for null-metric cases (e.g., zero denominator)
  sources           String   // JSON: the source breakdown (mirrors OeeResult.sources)
  warnings          String   // JSON array of warning strings
  computedAt        DateTime @default(now())
  sourceHash        String   // sha256 of the inputs used (regeneration key)
  createdByUserId   String?
  isDemo            Boolean  @default(false)
  createdAt         DateTime @default(now())
  // NOTE: no updatedAt — append-only. DB trigger rejects UPDATE/DELETE (ADR-0005 pattern).

  site Site @relation(fields: [siteId], references: [id], onDelete: Restrict)

  @@index([siteId, metricKey, bucketStart])
  @@index([metricKey, bucketStart])
  @@index([sourceHash])
}
// Relation additions: Site gets `analyticsSnapshots[]`.
```

**No other schema changes.** Phase 11 consumes existing entities: WorkOrder, ManufacturingBatch, OperationExecution, ProductionScrap, ProductionRework, Shift, Equipment, WorkCenter, NCR, Deviation, CAPA, ChangeControl, RiskAssessment, TestResult, Inspection, DowntimeEvent, ValueStreamMap, VsmNode, VsmEdge, CalibrationRecord, MaintenanceRecord, RequiredTraining, TrainingRecord.

**Migration note:** if `Site.timezone` does not exist (D14), a minor migration adds it (default `"Africa/Lagos"`, per environment). **Owner to confirm.**

---

## 5. API design

New permission module `analytics.*`. All routes are **read-only** (GET or POST-with-body for complex query params). All routes use the existing `ok()/fail()/parseOrThrow()` envelope and `requirePermission()` + `assertSiteAccess()`.

### 5.1 Dashboards

```
# Production dashboard (planned vs actual)
POST /api/analytics/dashboard/production
  { siteId, fromDate, toDate, workCenterId?, productId? }
  → { plannedTotal, actualTotal, variance, byDay: [{date, planned, actual}], sources, warnings }

# OEE dashboard (consumes Phase 10 computeOee; NO re-computation)
POST /api/analytics/dashboard/oee
  { siteId, fromDate, toDate, equipmentId?, workCenterId? }
  → { ...OeeResult, displayHint: "live" }   // passthrough of computeOee + display metadata

# Quality dashboard
POST /api/analytics/dashboard/quality
  { siteId, fromDate, toDate }
  → { rejectRate, fpy, openNcrs, openDeviations, openCapas, testPassCount, testFailCount, sources, warnings }

# Downtime dashboard (Pareto)
POST /api/analytics/dashboard/downtime
  { siteId, fromDate, toDate, equipmentId? }
  → { pareto: computeLeanMetrics().paretoDowntime, totalDowntimeMinutes, sources, warnings }

# Bottleneck dashboard
POST /api/analytics/dashboard/bottlenecks
  { siteId, fromDate, toDate }
  → { bottlenecks: computeLeanMetrics().bottlenecks, sources, warnings }

# Critical-problems dashboard (D4)
POST /api/analytics/dashboard/critical-problems
  { siteId }
  → { items: [{ type, id, code, rpn, riskAssessmentId, status, openedAt }], threshold, sources, warnings }

# Overdue-actions dashboard (D5)
POST /api/analytics/dashboard/overdue-actions
  { siteId }
  → { items: [{ type, id, code, dueDate|ageDays, isAgeBased }], sources, warnings }

# Delivery dashboard (D3 — stub)
POST /api/analytics/dashboard/delivery
  { siteId, fromDate, toDate }
  → { value: null, warning: "Delivery performance requires a shipment/delivery data source, not yet implemented (deferred)." }
```

### 5.2 Reports

```
# Time-bucketed reports
POST /api/analytics/reports/shift    { siteId, date, shiftId? } → { ...per-shift aggregates }
POST /api/analytics/reports/daily    { siteId, date }           → { ...per-day aggregates }
POST /api/analytics/reports/weekly   { siteId, weekStart }      → { ...per-week aggregates }
POST /api/analytics/reports/monthly  { siteId, monthStart }     → { ...per-month aggregates }

# Trend reports (D1: live per-bucket OR snapshot-backed)
POST /api/analytics/reports/oee-trend
  { siteId, fromDate, toDate, granularity, equipmentId?, useSnapshots? }
  → { buckets: [{ bucketStart, bucketEnd, oee, availability, performance, quality, source: "live"|"snapshot", cachedAt? }], warnings }

POST /api/analytics/reports/quality-trend
  { siteId, fromDate, toDate, granularity, useSnapshots? }
  → { buckets: [{ bucketStart, bucketEnd, rejectRate, fpy, scrapRate, reworkRate, source, cachedAt? }], warnings }

# Downtime Pareto report
POST /api/analytics/reports/downtime-pareto
  { siteId, fromDate, toDate } → { pareto: [...], cumulativePercent: [...] }

# Equipment-performance report
POST /api/analytics/reports/equipment-performance
  { siteId, fromDate, toDate } → { items: [{ equipmentId, code, oee, availability, performance, quality, runTimeMinutes, utilization }] }

# Recurrence report (D6)
POST /api/analytics/reports/recurrence
  { siteId, fromDate, toDate } → { items: [{ entityType, entityId, occurrences, dates, linkedCapas }] }

# Action-effectiveness report (D6)
POST /api/analytics/reports/action-effectiveness
  { siteId, fromDate, toDate } → { items: [{ capaId, capaCode, closedAt, effectivenessOutcome, recurrenceSinceClose }] }
```

### 5.3 VSM visualization

```
# VSM view data (Phase 10 entities, structured for graph rendering)
GET  /api/analytics/vsm/:id/view
  → { vsm: {...Phase 10 ValueStreamMap}, nodes: [...VsmNode], edges: [...VsmEdge], evaluation: VsmEvaluation }
```

### 5.4 Corporate aggregation (D7)

```
# Corporate summary (aggregate-only; per-site rows suppressed for unauthorized sites)
POST /api/analytics/corporate/summary
  { fromDate, toDate, metricKeys: ["oee","rejectRate",...] }
  → { aggregate: { oee, rejectRate, ... }, contributingSiteCount, note: "aggregate over N sites; per-site detail requires site authorization" }
# Requires analytics.corporate.read. Audited.
```

### 5.5 Export (D9)

```
# CSV export of any report (reuse audit CSV tamper-evident pattern)
POST /api/analytics/export
  { reportType, params, format: "csv" }
  → CSV body (text/csv) with row numbers + sha256 row hashes
# Requires analytics.export. Audited.
```

### 5.6 Snapshot management (only if D2 confirmed)

```
POST /api/analytics/snapshots          (create — privileged, audited)
GET  /api/analytics/snapshots          (list — analytics.read)
```

---

## 6. UI architecture

Pages under `[locale]/(app)/analytics/`:

```
analytics/
├── dashboards/
│   ├── page.tsx                    (overview: KPI cards grid)
│   ├── production/page.tsx         (planned vs actual: bar chart + table)
│   ├── oee/page.tsx                (OEE: gauge + source breakdown + warnings)
│   ├── quality/page.tsx            (reject rate, FPY, open QMS counts)
│   ├── downtime/page.tsx           (Pareto chart)
│   ├── bottlenecks/page.tsx        (ranked list)
│   ├── critical-problems/page.tsx  (D4: list)
│   ├── overdue-actions/page.tsx    (D5: list)
│   └── delivery/page.tsx           (D3: stub — "data source not yet available")
├── reports/
│   ├── shift/page.tsx
│   ├── daily/page.tsx
│   ├── weekly/page.tsx
│   ├── monthly/page.tsx
│   ├── oee-trend/page.tsx          (line chart, multi-series: oee/avail/perf/quality)
│   ├── quality-trend/page.tsx
│   ├── downtime-pareto/page.tsx
│   ├── equipment-performance/page.tsx
│   ├── recurrence/page.tsx
│   └── action-effectiveness/page.tsx
├── vsm/[id]/page.tsx               (VSM graph visualization — read-only)
└── corporate/page.tsx              (D7: corporate summary — analytics.corporate.read)
```

**Nav:** add "Analytics" group to the sidebar (Dashboards, Reports, VSM, Corporate if authorized).

**Components (reuse shadcn/ui):**
- `KpiCard` — value + label + delta + source tooltip.
- `TrendChart` — line chart (recharts or existing chart lib; verify what's installed).
- `ParetoChart` — bar + cumulative line.
- `Gauge` — for OEE percentage.
- `DataTable` — for report rows (reuse existing table component).
- `VsmGraph` — node/edge renderer (simple left-to-right sequential layout; owner may upgrade to interactive graph in a future phase).
- `DateRangePreset` — SHIFT/DAY/WEEK/MONTH/CUSTOM selector.
- `WarningBanner` — displays `warnings[]` from every analytics response (critical for the "don't mistake incomplete data for authoritative" requirement).
- `CachedBadge` — shows `cachedAt` + TTL when a response is cache-served; "Refresh" button.

**Sticky footer rule (host UI rule):** the app shell already implements `min-h-screen flex flex-col` + `mt-auto` footer; Phase 11 pages inherit this.

**i18n:** FR/EN/AR + RTL for all new strings.

**Accessibility:** semantic `main`/`section`/`article`, ARIA labels on charts (every chart has a `aria-label` summarizing its data in text), keyboard-navigable tables, `sr-only` text for chart data.

---

## 7. Testing

**Target: ~35-45 new tests** (exact count after ticket decomposition). All 294 Phase 1-10 tests must continue to pass.

### 7.1 Unit / domain
- **T-ANALYTICS-01:** Dashboard API returns the Phase 10 `OeeResult` unchanged (passthrough; no re-computation).
- **T-ANALYTICS-02:** Quality dashboard reject rate = (scrap + rework) / total, sourced from Phase 4-5 entities.
- **T-ANALYTICS-03:** Production dashboard planned vs actual from WorkOrder + ManufacturingBatch.
- **T-ANALYTICS-04:** Trend report buckets: each bucket calls `computeOee` with that bucket's range (live path).
- **T-ANALYTICS-05:** Zero-denominator → null (no NaN/Infinity) in every dashboard.
- **T-ANALYTICS-06:** Warnings propagated to every response.

### 7.2 Domain decisions
- **T-CRIT-01:** Critical-problems dashboard returns only open NCR/Deviation/CAPA with open RiskAssessment RPN ≥ threshold (D4).
- **T-OVERDUE-01:** Overdue-actions dashboard returns the correct union (D5); age-based items labeled `isAgeBased`.
- **T-RECURRENCE-01:** Recurrence groups by subject; >1 occurrence = recurrence (D6).
- **T-EFFECTIVENESS-01:** Action-effectiveness links CAPA outcome + post-closure recurrence (D6).
- **T-DELIVERY-01:** Delivery dashboard returns null + the documented warning (D3).

### 7.3 Site isolation (CRITICAL)
- **T-ISOL-11:** A site-scoped user receives zero rows from other sites on every dashboard/report/corporate endpoint.
- **T-ISOL-11b:** Corporate aggregation suppresses per-site rows for unauthorized sites; only the aggregate + count is returned.
- **T-ISOL-11c:** Cache key includes user-scope hash; a site-scoped user never receives a super_admin's cached aggregate.

### 7.4 AI governance
- **T-AI-GUARD-08:** AI principal with `analytics.read` can read dashboards; cannot export, cannot access corporate, cannot create snapshots, cannot mutate anything.

### 7.5 Audit
- **T-AUDIT-11:** Export actions audited; corporate-access audited; snapshot-create audited; routine reads NOT audited.
- **T-SNAPSHOT-IMMUT-01** (only if D2): AnalyticsSnapshot is append-only (UPDATE/DELETE rejected).

### 7.6 Caching
- **T-CACHE-01:** Second identical request within TTL served from cache; `cachedAt` set.
- **T-CACHE-02:** Manual refresh bypasses cache.
- **T-CACHE-03:** Cache key isolation (different users → different cache entries).

### 7.7 Regression
- **All 294 Phase 1-10 tests must pass unchanged.** Phase 11 adds no schema changes (unless D2), so no migration risk.

---

## 8. The 28 planning requirements (explicit checklist)

| # | Requirement | Phase 11 coverage |
|---|---|---|
| 1 | Phase 11 objectives | §1 (18 objectives) |
| 2 | Existing Phase 1-10 capabilities Phase 11 consumes | §0.4, §3 (WorkOrder, Batch, OperationExecution, Scrap, Rework, Shift, Equipment, NCR, Deviation, CAPA, ChangeControl, RiskAssessment, TestResult, DowntimeEvent, VSM, CalibrationRecord, MaintenanceRecord, RequiredTraining, TrainingRecord + Phase 10 `computeOee`/`computeLeanMetrics`/`evaluateVsm`) |
| 3 | Dashboard/reporting boundaries | §0.3 (read-only presentation; no mutation; UI is not a second source of truth) |
| 4 | Required APIs | §5 (5 dashboard endpoints, 10 report endpoints, VSM view, corporate summary, export, snapshot mgmt) |
| 5 | Required UI views | §6 (9 dashboard pages, 10 report pages, VSM view, corporate page) |
| 6 | Analytics models | §3, §4 (AnalyticsSnapshot only if D1/D2; otherwise pure computation) |
| 7 | KPI definitions | §3 + Phase 10 validation report §3 (every KPI traces to a documented formula + authoritative source; no invention) |
| 8 | OEE visualization | §5.1 OEE dashboard (passthrough of `OeeResult`; gauge + source breakdown + warnings) |
| 9 | Lean metric visualization | §5.1 Downtime/Bottleneck dashboards (consume `computeLeanMetrics`) |
| 10 | VSM visualization | §5.3, §6 VSM view (read-only graph of Phase 10 VsmNode/VsmEdge) |
| 11 | Downtime/Pareto visualization | §5.1 Downtime dashboard, §5.2 downtime-pareto report (Pareto chart) |
| 12 | Bottleneck visualization | §5.1 Bottleneck dashboard (ranked list from `computeLeanMetrics().bottlenecks`) |
| 13 | Filtering and date-range behavior | §3.14 (D14: SHIFT/DAY/WEEK/MONTH/CUSTOM presets; site-timezone authoritative), §3.15 (D15: 90-day on-demand cap) |
| 14 | Site-level vs corporate-level analytics | §3.7 (D7: site-scoped default + `analytics.corporate.read` aggregate-only rollup) |
| 15 | RBAC/permissions | §3.11 (D11: 4 analytics perms; AI gets `.read` only) |
| 16 | AI integration boundaries | §3.13 (D13: no AI feature in Phase 11; permission surface + structured API for Phase 12) |
| 17 | Audit requirements | §3.12 (D12: audit export/corporate/snapshot/denials; not routine reads) |
| 18 | Performance considerations | §3.15 (D15: 90-day cap), §3.8 (D8: 60s in-memory cache), §3.1 (D1: optional snapshots for long ranges) |
| 19 | Data aggregation requirements | §5 (per-site, per-equipment, per-workcenter, per-shift, per-day/week/month buckets; corporate rollup) |
| 20 | Caching requirements | §3.8 (D8: in-memory, TTL, per-user-scope, transparent, manual-refresh) |
| 21 | Export/report requirements | §3.9 (D9: CSV mandatory; PDF/Excel owner decision), §5.5 (tamper-evident CSV) |
| 22 | Mobile/responsive requirements | §3.10 (D10: desktop-first responsive; no dedicated mobile views) |
| 23 | Security requirements | §3.7, §3.11, §3.12 (site isolation, RBAC, audit, no mutation paths, cache-key isolation) |
| 24 | Cross-site isolation | §3.7 (D7), §7.3 (T-ISOL-11/11b/11c); CRITICAL DEFECT if violated |
| 25 | Testing strategy | §7 (~35-45 new tests across unit/domain/isolation/AI-governance/audit/cache/regression) |
| 26 | Regression strategy | §7.7 (all 294 Phase 1-10 tests must pass; no schema change unless D2) |
| 27 | Technical-debt implications | §9 (lint debt must not grow net; no warning suppression; document any increase) |
| 28 | OWNER DECISION REQUIRED items | §3 (D1-D15, all 15 require owner confirmation) |

---

## 9. Technical-debt implications

- **Lint debt:** Phase 10 closed at **0 errors / 184 warnings**. Phase 11 must not increase the warning count net. Any new warning introduced must be either fixed or documented with a justification (not suppressed). Warning-suppression to improve the metric is **forbidden** (per owner rule). A warning representing security/correctness/data-integrity/architectural concern is a **real defect**, not debt.
- **PostgreSQL migration (ADR-0002):** remains the top production blocker. Phase 11 adds no SQLite-only types. `AnalyticsSnapshot` (if added) uses `Decimal` (Postgres-compatible) and JSON strings (not SQLite-specific).
- **`middleware.ts` → `proxy.ts` rename (Next 16):** pre-existing debt; not introduced by Phase 11; carry-forward.
- **Deferred UI work from earlier phases:** Phase 11 does not touch deferred state-transition buttons / detail-page tabs from Phases 1-10; those remain carry-forward.
- **Calibration-expiry monitoring job:** Phase 8 deferred the *proactive job* to Phase 13. Phase 11's overdue-actions dashboard (D5) reads `nextCalibrationDate` *on-demand* (no job needed); the Phase 13 job adds push alerts. No conflict.
- **Takt time = null (Phase 10):** remains. Phase 11 does not invent customer demand.
- **Delivery performance = null (D3):** a new "awaiting data source" gap, explicitly documented. A future phase (with an approved Shipment/Delivery entity decision) will populate it.
- **Bottleneck analysis simplification (Phase 10 §9):** Phase 11 consumes the simplified bottleneck output as-is; does **not** re-enhance the computation (that would be a Phase 10 scope change, requiring owner approval). Phase 11 only visualizes.

---

## 10. OWNER DECISION REQUIRED — summary

**All 15 domain decisions (D1-D15) require owner confirmation before implementation begins.** The most critical (blocking) are:

1. **D1 — Trend strategy** (live vs snapshot). Determines whether Phase 11 has any schema change at all.
2. **D3 — Delivery performance** (stub-with-null vs defer). Cannot be invented.
3. **D4 — Critical problems definition** (RPN threshold + default value).
4. **D5 — Overdue actions entity set + age thresholds** (requires schema audit of existing due-date fields).
5. **D7 — Corporate aggregation authorization** (aggregate-only vs per-site rows for Executive Viewer).
6. **D11 — Permission set** (4 perms; AI `.read` only).
7. **D13 — No AI feature in Phase 11** (scope boundary vs Phase 12).

The remaining (D2, D6, D8, D9, D10, D12, D14, D15) are important but lower-risk; defaults are proposed.

**Additional owner confirmations needed during implementation (not blocking the plan):**
- Schema audit: does `Site.timezone` exist? Does `CalibrationRecord.nextCalibrationDate` exist? Does `RequiredTraining.dueDate` exist? Does CAPA record an effectiveness-outcome field? (These determine whether D5/D6 use explicit dates or age-thresholds.)
- Default threshold values for D4 (RPN), D5 (age thresholds), D8 (cache TTL), D15 (range cap).

---

## 11. Critical analytics rule (restated)

Phase 11 must consume the trusted Phase 10 computation layer. **Do not independently recreate OEE formulas in dashboard components.**

```
Trusted Manufacturing/Quality Data
        ↓
Phase 10 Computation Services  (computeOee, computeLeanMetrics, evaluateVsm)
        ↓
Phase 11 Analytics APIs / Presentation
        ↓
Dashboard / Reports / Visualization
```

**The UI must not become a second source of truth for KPI calculations.** Every KPI rendered in a dashboard must trace, through the analytics API, to either (a) a Phase 10 computation result, or (b) a direct trusted-data aggregate. No client-side formula. No invented metric.

---

## 12. Site and corporate analytics (restated)

- **Site-scoped (default):** `SiteScope` filter on every aggregate; cross-site leakage = CRITICAL DEFECT.
- **Corporate (explicit):** `analytics.corporate.read`; aggregate-only; per-site rows suppressed for unauthorized sites; never bypasses isolation; audited.
- **Global dashboards must not bypass site isolation.** Corporate aggregation is a *summarization*, not a *visibility grant*.

---

## 13. AI analytics (restated)

Phase 11 ships **no AI feature** (D13). AI governance is preserved:
- AI gets `analytics.read` (and `lean.read`) — advisory only.
- AI must NOT: modify KPI source data, modify manufacturing/quality records, change OEE results, create snapshots, export, access corporate aggregation, approve/release anything.
- The AI Assistant (chatbot, narrative generation, RAG) is Phase 12. Phase 11 only ensures the analytics API responses are structured for Phase 12 consumption.

---

## 14. NO INVENTED REQUIREMENTS (restated)

Phase 11 does **not** invent: dashboards (only PRD §8 listed ones), KPIs (only documented formulas), formulas (only Phase 10's), regulatory requirements, reports (only PRD §8 listed ones), export formats (CSV mandatory; others owner decision), user roles, permissions (only the 4 in D11), analytics behavior, AI capabilities (none), business rules.

Where the PRD is ambiguous → **OWNER DECISION REQUIRED** (D1-D15). No silent interpretation.

---

## 15. PHASE 11 IMPLEMENTATION MUST NOT START

After this plan is produced:

**STOP.**

Do NOT:
- implement Phase 11 UI
- implement Phase 11 APIs
- create Phase 11 migrations (AnalyticsSnapshot or Site.timezone)
- create dashboard components
- modify analytics logic
- begin Phase 12

Wait for explicit owner approval of this plan **and** all 15 OWNER DECISION REQUIRED items (D1-D15).

---

## 16. Required workflow

The project workflow remains:

```
PLAN → OWNER REVIEW → APPROVAL → IMPLEMENT → TEST → SELF-REVIEW →
SECURITY REVIEW → FIX → FULL REGRESSION → VALIDATION REPORT →
STOP → OWNER APPROVAL
```

**Never advance automatically.** (CLAUDE.md: the host's standing 15-min `webDevReview` cron is superseded by Circum's "never advance automatically / wait for owner approval" rule, owner-approved Phase 0 Q5.)

---

```
PHASE 11 PLAN STATUS: WAITING FOR OWNER APPROVAL (and D1-D15 confirmation)
```

**I am stopping here.** Awaiting your approval and confirmation of D1-D15.
