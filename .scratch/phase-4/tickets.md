# Phase 4 — Tickets (tracer-bullet decomposition)

## T01 — ADRs 0010-0011 + spec/tickets
- Done (slice 0-1).

## T02 — Prisma schema + migration (phase4_quality)
- 6 new models: NCR, Deviation, Investigation, CAPA (polymorphic source + optional investigationId), ChangeControl, RiskAssessment. ProductionScrap/Rework ncrId. Site/User relations. PG-portable.
- Blocked by: T01. Status: ready-for-agent.

## T03 — permissions.ts: quality.* catalog + grants (AI never approve/transition) + RBAC matrix
- Blocked by: T02. Status: ready-for-agent.

## T04 — Domain layer: state machines + closure/approval guards + RPN + polymorphic validation + zod
- Blocked by: T02. Status: ready-for-agent.

## T05 — Service layer: quality module with can()+audit()+SiteScope+polymorphic validation+cross-site rejection+human-only guards
- Blocked by: T03, T04. Status: ready-for-agent.

## T06 — API routes: /api/quality/** with /transition, /approve, /conclude; guards
- Blocked by: T05. Status: ready-for-agent.

## T07 — UI: 6 quality pages + sidebar nav + i18n (FR/EN/AR)
- Blocked by: T06. Status: ready-for-agent.

## T08 — DEMO seed (NCR, investigation, CAPA w/+w/o investigation, deviation, change, risk)
- Blocked by: T03. Status: ready-for-agent.

## T09 — Tests: 9 critical + extras + regression (84 prior)
- Blocked by: T05, T08. Status: ready-for-agent.

## T10 — Phase Gate + Validation Report + STOP
- Blocked by: T09. Status: ready-for-agent.
