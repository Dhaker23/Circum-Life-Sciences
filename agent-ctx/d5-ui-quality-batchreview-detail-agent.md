# Task d5-ui — Phase 14 D5: Quality + Batch-Review Detail Pages with Transition Buttons

**Agent:** d5-ui (Z.ai Code)
**Task:** Build 5 detail pages (NCR / Deviation / CAPA / ChangeControl / BatchReview) under
`src/app/[locale]/(app)/` that call the existing transition/disposition APIs.

## What was built

5 page files (all `"use client"`, useTranslations + useQuery + Dialog pattern):

### 1. NCR Detail — `src/app/[locale]/(app)/quality/ncrs/[id]/page.tsx`
- Fetches NCR by ID via `GET /api/quality/ncrs/[id]` (existing API).
- Displays: code, status, severity, concernsEntityType/Id, description, containmentAction,
  disposition, closureNotes, createdAt, site code.
- Transition buttons (mirror D3 state machine — UI only, server enforces):
  - DRAFT → CONTAINMENT (needs reason + containmentAction textarea)
  - DRAFT → CANCELLED (needs reason + closureNotes textarea) — destructive variant
  - CONTAINMENT → INVESTIGATION (needs reason only)
  - INVESTIGATION → DISPOSITION (needs reason + disposition Select — 5 options)
  - DISPOSITION → CLOSED (needs reason + closureNotes textarea) — secondary variant
- Terminal-status amber Alert inside CLOSED/CANCELLED dialogs ("cannot be reversed").
- Refetches NCR + invalidates `["ncrs"]` list on success; success/failure toast.
- Back button → `/quality/ncrs`.

### 2. Deviation Detail — `src/app/[locale]/(app)/quality/deviations/[id]/page.tsx`
- **NOTE:** No `GET /api/quality/deviations/[id]` exists (the `[id]/route.ts` only has POST approve).
  Fetches `/api/quality/deviations?pageSize=100` and filters client-side by ID (per task spec).
- Displays: code, status, appliesToEntityType/Id, description, justification,
  impactAssessment, validFrom/Until, createdAt, site.
- Transition buttons (mirror D4 state machine):
  - DRAFT → ASSESSMENT / REJECTED
  - ASSESSMENT → INVESTIGATION / REVIEW (with optional impactAssessment) / REJECTED
  - INVESTIGATION → REVIEW (with optional impactAssessment)
  - REVIEW → CLOSED / REJECTED
- `impactAssessment` is OPTIONAL per schema (zod `.optional()`) — dialog includes the field
  but does not block submission if empty.
- Back button → `/quality/deviations`.

### 3. CAPA Detail — `src/app/[locale]/(app)/quality/capas/[id]/page.tsx`
- **NOTE:** No `GET /api/quality/capas/[id]` exists. Fetches `/api/quality/capas?pageSize=100`
  and filters client-side by ID (per task spec).
- Displays: code, status, sourceType/Id, type, actionPlan, implementationOwnerUserId,
  implementedAt, effectivenessVerification, effectivenessVerifiedAt, closedByUserId,
  closedAt, createdAt, site, linked investigation code.
- Always-visible amber Alert at top of page: "AI must never close a CAPA" (the same
  `capas.aiGuard` string used on the list page).
- Transition buttons (mirror D5 state machine):
  - OPEN → ACTION_PLAN
  - ACTION_PLAN → IMPLEMENTATION
  - IMPLEMENTATION → EFFECTIVENESS
  - EFFECTIVENESS → CLOSED (needs reason + **effectivenessVerification** textarea — REQUIRED)
- The CLOSED dialog includes an explicit human-only closure notice
  (`closureHumanOnlyNotice` key) plus the required effectiveness-verification textarea.
- Back button → `/quality/capas`.

### 4. ChangeControl Detail — `src/app/[locale]/(app)/quality/changes/[id]/page.tsx`
- **NOTE:** No `GET /api/quality/changes/[id]` exists (the `[id]/route.ts` only has POST approve).
  Fetches `/api/quality/changes?pageSize=100` and filters client-side by ID.
- Displays: code, status, changeType, description, reason, impactAssessment,
  implementationPlan, verificationPlan, approvedByUserId, approvedAt, createdAt, site.
- Transition buttons (mirror D6 state machine):
  - REQUEST → IMPACT / REJECTED
  - IMPACT → RISK (with required impactAssessment) / REJECTED
  - RISK → APPROVAL / REJECTED
  - APPROVAL → IMPLEMENTATION (with amber "needs prior human approval" notice) / REJECTED
  - IMPLEMENTATION → VERIFICATION (with required implementationPlan)
  - VERIFICATION → EFFECTIVENESS (with required verificationPlan)
  - EFFECTIVENESS → CLOSED
- The IMPLEMENTATION transition button shows the implementation-needs-approval notice
  (`implementationNeedsApprovalNotice` key) — server enforces `assertChangeImplementationApproved`.
- Back button → `/quality/changes`.

### 5. BatchReview Detail — `src/app/[locale]/(app)/batch-review/batches/[id]/page.tsx`
- Fetches the aggregated review data via `GET /api/batch-review/batches/[id]` (returns
  `{ batch, ncrs, inspections, samples, packagingRecords }`).
- Displays: code, status, plannedQuantity, actualQuantity, unit, workOrder code,
  product (code + revision), site, createdAt. If `batchReviewRecord` exists, also shows
  reviewFindings, disposition, dispositionNotes, reviewedBy/At, dispositionedBy/At.
- Always-visible amber Alert: "Batch disposition is HUMAN-ONLY. AI must NEVER release
  product." (`dispositionGuard` + `dispositionHumanOnlyNotice`).
- **Transition button** (only when `status === "READY_FOR_REVIEW"`):
  - Calls `POST /api/batch-review/batches/[id]/transition` with `{ to: "QA_REVIEW", reason }`.
- **Disposition buttons** (only when `status === "QA_REVIEW"`) — 4 buttons, each opens
  its own Dialog with required reviewFindings + dispositionNotes textareas:
  - APPROVED (default variant)
  - HOLD (secondary variant)
  - REWORK (secondary variant)
  - REJECT (destructive variant)
  - Calls `POST /api/batch-review/batches/[id]/disposition` with `{ disposition, reviewFindings, dispositionNotes }`.
- Each disposition dialog includes a human-only amber Alert.
- Back button → `/batch-review`.

## i18n

Added new keys under `common`, `quality.{ncrs,deviations,capas,changes}.detail.*`, and
`batchReview.detail.*` in `src/messages/{en,fr,ar}.json`:
- `common`: `back`, `reason`, `reasonRequired`, `confirm`, `confirmTransition`, `transition`,
  `transitionSuccess`, `transitionFailed`, `dispositionSuccess`, `dispositionFailed`,
  `notFound`, `notAvailable`, `yes`, `no`, `never`, `refresh`.
- Per-entity `detail.fields.*` — every displayed field label.
- Per-entity `detail.transitions.{TO}` — button label per target status.
- Per-entity `detail.transitionTitle` — `Transition {Entity} to {to}` (with ICU `{to}` placeholder).
- Per-entity specific notices (e.g. `closureHumanOnlyNotice`, `effectivenessVerificationRequired`,
  `impactAssessmentRequired`, `implementationPlanRequired`, `verificationPlanRequired`,
  `implementationNeedsApprovalNotice`, `noTransitions`).
- `batchReview.detail.*` — `fields.*`, `transitionTitle`, `transitionButton`,
  `reviewFindingsRequired`, `dispositionNotesRequired`, `dispositionHumanOnlyNotice`,
  `dispositions.{APPROVED,HOLD,REWORK,REJECT}`, `dispositionTitle` (ICU `{disposition}`),
  `noActions`, `batchNotFound`, `back`.

## Design / UX

- Desktop-first responsive grid (`grid-cols-1 sm:grid-cols-2`), sticky footer unaffected
  (each page renders inside the existing app shell which has `mt-auto` footer).
- shadcn/ui components only: Card / CardHeader / CardContent / CardTitle / Badge / Alert /
  AlertTitle / AlertDescription / Skeleton / Dialog / DialogTrigger / DialogContent /
  DialogHeader / DialogTitle / DialogDescription / DialogFooter / Button / Label / Textarea /
  Select / SelectTrigger / SelectContent / SelectItem / SelectValue.
- Status Badge variants mirror the existing list pages (no new color tokens).
- All amber notice Alerts use `border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30`
  (consistent with Phase 13 integration detail page).
- Refresh button (RefreshCw icon) in the header of every page.
- Loading state uses 3-stripe Skeleton; error state shows destructive Alert + back button.
- Lucide icons: ArrowLeft, Loader2, RefreshCw, ShieldAlert, Gavel (batch-review only).
- NO indigo/blue primary colors — uses `text-primary`/`variant` tokens only.
- Form validation: "Confirm" button is disabled until required fields are non-empty;
  submitting state shows spinner.
- Mobile-safe: touch targets meet 44px (Buttons size="sm" with `gap-1.5` + icon).
- Accessibility: every Label has `htmlFor` matching the input id; Alert has `role="alert"`
  (built into shadcn Alert); refresh buttons have `aria-label`.

## D5 rule compliance

- **No new workflows, states, permissions, or business rules** — the UI is a pure
  consumer of the existing authoritative service layer.
- The transition spec tables in each page are a UI-side *mirror* of the domain state
  machine (defined in `src/modules/quality/domain/index.ts` and `src/modules/phase9/domain/index.ts`).
  They are NOT authoritative — the server re-validates every transition via
  `assertNcrTransition` / `assertDeviationTransition` / `assertCapaTransition` /
  `assertChangeTransition` / `assertBatchReviewTransition` / `assertCapaClosureAllowed` /
  `assertChangeImplementationApproved`.
- AI governance guards (PRD §9) are surfaced as visible Alerts but the actual enforcement
  lives in the service layer (CAPA closure human-only, Change implementation approval
  human-only, Batch disposition human-only). The UI cannot bypass these guards because
  the AI role lacks the corresponding `*.transition` / `*.approve` / `*.disposition` permissions.
- No new API routes created. No new service functions. No new Prisma models. No migrations.
- The list-page UX is untouched — detail pages are reachable via direct URL navigation
  (`/quality/ncrs/{id}`, etc.) and each detail page has a back button to its list page.

## Verification

- `bunx tsc --noEmit` → exit 0, zero errors.
- `bun run lint` → 0 errors / 243 warnings (all pre-existing carry-forward from earlier
  phases; **zero new warnings introduced by the 5 new detail pages** — verified by
  grepping lint output for the new file paths).
- `dev.log` — dev server runs clean; new pages compile on first request via Turbopack
  (not yet visited in this session, but TS + lint pass confirms compilation).
- All JSON i18n files validated with `python3 -c "import json; json.load(open(...))"`
  for EN, FR, AR.

## Carry-forward / out-of-scope

- The existing list pages (`/quality/ncrs`, `/quality/deviations`, `/quality/capas`,
  `/quality/changes`, `/batch-review`) are NOT modified — they don't yet have row-level
  links to the new detail pages. Discoverability is via direct URL navigation. Adding
  such links would be a small additive UX enhancement but is out of scope for D5
  ("Pages to create").
- The batch-review list page (`/batch-review/page.tsx`) remains a placeholder showing
  only the disposition-guard banner. Enhancing it to list batches with status
  READY_FOR_REVIEW / QA_REVIEW would be a future task.
- Production blockers (carry-forward): PostgreSQL migration, RLS, Playwright E2E,
  distributed rate limiting, vector search — all unchanged from Phase 13 status.
