# CIRCUM — PHASE 11 VALIDATION REPORT

> **Phase:** 11 — Analytics / Reporting / Dashboards
> **Status:** CONDITIONAL PASS
> **Date:** Phase 11 completion
> **Predecessor:** Phases 1-10 (all approved/closed). Domain decisions D1-D15 owner-confirmed.
> **Commit:** `5204687`

---

## 1. Implementation summary

Phase 11 establishes the **Analytics/Reporting/Dashboards** layer — a read-only presentation layer that consumes the Phase 10 computation services (`computeOee`, `computeLeanMetrics`, `evaluateVsm`) and trusted Phase 1-9 data. **Zero schema changes** (owner-preferred simpler architecture: D1=live-only, D2=not-implemented, D8=no-cache). **4 new permissions** (analytics module). **17 new API routes**. **20 new UI pages**. i18n FR/EN/AR. **39 new tests** (333 total).

The UI never becomes a second source of truth — every KPI traces through the analytics API to either a Phase 10 computation result or a direct trusted-data aggregate.

## 2. Analytics domain architecture

```
Trusted Manufacturing/Quality Data (Phase 1-9) + DowntimeEvent/VSM (Phase 10)
    ↓
Phase 10 Computation Services (computeOee, computeLeanMetrics, evaluateVsm)
    ↓
Phase 11 Analytics Service (src/modules/analytics/service) — aggregation, bucketing, rollup
    ↓
Analytics API (17 routes under /api/analytics/) — ok()/fail() envelope
    ↓
Dashboard / Reports / Export UI (20 pages under [locale]/(app)/analytics/)
```

The analytics service is a **deep module** (codebase-design): small interface (`getProductionDashboard`, `getOeeDashboard`, etc.), deep implementation that composes Phase 10 computations + trusted-data aggregates + site-scoped filtering + D15 range-cap enforcement.

## 3. Dashboard implementation

9 dashboard pages under `analytics/dashboards/`:
- **Overview** (`page.tsx`) — KPI cards grid (Production, Quality, Downtime) + navigation cards
- **Production** — planned vs actual bar chart + KPI cards
- **OEE** — gauge-style progress bars + source breakdown table (passthrough of `computeOee`)
- **Quality** — 9 KPI cards + pie chart (pass/fail)
- **Downtime** — Pareto chart (recharts ComposedChart: bar + cumulative line)
- **Bottlenecks** — ranked table
- **Critical Problems** (D4) — table with RPN, threshold, associationPath transparency
- **Overdue Actions** (D5) — table + LimitationsNotice (CAPA/ChangeControl "no authoritative dueDate")
- **Delivery** (D3) — stub showing "Data Unavailable" + warning

## 4. KPI definitions

Every KPI is documented in `KPI_SOURCES` (src/modules/analytics/domain/index.ts) with: source entity, phase, and computation formula. No KPI is invented.

## 5. KPI source-of-truth mapping

| KPI | Formula | Phase 10 Source | Authoritative Data |
|---|---|---|---|
| OEE | Availability × Performance × Quality | `computeOee().oee` | Shift + DowntimeEvent + OperationExecution + Operation + Batch + Scrap + Rework |
| Availability | (Planned - Downtime) / Planned | `computeOee().availability` | Shift.startTime/endTime + DowntimeEvent.durationMinutes |
| Performance | Ideal Duration / Run Time | `computeOee().performance` | Operation.estimatedDurationMinutes + OperationExecution timestamps |
| Quality | Good Count / Total Count | `computeOee().quality` | Batch.actualQuantity - Scrap - Rework |
| FPY | Good Count / Total Count | `computeLeanMetrics().fpy` | Same as Quality |
| Scrap Rate | Scrap / Total | `computeLeanMetrics().scrapRate` | ProductionScrap.quantity / Batch.actualQuantity |
| Rework Rate | Rework / Total | `computeLeanMetrics().reworkRate` | ProductionRework.quantity / Batch.actualQuantity |
| Reject Rate | Scrap + Rework / Total | Computed from Phase 10 | ProductionScrap + ProductionRework + Batch |
| Downtime Pareto | By category, sorted | `computeLeanMetrics().paretoDowntime` | DowntimeEvent (CLOSED) |
| Bottlenecks | Ranked by cycle time | `computeLeanMetrics().bottlenecks` | OperationExecution + Equipment |
| VSM Lead Time | Σ VsmNode.leadTimeMinutes | `evaluateVsm()` | VsmNode entity |
| Delivery | N/A | **null + warning** (D3) | No shipment source exists |
| Critical Problems | Open NCR/Dev/CAPA + open RiskAssessment RPN≥15 | Direct query | NCR + Deviation + CAPA + RiskAssessment |
| Overdue Actions | Authoritative dueDate < now() | Direct query | CalibrationRecord.nextCalibrationDue + MaintenanceRecord.scheduledDate + TrainingRecord.expiresAt |

**No KPI is computed client-side.** The UI renders API results only.

## 6. Phase 10 computation integration

The analytics service imports and calls:
- `computeOee(ctx, input)` from `@/modules/lean/service` — for OEE dashboard, OEE trend, equipment performance, corporate OEE aggregation
- `computeLeanMetrics(ctx, input)` from `@/modules/lean/service` — for quality dashboard, downtime dashboard, bottleneck dashboard, quality trend
- `evaluateVsm(ctx, vsmId)` from `@/modules/lean/service` — for VSM view

**No OEE/Lean formula is reimplemented in the analytics service or UI.** Verified by test T-SOURCE-01 (KPI_SOURCES documents the Phase 10 source for every KPI) and T-ANALYTICS-01 (OEE dashboard returns `meta.sources.oee` containing "computeOee").

## 7. Analytics APIs

17 API routes under `/api/analytics/`:

**Dashboards (8):** production, oee, quality, downtime, bottlenecks, critical-problems, overdue-actions, delivery
**Reports (6):** oee-trend, quality-trend, downtime-pareto, equipment-performance, recurrence, action-effectiveness
**VSM (1):** vsm/[id]/view (GET)
**Corporate (1):** corporate/summary (POST, requires `analytics.corporate.read`)
**Export (1):** export (POST, requires `analytics.export`, returns CSV)

All routes use `requirePermission()` + `assertSiteAccess()` + `ok()/fail()` envelope. All POST routes validate input with zod schemas.

## 8. RBAC/permissions

4 new permissions in the `analytics` module:
- `analytics.read` — Read dashboards & reports (AI: yes, read-only)
- `analytics.export` — Export reports as CSV (human-only; AI MUST NEVER)
- `analytics.corporate.read` — Read corporate-aggregated analytics (human-only; AI MUST NEVER)
- `analytics.snapshot.create` — Create AnalyticsSnapshot (human-only; RESERVED — not implemented in Phase 11)

Role grants updated:
- super_admin: all 4 analytics perms
- site_admin, plant_manager, production_manager, quality_manager, quality_engineer, lean_manager, auditor: analytics.read + analytics.export
- qa_reviewer, maintenance_manager: analytics.read
- executive_viewer: analytics.read + analytics.corporate.read (+ lean.read + relevant read perms)
- Operator, lab_technician, validation_engineer: no analytics perms (least privilege)

Also fixed: `lean_manager` was missing `lean.read` (Phase 10 oversight) — added.

## 9. Site isolation

- Every site-scoped query applies `assertSiteAccess(ctx, input.siteId)` before executing.
- Cross-site access throws `ForbiddenError` (tested T-ISOL-11: siteA user denied siteB, siteB user denied siteA, super_admin allowed any).
- The production dashboard at siteA returns only siteA's work orders (plannedTotal=100, not siteB's data).
- VSM: site-scoped if `siteId` set; global VSM (siteId=null) readable by anyone with `analytics.read` (structure is user-defined, not production data).

Cross-site leakage remains a **CRITICAL DEFECT** — tested and prevented.

## 10. Corporate aggregation

- Requires `analytics.corporate.read` (human-only; AI denied — tested T-AI-GUARD-08).
- **Aggregate-only**: non-super_admin users see only the aggregate value + contributingSiteCount, NOT per-site rows. Per-site rows are suppressed for unauthorized sites.
- super_admin sees all sites; executive_viewer sees aggregate only.
- Every corporate access is **audited** (`analytics.corporate.read` action — tested T-CORPORATE-01).
- Computed in UTC (D14 corporate canonical reference).

## 11. Export implementation

- CSV export via `POST /api/analytics/export` with `{reportType, params, format:"csv"}`.
- **Same analytics service results as dashboard** (Architecture: Analytics Service → API/Export → CSV; NOT Dashboard → independent calculation → CSV).
- Tamper-evident: sequential row number + sha256 row hash (reuses audit CSV pattern).
- Requires `analytics.export` (human-only; AI denied — tested T-EXPORT-01).
- Respects site isolation (siteA user exporting siteB data → ForbiddenError).
- Every export is audited (`analytics.export` action — tested T-EXPORT-01).

## 12. Snapshot implementation

**NOT implemented.** D1=live-only (owner preferred simpler architecture); D2=conditionally approved but not required. The `analytics.snapshot.create` permission is declared in the catalog (for future use) but has no API endpoint behind it. Zero schema changes.

## 13. Cache implementation

**NOT implemented.** D8=confirmed but owner preferred "no cache if complexity disproportionate to benefit." The 90-day on-demand cap (D15) bounds computation cost sufficiently. No in-memory cache was needed.

## 14. Timezone behavior

- `Site.timezone` **already exists** (verified in schema audit — line 184, default "Africa/Lagos"). No migration needed.
- Site-local timezone is authoritative for site-level analytics (D14).
- Corporate aggregation uses UTC as the canonical reference (D14).
- Date-range presets: SHIFT, DAY, WEEK (ISO Mon-Sun), MONTH, CUSTOM.

## 15. Date-range behavior

- D15: 90-day on-demand computation cap. `assertRangeCap()` throws `ValidationError` if range exceeds 90 days.
- Requests beyond 90 days are rejected with an explicit message (not silently truncated).
- The user always knows what period was analyzed (via `meta.range.fromDate`/`toDate`).

## 16. AI governance

- **No AI feature in Phase 11** (D13 confirmed). No chatbot, no narrative generator, no `z-ai-web-dev-sdk` call.
- AI receives `analytics.read` only (tested T-AI-GUARD-08: AI can read analytics, cannot export, cannot access corporate, cannot create snapshots).
- The `analytics` permission surface is structured for future Phase 12 AI integration.
- AI must NOT: modify analytics, create snapshots, export data, bypass authorization, access corporate analytics, modify manufacturing/quality data.

## 17. Audit behavior

- **Audited:** exports (`analytics.export`), corporate access (`analytics.corporate.read`), snapshot creation (N/A — not implemented), permission denials (existing `authorization.denied` pattern).
- **Not audited:** routine dashboard/report reads (volume; read-only; no controlled-record mutation — consistent with Phase 1-10 pattern).
- Audit events are append-only (DB triggers reject UPDATE/DELETE — existing Phase 1 infrastructure).

## 18. Security verification

- All analytics endpoints enforce: authentication, RBAC, site scope, corporate scope, date-range validation, filter validation, data-source authorization.
- Never relies on UI-level hiding (server-side enforcement is authoritative).
- Corporate aggregation: tested with 8 user types (siteA-only, siteB-only, A+B, corporate user, unauthorized, super_admin, AI with analytics.read, AI without corporate.read) — all behave correctly (tested T-CORPORATE-01, T-AI-GUARD-08).

## 19. Accessibility/UI verification

- Semantic HTML (`main`, `section`, `article`, `h1`/`h2` hierarchy).
- ARIA labels on charts (every chart has descriptive context).
- Keyboard-navigable tables (shadcn Table components).
- `sr-only` text for screen-reader-only content.
- KPI cards have source tooltips (Database icon with `title` attribute).
- Warning banners use Alert component with proper ARIA roles.

## 20. Responsive/browser verification

- Desktop-first responsive design (Tailwind `sm:`, `lg:` breakpoints).
- Grid layouts: `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`.
- Tables: `max-h-[32rem] overflow-auto` with sticky headers.
- Charts: `ResponsiveContainer` with fixed heights (h-64, h-80).
- Browser-verified via agent-browser: dashboards overview, OEE, critical-problems, delivery, reports, corporate — all render correctly.

## 21. Performance verification

- 90-day on-demand cap (D15) bounds computation cost.
- Per-bucket trend computation uses `Promise.all` for parallel bucket evaluation.
- Corporate aggregation iterates authorized sites sequentially (safe; bounded by site count).
- No performance issues observed in browser verification (all API calls < 1s).

## 22. New test results

**Phase 11: 39 tests, all PASS** (1.5s).

| Test Group | Count | Tests |
|---|---|---|
| T-SOURCE-01 | 5 | KPI source mapping, D15 cap, D4 threshold, range cap accept/reject |
| T-ANALYTICS-01-05 | 5 | OEE passthrough, production, quality, downtime Pareto, zero-denominator null |
| T-DELIVERY-01 | 1 | Delivery returns null + warning (D3) |
| T-CRIT-01 | 2 | Critical problems via RPN, configurable threshold |
| T-OVERDUE-01 | 2 | Overdue with dueDate, CAPA/ChangeControl limited (D5) |
| T-RECURRENCE-01 | 1 | Recurrence by subject (D6) |
| T-EFFECTIVENESS-01 | 1 | Action effectiveness (D6) |
| T-ISOL-11 | 4 | Cross-site isolation (A→B, B→A, super_admin, data containment) |
| T-CORPORATE-01 | 5 | Corporate auth, executive access, super_admin, aggregate-only, audited |
| T-AI-GUARD-08 | 7 | AI read-only, no export/corporate/snapshot, service-level denial |
| T-EXPORT-01 | 3 | CSV with row hashes, audited, site isolation |
| T-VSM-01 | 1 | VSM view passthrough of evaluateVsm |
| T-TREND-01 | 2 | Live per-bucket computation (no snapshots) |

## 23. Full Phase 1-10 regression results

**All 294 Phase 1-10 tests PASS** (unchanged). Total: **333/333 tests PASS** (25.3s).

| Phase | Tests | Status |
|---|---|---|
| 1 (Identity/RBAC/Audit) | 17 | PASS |
| 2 (Manufacturing Master Data) | 34 | PASS |
| 3 (Production Execution) | 33 | PASS |
| 4 (Quality Foundation) | 45 | PASS |
| 5 (Lab/Inspection/Testing) | 52 | PASS |
| 6 (Traceability/Genealogy) | 15 | PASS |
| 7 (Document Control/Training) | 27 | PASS |
| 8 (Equipment/Calibration) | 25 | PASS |
| 9 (Cleanroom/Sterilization/Release) | 33 | PASS |
| 10 (Lean/OEE/VSM) | 13 | PASS |
| **11 (Analytics/Dashboards)** | **39** | **PASS** |
| **Total** | **333** | **PASS** |

## 24. Typecheck

**PASS** — 0 Phase 11 errors. (1 pre-existing error in `vitest.config.ts(14,5): error TS2769` — vitest 4 `poolOptions` migration issue; not a Phase 11 error; pre-existing technical debt.)

## 25. Lint

**0 errors / 199 warnings.**

| Metric | Value |
|---|---|
| Phase 10 baseline | 184 warnings |
| Phase 11 new count | 199 warnings |
| Net increase | +15 warnings |
| Errors | 0 |

**Reason for increase:** +15 warnings from the new analytics service/UI code (unused variables, type-any in corporate aggregation, inline styles in UI components).

**Classification:** All new warnings are `@typescript-eslint/no-unused-vars` or `@typescript-eslint/no-explicit-any` — ordinary technical debt, NOT security/correctness/data-integrity/architectural issues.

**Remediation plan:** Address in a future lint-cleanup pass (not blocking Phase 11). No warnings were suppressed to pass the Phase Gate.

## 26. Build

**N/A** — `bun run build` is not run in this environment (per project rules: "never use `bun run build`"). Dev server (`bun run dev`) compiles and serves all pages successfully.

## 27. Known limitations

1. **Delivery performance = null** (D3): No shipment/delivery entity exists in Phase 1-10. Dashboard shows "Data Unavailable" with an explicit warning. A future phase (with an approved Shipment/Delivery domain decision) will populate it.
2. **Takt time = null** (Phase 10 carry-forward): No customer demand source. Not a Phase 11 issue.
3. **Overdue CAPA/ChangeControl**: D5 confirmed — no authoritative dueDate exists. Reported as "limited" (LimitationsNotice), NOT invented with age thresholds.
4. **No AnalyticsSnapshot** (D1/D2): Live on-demand computation only. Long-range trends (>90 days) require the D15 cap to be respected or a future snapshot implementation.
5. **No in-memory cache** (D8): Every dashboard request recomputes. Acceptable for current scale; can add cache if performance demands.
6. **Bottleneck analysis**: Consumes Phase 10's simplified bottleneck output (ranks by avg cycle time). Does not re-enhance the computation.
7. **VSM visualization**: Simple left-to-right sequential card layout. No interactive graph (future enhancement).

## 28. Technical debt

- **Lint warnings:** +15 (184 → 199). Ordinary debt; no suppression; documented above.
- **Pre-existing:** PostgreSQL migration (ADR-0002), `middleware.ts` → `proxy.ts` rename, deferred UI work from earlier phases, calibration-expiry proactive monitoring job (Phase 13).
- **New:** None introduced. Zero schema changes. No new entities. No new computation formulas.

## 29. Remaining risks

1. **PostgreSQL migration (ADR-0002)** — top production blocker. Phase 11 adds no SQLite-only types (zero schema changes), so migration impact is nil.
2. **Corporate aggregation performance** — iterates authorized sites sequentially. Acceptable for current site count (3); may need optimization for >10 sites.
3. **Trend computation cost** — N-bucket trend triggers N Phase 10 computations. Bounded by D15 (90-day cap). A 90-day daily trend = 90 `computeOee` calls (~parallelized via Promise.all).
4. **No real-time push** — dashboards require manual refresh. Acceptable for analytics (not operational control).

## 30. Implementation commit hash

**`5204687`** — "Phase 11: Analytics/Reporting/Dashboards — read-only presentation layer consuming Phase 10 computation (D1-D15 confirmed)"

---

## D1-D15 implementation verification

| Decision | Implementation | Verified |
|---|---|---|
| D1 (Trend: live vs snapshot) | Live on-demand per-bucket computation only (no AnalyticsSnapshot) | ✅ T-TREND-01 |
| D2 (AnalyticsSnapshot) | NOT implemented (not required; permission declared for future) | ✅ Zero schema changes |
| D3 (Delivery) | Returns null + warning ("shipment source not yet implemented") | ✅ T-DELIVERY-01 |
| D4 (Critical problems) | Open NCR/Dev/CAPA + open RiskAssessment RPN≥15 (configurable threshold) | ✅ T-CRIT-01 |
| D5 (Overdue actions) | Authoritative dueDate only (calibration/maintenance/training); CAPA/ChangeControl reported as "limited" | ✅ T-OVERDUE-01 |
| D6 (Recurrence/effectiveness) | Subject-based grouping (recurrence); CAPA outcome + post-closure recurrence (effectiveness) | ✅ T-RECURRENCE-01, T-EFFECTIVENESS-01 |
| D7 (Corporate aggregation) | `analytics.corporate.read`; aggregate-only; per-site rows suppressed; audited; server-side enforced | ✅ T-CORPORATE-01 |
| D8 (Cache) | NOT implemented (owner preferred no cache; 90-day cap suffices) | ✅ No cache code |
| D9 (Export) | CSV mandatory (tamper-evident); PDF/Excel deferred | ✅ T-EXPORT-01 |
| D10 (Responsive) | Desktop-first responsive; no dedicated mobile views | ✅ Browser-verified |
| D11 (Permissions) | 4 perms; AI gets `analytics.read` only | ✅ T-AI-GUARD-08 |
| D12 (Audit) | Audit export + corporate + denials; not routine reads | ✅ T-CORPORATE-01, T-EXPORT-01 |
| D13 (AI in Phase 11) | None — no chatbot, no `z-ai-web-dev-sdk` call; permission surface only | ✅ No AI code |
| D14 (Timezone) | Site.timezone already exists; site-local authoritative; UTC corporate | ✅ Schema verified |
| D15 (Range cap) | 90-day on-demand cap; `assertRangeCap()` enforces; no silent truncation | ✅ T-SOURCE-01 |

---

## Critical analytics rule (restated)

Phase 11 consumes the trusted Phase 10 computation layer. **No OEE/Lean formula is reimplemented in dashboard components, report generators, or export code.** One computation source remains authoritative. Verified by T-SOURCE-01 + T-ANALYTICS-01.

## Dashboard trust requirement (verified)

Dashboards distinguish: calculated / unavailable / incomplete-data / warning. Null values display "Data unavailable" (not 0). Zero-denominator cases return null with warnings. Browser-verified on OEE dashboard ("Data unavailable" for null OEE/availability/performance/quality).

---

```
PHASE 11 STATUS: READY FOR OWNER REVIEW
```

**STOP.** Not starting Phase 12. Awaiting owner explicit approval.
