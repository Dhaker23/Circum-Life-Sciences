# Phase 1 — Tickets (tracer-bullet decomposition)

> Published via `to-tickets` from the spec. Vertical slices with blocking edges. Status uses default triage labels. Execute in dependency order via TDD.

## T01 — Engineering foundation (deps + toolchain + test runner)
- Scope: install deps; tighten next.config/eslint/tsconfig; vitest.config.ts + playwright.config.ts + tests/setup.ts + msw server; scripts; .env.example.
- Blocked by: —
- Status: done (slice 0)
- Tests: lint exit 0; typecheck clean; test runs.

## T02 — Prisma schema + migration + audit triggers
- Scope: full Phase 1 schema (User, Employee, Role, Permission, RolePermission, Assignment, Site, Department, Account, Session, VerificationToken, AuditEvent); replace demo; first migration; SQLite triggers on AuditEvent (UPDATE/DELETE RAISE ABORT); WAL.
- Blocked by: T01
- Tests: migration clean; triggers reject UPDATE/DELETE (T-AUDIT-01).
- Status: ready-for-agent

## T03 — Permission + role catalog seed (system data)
- Scope: seed 19 system roles (isSystem) + permission catalog (identity.*, org.*, audit.*, session.*) + least-privilege RolePermission per RBAC matrix. NO broad admin perms.
- Blocked by: T02
- Tests: expected grants; no non-super_admin global destructive perms.
- Status: ready-for-agent

## T04 — Synthetic DEMO seed (sites/departments/users/employees)
- Scope: 3 demo sites (CH/FR/TN, isDemo); departments; demo users per representative role scoped to a site; demo employees (some→User, some not); all DEMO/TEST labelled.
- Blocked by: T03
- Tests: idempotent; demo flagged; Site-A and Site-B users exist.
- Status: ready-for-agent

## T05 — Core lib: auth (next-auth + argon2id + pepper + lockout + session cache)
- Scope: src/lib/auth.ts, auth.password.ts, auth.lockout.ts, auth.session-cache.ts. DB sessions.
- Blocked by: T02
- Tests: argon2id; pepper (T-PEPPER-01); lockout (T-LOCK-01); sign-in audited.
- Status: ready-for-agent

## T06 — Core lib: RBAC (can/Scope/AuthContext/catalog)
- Scope: src/lib/rbac.ts, permissions.ts, auth-context.ts.
- Blocked by: T03, T05
- Tests: can() true/false; site-scope; super_admin global; expiry.
- Status: ready-for-agent

## T07 — Core lib: audit + site-scope + errors + envelope + zod
- Scope: src/lib/audit.ts (create/read ONLY), site-scope.ts, errors.ts, api-envelope.ts, zod-schemas.ts.
- Blocked by: T02
- Tests: no update/delete methods; audit() writes; SiteScope applied.
- Status: ready-for-agent

## T08 — Module: identity (user/role/assignment) domain+service+infrastructure
- Scope: src/modules/identity/{domain,service,infrastructure}. Repos take SiteScope. Services call can()+audit().
- Blocked by: T06, T07
- Tests: deny without perm (audited); cross-site filtered; create audited.
- Status: ready-for-agent

## T09 — Module: organization + audit read/export
- Scope: src/modules/organization/*, src/modules/audit/*. Site/Dept CRUD (scoped). Audit list + CSV export.
- Blocked by: T08
- Tests: scoped queries; export envelope; denial audited.
- Status: ready-for-agent

## T10 — API routes + middleware
- Scope: src/app/api/{identity,org,audit}/** (zod, envelope, requirePermission). src/middleware.ts (locale+auth+RBAC). Remove Hello-World route.
- Blocked by: T08, T09
- Tests: 401/403/400/409/200-201.
- Status: ready-for-agent

## T11 — i18n (next-intl FR/EN/AR+RTL) + messages
- Scope: src/i18n/routing.ts, request.ts; src/messages/{en,fr,ar}.json; layout wires provider + dir.
- Blocked by: T01
- Tests: ar dir=rtl; strings from catalogs (T-I18N-01).
- Status: ready-for-agent

## T12 — App shell + pages
- Scope: sign-in; (app)/layout; identity/users, identity/roles, organization/sites, organization/departments, audit/events, settings. Sticky footer, responsive, accessible, neutral industrial.
- Blocked by: T10, T11
- Tests: renders mobile+desktop; sticky footer; nav by perm; locale switch; RTL.
- Status: ready-for-agent

## T13 — Critical tests (the 7) + E2E
- Scope: T-ISOL-01, T-AUDIT-01/02, T-LOCK-01, T-RBAC-01, T-I18N-01, T-PEPPER-01, T-SESSION-01. Playwright golden path.
- Blocked by: T12
- Status: ready-for-agent

## T14 — Phase Gate + Validation Report
- Scope: full gate; fix; retest; docs/PRD/PHASE-1-VALIDATION-REPORT.md; STOP.
- Blocked by: T13
- Status: ready-for-agent
