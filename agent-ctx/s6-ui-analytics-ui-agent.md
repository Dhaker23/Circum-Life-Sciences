# Task s6-ui — Phase 11 Analytics UI

**Agent:** s6-ui (Z.ai Code)
**Task:** Build 19 client-side Analytics dashboard / report / VSM / corporate pages under `src/app/[locale]/(app)/analytics/`.

## What was built

19 page files under `src/app/[locale]/(app)/analytics/`:

### Dashboard pages (8)
1. `dashboards/production/page.tsx` — BarChart (planned vs actual by day) + 3 KPI cards
2. `dashboards/oee/page.tsx` — Gauge-style display (4 progress bars with green/amber/red thresholds) + source breakdown Table
3. `dashboards/quality/page.tsx` — 9 KPI cards + PieChart pass/fail (green/red)
4. `dashboards/downtime/page.tsx` — ComposedChart Pareto (Bar + cumulative Line, dual Y-axis) + 4 KPI cards
5. `dashboards/bottlenecks/page.tsx` — Ranked Table with sticky header + scroll
6. `dashboards/critical-problems/page.tsx` — Threshold KPI + items Table (RPN, riskAssessmentCode, associationPath)
7. `dashboards/overdue-actions/page.tsx` — 4 KPI cards + items Table + LimitationsNotice (CAPA + ChangeControl)
8. `dashboards/delivery/page.tsx` — Stub "Data Unavailable" page with prominent warning

### Report pages (7)
9. `reports/page.tsx` — Index with 6 navigation cards
10. `reports/oee-trend/page.tsx` — LineChart (4 series) + granularity Select + CSV export
11. `reports/quality-trend/page.tsx` — LineChart (3 series) + granularity Select + CSV export
12. `reports/downtime-pareto/page.tsx` — Pareto ComposedChart + CSV export
13. `reports/equipment-performance/page.tsx` — Per-equipment Table + CSV export
14. `reports/recurrence/page.tsx` — KPIs + items Table (occurrences/dates/linked CAPAs) + CSV export
15. `reports/action-effectiveness/page.tsx` — KPIs (incl. effectiveness rate) + items Table + CSV export

### Other (2)
16. `vsm/page.tsx` — VSM list Select + horizontal scrollable node flow + totals KPIs (leadTime/VA/non-VA/VA ratio)
17. `corporate/page.tsx` — DateRangePicker + 8-metric Checkbox multi-select + KPI cards + contributingSiteCount + note + Audited badge + 403 forbidden locked-state

## Architecture rules respected

1. **UI never computes KPIs** — every value comes from the API
2. **Data-state handled correctly** — null values render "Data unavailable" (state="unavailable") instead of 0
3. **WarningBanner** shown on every page (from `meta.warnings`)
4. **MetaFooter** with computedAt + live-computation badge on every page
5. **recharts** used for all charts (BarChart, LineChart, PieChart, ComposedChart)
6. **Responsive grids** (`sm:grid-cols-2 lg:grid-cols-4`)
7. **"use client"** on all pages (uses useQuery / fetch)
8. **RBAC** enforced by the API; corporate page handles 403 explicitly
9. **Colors** — Tailwind theme colors (hsl(var(--primary))), amber for warnings, green/red for pass/fail. No indigo/blue.

## Typecheck / Lint

- `bunx tsc --noEmit` — PASS (zero new errors; only pre-existing `vitest.config.ts` poolOptions error)
- `bun run lint` — PASS (zero new warnings after removing one unused KpiCard import)

## Notes for future agents

- The task description and the existing `dashboards/page.tsx` template reference `/api/organization/sites?pageSize=100`, but the **actual API route is `/api/org/sites`** (no pagination param). All 19 new pages use the correct path `/api/org/sites`. The pre-existing dashboards/page.tsx file was left untouched (its bug is pre-existing and out of scope).
- All chart heights use `h-64` or `h-80` wrapped in `ResponsiveContainer`.
- All Tables use shadcn Table with sticky headers (`sticky top-0 bg-card`) + `max-h-96 overflow-y-auto`.
- Default date range = last 7 days (or 30 days for recurrence/action-effectiveness reports).
- CSV export: POST `/api/analytics/export` with `{reportType, params, format:"csv"}`, response is a CSV blob triggered via `URL.createObjectURL` + temporary `<a>` click.
- Corporate page checks `res.status === 403` and shows a dedicated locked-state card with the permission name `analytics.corporate.read`.
