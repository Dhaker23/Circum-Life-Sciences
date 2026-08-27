# CIRCUM — UAT-1 INVESTIGATION REPORT

> **Phase:** A (Investigation only — no code modified)
> **Baseline commit:** `ad84423`
> **Date:** UAT-1 remediation

---

## D-003 — P1 — BatchReviewRecord status returns `undefined`

### Finding

The UAT audit reported `BatchReviewRecord.status` returns `undefined`.

### Root cause

**`BatchReviewRecord` has no `status` field in the Prisma schema.** The model has `reviewFindings`, `disposition`, `reviewedByUserId`, `reviewedAt`, `dispositionedByUserId`, `dispositionedAt`, `dispositionNotes` — but no `status` field. The batch review workflow status is tracked on `ManufacturingBatch.status` (PLANNED → IN_PRODUCTION → COMPLETED → READY_FOR_REVIEW → ON_HOLD), NOT on `BatchReviewRecord`.

The seed creates a `BatchReviewRecord` with only `{ batchId, siteId, isDemo: true }` — no status to set because the field doesn't exist.

The UAT audit query tried to read `br.status` which correctly returned `undefined` (the field doesn't exist on the model).

### Affected files

- `prisma/schema.prisma` — `BatchReviewRecord` model (no `status` field)
- `prisma/seed.ts` — creates BatchReviewRecord without status
- `src/modules/phase9/service/index.ts` — `getBatchReviewData()` includes `batchReviewRecord: true` (returns the record, but no status)
- `src/app/[locale]/(app)/batch-review/page.tsx` — UI list page
- `src/app/[locale]/(app)/batch-review/batches/[id]/page.tsx` — UI detail page

### Proposed minimal fix

**Add a `status` field to `BatchReviewRecord`** with values: `PENDING → REVIEWED → DISPOSITIONED`. This is the correct domain model — the batch review record itself should track its own review status, distinct from the batch's manufacturing status. The batch status tracks production state; the review record status tracks the QA review state.

- Add `status String @default("PENDING")` to `BatchReviewRecord` in schema
- Create a migration
- Update the seed to set `status: "PENDING"`
- The service and API already include `batchReviewRecord: true` — the status will be returned automatically
- Update the UI to display the status via `StatusBadge`

### Regression test strategy

- Test: `BatchReviewRecord` has a `status` field defaulting to `PENDING`
- Test: seed data creates a review record with `status: "PENDING"`
- Test: API returns the status

### Risk assessment

**Low risk.** Adding a field with a default value is non-breaking. No existing queries are affected. The field is optional in the schema (has a default), so existing code that doesn't reference it will continue to work.

---

## D-001 — P2 — MaterialLot field mismatch (`code` vs `lotCode`)

### Finding

The UAT audit reported MaterialLot uses `lotCode` but the UI references `code`.

### Root cause

**The UI is CORRECT.** The material-lots list page (`src/app/[locale]/(app)/manufacturing/material-lots/page.tsx`) was migrated in UI-2 and correctly references `l.lotCode` (line 65: `l.lotCode.toLowerCase().includes(q)`, line 74: `render: (l) => <span>{l.lotCode}</span>`).

The UAT audit's `bun -e` script used `select: { code: true }` which failed because the field is `lotCode`, not `code`. This was an **audit script error**, not a code defect.

**The UI, service, and API all correctly use `lotCode`.** No defect exists.

### Affected files

None — no fix needed.

### Conclusion

**D-001 is NOT a defect.** The UI correctly uses `lotCode`. The UAT audit script used the wrong field name in its ad-hoc query. No code change required.

---

## D-002 — P2 — Batch execution relation (`executions` vs `operationExecutions`)

### Finding

The UAT audit reported `ManufacturingBatch` has relation `executions` not `operationExecutions`.

### Root cause

**The traceability service does NOT reference `operationExecutions` or `executions` at all.** The traceability service traverses the genealogy chain via:
- `materialConsumption.findMany({ where: { batchId } })` — links batch to material lots
- `manufacturingBatch.findMany({ where: { workOrderId } })` — links work order to batches
- `deviceLot.findMany({ where: { batchId } })` — links batch to device lots

The traceability service does NOT directly query `batch.executions` — it queries `OperationExecution` via `batchId` separately if needed (the traceability graph builder uses entity-type-based traversal, not Prisma relation includes).

The `ManufacturingBatch` model has the relation named `executions` (not `operationExecutions`), and the phase9 service `getBatchReviewData()` correctly uses `include: { executions: true }`.

**No defect exists.** The relation name `executions` is the correct Prisma relation name, and all services use it correctly.

### Affected files

None — no fix needed.

### Conclusion

**D-002 is NOT a defect.** The relation name `executions` is correct and consistently used. The UAT audit's `bun -e` script used the wrong relation name `operationExecutions` in its ad-hoc query. No code change required.

---

## D-005 — P2 — Pagination (34 list pages fetch `pageSize=100` without UI controls)

### Finding

34 list pages fetch `?pageSize=100` without exposing pagination controls in the UI.

### Root cause

**The DataTable component already supports pagination** (has `DataTablePagination` interface with `page`, `pageSize`, `total`, `onPageChange`), and renders pagination buttons. However, the 34 migrated list pages do NOT pass the `pagination` prop to DataTable — they fetch all data client-side via `useQuery` and pass the full array.

The API supports pagination via `PaginationSchema` (`page`, `pageSize` with defaults of 1 and 50), and returns `meta: { page, pageSize, total }` in the response envelope.

### Architecture

Current pattern (client-side):
```
useQuery → fetch /api/X?pageSize=100 → get all data → filter client-side → pass to DataTable
```

Target pattern (server-side pagination):
```
useState(page) → fetch /api/X?page=${page}&pageSize=${pageSize}&search=${search} → get page data + meta → pass to DataTable with pagination prop
```

### Proposed minimal fix

**Update the 4 representative list pages** (already migrated in UI-1: NCRs, CAPAs, Work Orders, Documents) to use server-side pagination. This demonstrates the pattern; remaining pages can be migrated incrementally.

For each page:
1. Add `page` and `pageSize` state
2. Pass `page` and `pageSize` to the API URL
3. Parse `meta.total` from the response
4. Pass `pagination={{ page, pageSize, total, onPageChange: setPage }}` to DataTable
5. Keep client-side search (filter the current page's data) OR move search to server-side if the API supports it

**Note:** Most APIs do NOT support server-side search filtering (they return all records for the page). Client-side search on the current page is the pragmatic approach. Full server-side search would require API changes (out of scope for this remediation).

### Regression test strategy

- Test: DataTable renders pagination when `pagination` prop is provided
- Test: clicking "next" calls `onPageChange` with page+1
- Test: clicking "previous" calls `onPageChange` with page-1

### Risk assessment

**Low risk.** The DataTable already supports pagination. The change is adding props to existing pages. No API changes needed (APIs already support `page`/`pageSize` and return `meta`).

---

## Summary

| Defect | Real defect? | Root cause | Fix needed? |
|---|---|---|---|
| D-003 (P1) | ✅ YES | `BatchReviewRecord` has no `status` field | Add `status` field + migration + seed update |
| D-001 (P2) | ❌ NO | Audit script used wrong field name; UI correctly uses `lotCode` | None |
| D-002 (P2) | ❌ NO | Audit script used wrong relation name; service correctly uses `executions` | None |
| D-005 (P2) | ✅ YES (partial) | DataTable supports pagination but pages don't pass the prop | Update 4 representative pages to use server-side pagination |

**Only D-003 and D-005 require code changes.** D-001 and D-002 are false positives from the audit's ad-hoc query scripts.
