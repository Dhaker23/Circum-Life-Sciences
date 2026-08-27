# CIRCUM — Pagination Migration Plan

> **Baseline:** `28227fb` (UAT-1 remediation)
> **Canonical pattern:** NCRs page (`src/app/[locale]/(app)/quality/ncrs/page.tsx`)

## Canonical Pattern

```
State: page (useState), search, statusFilter
Fetch: /api/X?page=${page}&pageSize=20
Response: { data: T[], meta: { page, pageSize, total } }
DataTable: pagination={{ page, pageSize: 20, total: data.total, onPageChange: setPage }}
Reset: page → 1 on search/filter change
```

## Classification

### Category A — Can use proven pattern directly (22 pages)

These pages fetch from a standard list API that supports `page`/`pageSize` and returns `meta.total`:

| # | Page | API |
|---|---|---|
| 1 | `manufacturing/products` | `/api/manufacturing/products` |
| 2 | `manufacturing/materials` | `/api/manufacturing/materials` |
| 3 | `manufacturing/material-lots` | `/api/manufacturing/material-lots` |
| 4 | `manufacturing/suppliers` | `/api/manufacturing/suppliers` |
| 5 | `production/batches` | `/api/production/batches` |
| 6 | `production/work-centers` | `/api/production/work-centers` |
| 7 | `equipment` | `/api/equipment` |
| 8 | `quality/deviations` | `/api/quality/deviations` |
| 9 | `quality/changes` | `/api/quality/changes` |
| 10 | `lab/specifications` | `/api/lab/specifications` |
| 11 | `lab/test-methods` | `/api/lab/test-methods` |
| 12 | `lab/samples` | `/api/lab/samples` |
| 13 | `lab/test-results` | `/api/lab/test-results` |
| 14 | `inspection/inspections` | `/api/inspection/inspections` |
| 15 | `cleanroom/rooms` | `/api/cleanroom/rooms` |
| 16 | `packaging/records` | `/api/packaging/records` |
| 17 | `sterilization/lots` | `/api/sterilization/lots` |
| 18 | `lean/downtime` | `/api/lean/downtime` |
| 19 | `lean/vsm` | `/api/lean/vsm` |
| 20 | `audit/events` | `/api/audit/events` |
| 21 | `training/records` | `/api/training/records` |
| 22 | `supplier-audits` | `/api/supplier-audits` |

### Category A+ — Integration configs (also migrate to DataTable + pagination)

| # | Page | API | Notes |
|---|---|---|---|
| 23 | `integration/configs` | `/api/integration/configs` | Also migrate from old Card+Table to DataTable |

### Category B — Requires small adaptation (3 pages)

| # | Page | API | Adaptation |
|---|---|---|---|
| 24 | `identity/users` | `/api/identity/users` | Includes role assignment data; ensure meta.total is returned |
| 25 | `identity/roles` | `/api/identity/roles` | May not have standard pagination; verify |
| 26 | `batch-review` | `/api/production/batches` | Fetches from production/batches API (not a dedicated batch-review API); filter by review statuses |

### Category C — Should NOT receive pagination (excluded)

| Page | Reason |
|---|---|
| `ai-assistant` | Chat interface — not a list page |
| `analytics/dashboards` | Dashboard overview — fetches sites list, not paginated data |
| `analytics/reports` | Report index — static navigation cards |
| `analytics/vsm` | VSM selector — small list |
| `analytics/corporate` | Corporate summary — POST-based |
| `lean/oee` | Placeholder page — no data |
| `settings` | Settings form — not a list |
| `traceability/trace` | Form + results — not a list |
| `traceability/impact` | Form + results — not a list |
| `traceability/query-log` | Append-only log — may paginate but different pattern |
| `quality/investigations` | No API list endpoint (empty data) |
| `quality/risks` | No API list endpoint (empty data) |
| All `[id]` detail pages | Detail views — not lists |
| `page.tsx` (dashboard) | Server component — not a list |
| All analytics dashboard/report sub-pages | POST-based analytics — not list pages |

## Summary

| Category | Count | Action |
|---|---|---|
| A (direct pattern) | 22 | Migrate to pagination |
| A+ (DataTable + pagination) | 1 (integration configs) | Migrate to DataTable + pagination |
| B (small adaptation) | 3 | Migrate with adaptation |
| C (excluded) | ~15 | No change |
| **Total to migrate** | **26** | |
