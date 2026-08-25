# Phase 1 — Spec

> Published via `to-spec` from the approved Phase 1 Implementation Plan (`docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md`). Engineering working spec; the plan is authoritative design. Owner-approved constraints are binding: RBAC least-privilege, synthetic DEMO seed, SQLite-now/PG-portable, User≠Employee, multi-site isolation critical, audit append-only, argon2id+pepper, FR/EN/AR+RTL, 7 critical tests.

## Objective
Establish the Circum trust foundation: authentication, organization, RBAC, multi-site isolation, audit, i18n, application shell. No Phase 2 functionality.

## In-scope
1. Engineering foundation: strict TS, enforced ESLint, Vitest+Playwright+MSW, scripts.
2. Database: Prisma schema (SQLite, PG-portable) for User, Employee, Role, Permission, RolePermission, Assignment, Site, Department, Account, Session, VerificationToken, AuditEvent. Versioned migration. Synthetic DEMO seed (3 sites).
3. Auth: next-auth v4 DB sessions (Prisma adapter), Credentials provider, argon2id+pepper, lockout (5/15min), in-memory rate limiting, middleware route protection.
4. RBAC: permission catalog `<module>.<resource>.<action>`; 19 seeded roles; Assignment scoping (site+dept+module); 3-layer enforcement; can(); denied audited.
5. Multi-site isolation: SiteScope repository-layer filter; cross-site = critical defect; PG RLS planned.
6. Audit: append-only AuditEvent; DB triggers reject UPDATE/DELETE; PRD §13 fields; capture on auth + identity/org CRUD + denials; read + CSV export.
7. i18n: next-intl FR/EN/AR+RTL; no hard-coded user-facing strings.
8. App shell: Circum-branded industrial UI; sign-in; identity/org/audit/settings pages.
9. Docs: ADRs 0003-0005, RBAC matrix, API docs, secrets/env docs, test plan.

## Out of scope
Product/BOM (P2), production (P3), traceability (P4), quality/lab/NCR/CAPA (P5-6), documents/training (P7), equipment/validation (P8), cleanroom/packaging/sterilization/release (P9), lean (P10), analytics (P11), AI (P12), integrations (P13).

## Binding constraints (owner)
- RBAC: least-privilege; NO broad admin perms for convenience; `<module>.<resource>.<action>`; server-side enforced; UI hiding ≠ authorization; unauthorized tested.
- Seed: ALL synthetic DEMO/TEST; clearly labelled; multi-site isolation testable.
- DB: SQLite now, PG-portable, RLS planned; migration before prod.
- User ≠ Employee (separate; Employee optionally→User; not every Employee has a login).
- Multi-site isolation: CRITICAL; server/service/repo enforced; tested.
- Audit: append-only; UPDATE/DELETE must FAIL; tested.
- Auth: argon2id+pepper, lockout, rate limit, DB sessions, middleware; no secrets in source.
- i18n: FR/EN/AR+RTL; no hard-coded strings; RTL browser-tested.
- Tests: 7 critical (cross-site isolation, audit immutability, lockout, RBAC denial, RTL, pepper, session auth).
- Skills: appropriate per task; PRD > ADRs > skills.
- Process: to-spec→to-tickets→TDD→implement→tests→code-review→regression→validation. Small controlled changes.

## Acceptance (DoD)
See Phase 1 Plan §19 (12 points). Build/lint NOT sufficient; browser-verified interactivity required.
