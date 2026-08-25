# Phase 5 — Tickets

## T01 — spec/tickets
- Done.

## T02 — Prisma schema + migration (phase5_laboratory)
- 6 new models: Specification, TestMethod, TestMethodSpec, Sample (with quantity tracking D11), TestResult (with eval≠disposition), Inspection. NCR/Site/User/Employee relations.
- Blocked by: T01. Status: ready-for-agent.

## T03 — permissions.ts: lab.* + inspection.* catalog + grants (AI never approve/disposition)
- Blocked by: T02. Status: ready-for-agent.

## T04 — Domain layer: state machines + auto-evaluation (eval!=disposition) + spec immutability + sample quantity invariants + zod
- Blocked by: T02. Status: ready-for-agent.

## T05 — Service layer: laboratory module with can()+audit()+SiteScope+polymorphic validation+human-only guards
- Blocked by: T03, T04. Status: ready-for-agent.

## T06 — API routes: /api/lab/** + /api/inspection/** with /transition, /disposition
- Blocked by: T05. Status: ready-for-agent.

## T07 — UI: 5 pages + sidebar nav + i18n (FR/EN/AR)
- Blocked by: T06. Status: ready-for-agent.

## T08 — DEMO seed (specs, methods, samples, results, inspections)
- Blocked by: T03. Status: ready-for-agent.

## T09 — Tests: 11 critical + 14 extra + regression (129)
- Blocked by: T05, T08. Status: ready-for-agent.

## T10 — Phase Gate + Validation Report + STOP
- Blocked by: T09. Status: ready-for-agent.
