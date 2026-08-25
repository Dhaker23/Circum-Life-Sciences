# CIRCUM — PHASE 1 IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 1 — Identity / Organization / Sites / Departments / Roles / Permissions / Authentication / Audit
> **Predecessor:** Phase 0 Discovery Report (approved with owner decisions, see `docs/PRD/PHASE-0-DISCOVERY-REPORT.md` §23).
> **Method:** This plan is the **specification** for Phase 1. It will be executed via the Matt Pocock workflow `grill-with-docs → to-spec → to-tickets → tdd/implement → code-review`, under the mandatory Phase Gate (PRD §19/§23).
> **Source of truth:** Circum Master PRD §3 (RBAC), §4 (i18n), §10 (Security/Data Integrity), §11 (Architecture), §13 (Audit), §16 (Docs), §17 (Validation-minded), §19/§20 (Phase Gate/Report).

---

## 0. Reading guide

This document is organized into the 20 sections requested by the owner. Sections 1–14 define **what** to build; §15–16 define **how** (skills + files); §17–20 define **risk, deps, done-criteria, and tests**. After owner approval, this plan is decomposed into tickets (`to-tickets`) under `.scratch/phase-1/` and executed slice-by-slice with TDD (`tdd`), closed by `code-review`, then a Phase Validation Report (PRD §20).

```
PHASE 1 PLAN STATUS: WAITING FOR OWNER APPROVAL
```

---

## 1. Objectives

Phase 1 establishes the **trust foundation** of the Circum platform: who you are, what you may do, where you may act, and an indelible record of every meaningful action. Everything downstream (manufacturing, quality, traceability, release) depends on this layer being correct, so Phase 1 is built to medical-device-grade rigor even though no "product" features exist yet.

**Concrete objectives:**

1. **Authentication** — secure sign-in/sign-out with a local-first credentials provider, database-backed sessions (revocable, auditable), argon2id password hashing, lockout/rate-limiting, and a session strategy that survives LAN-only operation.
2. **Organization model** — Sites, Departments, and their hierarchy, configurable and demo-seeded.
3. **RBAC** — the 18 PRD roles as configurable data, a permission catalog, least-privilege assignment **scoped per site/department/module**, and an enforcement layer that runs on both the API boundary and the service/repository layer (defense in depth).
4. **Multi-site isolation** — every site-scoped query is filtered to the user's authorized sites at the repository layer (SQLite has no row-level security; this is enforced in code, with a clear path to DB-level isolation when PostgreSQL lands).
5. **Audit architecture** — an append-only `AuditEvent` store capturing PRD §13 fields (user, action, entity, previous/new state, reason, session/IP), immutable to normal users, queryable for reviewers/auditors.
6. **i18n skeleton** — next-intl wired with `[locale]` routing, FR/EN/AR message catalogs, RTL for Arabic, no hard-coded user-facing strings.
7. **App shell** — Circum-branded industrial UI (sidebar, topbar, user menu, notifications, sticky footer, theme provider, responsive, accessible) ready to host Phase 2+ modules.
8. **Engineering foundation** — real quality gates (strict TS, enforced ESLint), a test runner (Vitest + Playwright + MSW), CI-ready scripts, and a SQLite schema designed for PostgreSQL portability.
9. **Documentation** — ADRs for auth/session strategy, RBAC model, multi-site isolation, and SQLite→PG migration; updated `CONTEXT.md`/`DOMAIN_GLOSSARY.md`; API docs seed.

**Out of scope for Phase 1:** product/BOM/material (Phase 2), production/work orders (Phase 3), traceability (Phase 4), quality records (Phase 5+), AI assistant (Phase 12), any controlled QMS record workflows (those arrive with their owning modules). Phase 1 builds only the **identity/org/audit** primitives those modules will depend on.

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 1 coverage |
|---|---|---|---|
| R1 | Configurable roles incl. the 18 named (Super Admin, Site Admin, Plant Manager, Production Manager, Production Planner, Shift Supervisor, Operator, Quality Manager, QA Reviewer/Approver, Quality Engineer, Lab Technician, Validation Engineer, Maintenance Manager, Maintenance Technician, Calibration Technician, Warehouse/Logistics Manager, Lean Manager, Auditor, Executive Viewer) | §3 | seed all 18 + make configurable |
| R2 | Least-privilege permissions | §3 | permission catalog + per-assignment scope |
| R3 | Site/department/module access scoping | §3 | `Assignment` model + enforcement layer |
| R4 | Controlled workflow transition authorization | §3 | `can(perm, scope)` guard used by every state transition (Phase 5+) |
| R5 | Authentication, secure sessions, API authorization | §10 | next-auth v4 + middleware + service-layer guards |
| R6 | Input validation, injection/XSS/CSRF protection | §10 | zod at every API boundary; Next CSRF token; React defaults for XSS |
| R7 | Secrets management (no creds in source) | §10 | `.env` only; argon2 pepper in env; documented |
| R8 | Audit logs (user/action/entity/timestamp/prev→new/reason/session/IP) | §10, §13 | `AuditEvent` append-only store |
| R9 | Normal users cannot edit/delete audit history | §10, §13 | no update/delete API; DB write-once enforcement (app layer + trigger-ready) |
| R10 | DB constraints/transactions prevent duplicates, broken refs, impossible values, unauthorized transitions | §10, §11 | FKs, uniques, check-via-zod, transactions, state-machine layer |
| R11 | Layered architecture: Presentation→API→App Services→Domain→Infrastructure→DB | §11 | `src/modules/identity/{api,service,domain,infrastructure}` |
| R12 | Critical business logic not only in UI | §11 | RBAC/audit/state-machine in domain+service, never solely client |
| R13 | Local-first operation (factory LAN, no Internet) | §12 | credentials provider + local DB; no external IdP dependency for core auth |
| R14 | FR/EN/AR + RTL, no hard-coded strings | §4 | next-intl + catalogs + RTL |
| R15 | Professional industrial UI, data-dense, accessible, responsive | §14 | Circum shell + shadcn/ui |
| R16 | Maintain docs tree (PRD/architecture/adr/validation/testing/operations/api/user-guides) + CONTEXT.md + DOMAIN_GLOSSARY.md | §16 | seed + update |
| R17 | Validation-minded: Intended Use→Requirement→Risk→Design→Implementation→Test→Evidence→Review→Approval→Change History | §17 | applied to auth/RBAC/audit (highest-risk Phase 1 features) |
| R18 | Phase Gate: Unit/Integration/API/DB/Auth/Workflow/UI/E2E/Regression + Security/Data-integrity/Audit/Domain/Code/Perf/Browser reviews | §19, §23 | full gate executed before sign-off |
| R19 | Phase Validation Report (PASS/CONDITIONAL/FAIL) | §20 | produced at gate |
| R20 | Demo data clearly labelled DEMO/TEST | §21 | seed script labels all demo rows |

---

## 3. Domain entities

Defined via `domain-modeling`; names follow `CONTEXT.md`. Phase 1 introduces these ubiquitous-language terms:

- **User** — a person who can sign in. Has credentials (email + argon2id hash), profile (name, locale preference, timezone), status (`ACTIVE`/`LOCKED`/`DISABLED`), and one or more **Assignments**.
- **Role** — a named bundle of permissions (one of the 18 PRD roles, or a custom configured role). Has a `systemKey` (stable enum-like string) and `isSystem` flag (the 18 seeded roles cannot be deleted, only their permission grants edited with care).
- **Permission** — an atomic capability, namespaced as `<module>.<resource>.<action>` (e.g., `identity.user.create`, `identity.audit.read`). Stored as a catalog; not user-editable (system-defined).
- **RolePermission** — grant of a Permission to a Role.
- **Assignment** — binds a User to a Role **within a scope**: optional Site, optional Department, optional Module set. This is the unit of least-privilege. A user may have multiple assignments (e.g., Quality Manager at Site A, Auditor read-only at Site B).
- **Site** — a physical manufacturing location. Has code, name, address, timezone, status (`ACTIVE`/`INACTIVE`), and `isDemo` flag.
- **Department** — an organizational unit within a Site (e.g., Production, QA, Lab, Maintenance, Warehouse). Belongs to one Site.
- **Session** — a sign-in session (next-auth DB session). Has expiresAt, sessionToken, userId, and audit linkage.
- **AuditEvent** — an immutable record of a meaningful action (see §9).
- **Account** — next-auth account record (for credentials provider, minimally populated; reserved for future OAuth/OIDC SSO).
- **VerificationToken** — next-auth token (email verify / password reset; reserved).

**Value objects / invariants (domain layer, not DB tables):**
- `PermissionKey` — typed string matching the catalog; validated by zod.
- `Scope` — `{ siteId?, departmentId?, module? }`; the boundary an Assignment applies within.
- `AuthContext` — derived at request time: `{ userId, assignments, resolvedSites, resolvedPermissions }`; the single object every authorization check consumes.
- `UserStatus`, `SiteStatus` — state machines (`ACTIVE ⇄ DISABLED`, `LOCKED` reachable on lockout).

**Not in Phase 1** (deferred to owning modules): Employee/Training/Competency (Phase 7), Operator shift linkage (Phase 3), Equipment (Phase 8). A User is the *identity*; an Employee (HR record) is a later, separate concept. (Flagged for `/grill-with-docs` if the owner treats User and Employee as the same.)

---

## 4. Database schema (Prisma, SQLite, PG-portable)

**Provider:** `sqlite` (environment constraint; see ADR-0002). Schema is written to be PostgreSQL-portable: no SQLite-only types, enums modeled as `String` + zod validation + a domain state-machine, `DateTime` everywhere, `Json` used for `AuditEvent.previousState`/`newState` (Prisma supports `Json` on SQLite via serialization).

**Migration strategy:** Prisma `migrate dev` is NOT used (the project uses `db:push`). For Phase 1 we adopt `prisma migrate dev` to get a versioned migration history (required for validation evidence, PRD §17). SQLite migrations are forward-compatible to PostgreSQL; the cutover ADR (0002) defines the `pg`-side review.

```prisma
// prisma/schema.prisma (Phase 1 — replaces the demo User/Post)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"          // ADR-0002: temporary; PostgreSQL when environment supports
  url      = env("DATABASE_URL")
}

// ---- Identity ----

model User {
  id              String   @id @default(cuid())
  email           String   @unique
  name            String?
  passwordHash    String                       // argon2id
  status          String   @default("ACTIVE")  // ACTIVE | LOCKED | DISABLED  (zod-enforced)
  preferredLocale String   @default("en")      // en | fr | ar
  timezone        String   @default("Africa/Lagos")
  failedAttempts  Int      @default(0)
  lockedUntil     DateTime?
  lastSignInAt    DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  assignments     Assignment[]
  sessions        Session[]
  accounts        Account[]
  auditEvents     AuditEvent[]  // as actor

  @@index([status])
}

model Role {
  id          String   @id @default(cuid())
  systemKey   String   @unique               // e.g. "quality_manager" (stable)
  name        String                          // display name (i18n key or literal)
  description String?
  isSystem    Boolean  @default(false)       // the 18 seeded roles: true
  status      String   @default("ACTIVE")    // ACTIVE | DISABLED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  permissions RolePermission[]
  assignments Assignment[]

  @@index([status])
}

model Permission {
  id         String   @id @default(cuid())
  key        String   @unique               // "identity.user.create"
  module     String                          // "identity"
  description String?
  createdAt  DateTime @default(now())

  roles      RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  createdAt    DateTime @default(now())

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}

// ---- Organization ----

model Site {
  id        String   @id @default(cuid())
  code      String   @unique               // e.g. "TUN-01"
  name      String
  address   String?
  timezone  String   @default("Africa/Lagos")
  status    String   @default("ACTIVE")    // ACTIVE | INACTIVE
  isDemo    Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  departments Department[]
  assignments Assignment[]

  @@index([status])
}

model Department {
  id        String   @id @default(cuid())
  siteId    String
  code      String                          // per-site unique (compound)
  name      String
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  site       Site       @relation(fields: [siteId], references: [id], onDelete: Cascade)
  assignments Assignment[]

  @@unique([siteId, code])
  @@index([siteId])
}

// ---- RBAC scoping ----

model Assignment {
  id           String   @id @default(cuid())
  userId       String
  roleId       String
  siteId       String?        // null = all sites (Super Admin only; guarded)
  departmentId String?        // null = whole site
  moduleScope  String?        // optional module restriction (e.g., "quality")
  status       String   @default("ACTIVE")
  validFrom    DateTime?
  validUntil   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  role       Role       @relation(fields: [roleId], references: [id], onDelete: Restrict)
  site       Site?      @relation(fields: [siteId], references: [id], onDelete: Cascade)
  department Department? @relation(fields: [departmentId], references: [id], onDelete: Cascade)

  @@unique([userId, roleId, siteId, departmentId, moduleScope])
  @@index([userId])
  @@index([siteId])
}

// ---- next-auth (DB sessions) ----

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ---- Audit (append-only) ----

model AuditEvent {
  id            String   @id @default(cuid())
  occurredAt    DateTime @default(now())
  actorUserId   String?
  action        String                  // "identity.user.create"
  entityType    String                  // "User"
  entityId      String?
  previousState Json?
  newState      Json?
  reason        String?
  outcome       String   @default("SUCCESS")  // SUCCESS | FAILURE | DENIED
  sessionId     String?
  ipAddress     String?
  userAgent     String?

  actor User? @relation(fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([occurredAt])
  @@index([actorUserId])
  @@index([entityType, entityId])
  @@index([action])
}
// NOTE: no update/delete Prisma access paths in the repository layer (see §9).
```

**Indexes** chosen for the audit query patterns reviewers/auditors use (by actor, by entity, by action, by time). `AuditEvent.actorUserId` is `onDelete: SetNull` so audit history survives user deletion (regulatory: audit must outlive the user). `Assignment` unique constraint prevents duplicate grants. `Department` is unique per `(siteId, code)`.

---

## 5. Authentication

**Library:** next-auth v4.24.11 (already installed) + `@next-auth/prisma-adapter` (to add) for **database sessions**.

**Why DB sessions (not JWT):** a regulated medical-device platform needs session **revocation** and an **audit link** from session to actor. JWT is stateless and hard to revoke; DB sessions give a revocable, auditable `Session` row per sign-in. Trade-off: one DB read per request — acceptable on local LAN, mitigated by a short-lived in-memory session cache (PRD §11 allows local memory caching).

**Provider:** `CredentialsProvider` (local-first; no external IdP required for core auth). Username = email; password verified against `User.passwordHash` (argon2id). An OIDC/OIDC provider is **reserved** for future SSO but not enabled in Phase 1 (keeps local-first guarantee, PRD §12).

**Password hashing:** `@node-rs/argon2` (argon2id; native, fast on bun). Parameters per OWASP (m=64MiB, t=3, p=4). A server-side **pepper** is held in env (`AUTH_PEPPER`), applied before hashing. Pepper never logged, never committed.

**Session strategy:** `strategy: "database"`, `maxAge: 8h` (factory shift), `updateAge: 1h`. Session token = opaque random (not a JWT). `Session` rows are deleted on sign-out; expired rows are reaped by a scheduled task (Phase 1: a documented manual/CLI job; Phase 13 adds cron).

**Lockout / rate-limiting:** increment `User.failedAttempts` on bad password; lock for 15 min at 5 failures (`lockedUntil`). Sign-in route is also rate-limited at the API layer (in-memory token bucket per IP+email; local-first, no Redis). Defends against brute force on the LAN edge.

**Route protection:** `middleware.ts` (Next 16) runs on every matched route: resolves the session, builds the `AuthContext`, enforces `can()` for the route's required permission and site scope, and redirects unauthenticated users to `/[locale]/sign-in`. Public routes: `/[locale]/sign-in`, `/api/auth/*`.

**CSRF:** next-auth v4 ships CSRF protection for its own routes. For app `POST`/`DELETE`/`PUT` API routes, enforce a double-submit CSRF token (or rely on `SameSite=Lax` session cookie + origin check). Documented in ADR.

**Sign-out:** deletes the `Session` row + emits an `AuditEvent(action="identity.session.signout")`.

**Sign-in audit:** every sign-in attempt (success or failure) emits an `AuditEvent` with `outcome` and `ipAddress`/`userAgent`. Failed/denied attempts are audited too (regulatory expectation).

---

## 6. RBAC

**Permission catalog (system-defined, seeded):** namespaced `<module>.<resource>.<action>`. Phase 1 seeds the `identity.*`, `org.*`, and `audit.*` permissions needed for Phase 1 itself; later phases add their own. Examples:

```
identity.user.read | create | update | disable | reset-password
identity.role.read | create | update | assign-permission
identity.assignment.read | create | delete
org.site.read | create | update | deactivate
org.department.read | create | update | deactivate
audit.read | export
session.sign-in | sign-out
```

**The 18 PRD roles (seeded, `isSystem: true`):** Super Administrator, Site Administrator, Plant Manager, Production Manager, Production Planner, Shift Supervisor, Operator, Quality Manager, QA Reviewer/Approver, Quality Engineer, Laboratory Technician, Validation Engineer, Maintenance Manager, Maintenance Technician, Calibration Technician, Warehouse/Logistics Manager, Lean Manager, Auditor, Executive Viewer. Each gets a sensible default permission grant (documented in `docs/architecture/rbac-matrix.md`); grants are configurable post-seed.

**Enforcement (defense in depth — critical, PRD §11 "logic not only in UI"):**

1. **UI layer** — show/hide actions based on `AuthContext.permissions` (usability, not security).
2. **API/middleware layer** — `middleware.ts` + per-route `requirePermission(perm, scope)` guard; rejects before the handler runs.
3. **Service/domain layer** — every use-case re-checks `can(perm, scope)` and the **site/department scope** against the target entity. This is the authoritative check; the API guard is convenience + early rejection.

**`can(permission, scope, target?)` semantics:**
- Resolved permissions = union of permissions over the user's active assignments whose `validFrom`/`validUntil` window contains now and whose `status=ACTIVE`.
- For a site-scoped target, the assignment must either have `siteId IS NULL` (Super Admin, guarded) or `siteId = target.siteId`. Department scope narrows further.
- A `DENY` audit event is emitted on any failed authorization (so denied attempts are visible to auditors).

**Least-privilege configuration:** the default seeded grants are intentionally narrow; the Super Administrator can grant more. No role starts with destructive permissions it doesn't need (e.g., Auditor = read-only across identity/audit; Executive Viewer = read-only dashboards-only).

**Super Administrator guard:** an assignment with `siteId IS NULL` requires the `super_admin` role; enforced at assignment-create time. Prevents accidental global-scope grants.

---

## 7. Organization / Site / Department model

- **Site** is the top-level scope. Multi-site is core to Circum (CH/FR/TN footprint, PRD §2). Each Site has a stable `code`, timezone, address, status, `isDemo` flag.
- **Department** belongs to exactly one Site (`siteId` required), unique `(siteId, code)`. Departmental structure (Production, QA, Lab, Maintenance, Warehouse, etc.) is configurable per Site.
- A User is **not** directly attached to a Site/Department; the **Assignment** is the only binding, and it carries the scope. This keeps the model flexible (a user can be QA at Site A and Lab at Site B) and keeps the audit of "who could do what where" precise.
- **Seed (DEMO/TEST):** 3 demo sites (e.g., `CH-01`, `FR-01`, `TN-01`), a few departments each, all flagged `isDemo: true`. Clearly labelled. No real Circum site data invented.

---

## 8. Multi-site isolation

**Constraint:** SQLite has no row-level security (RLS). PostgreSQL does (via policies). The isolation strategy must work on SQLite today and harden on PostgreSQL tomorrow.

**Phase 1 approach (SQLite):** isolation is enforced at the **repository layer**. Every repository method that reads/writes site-scoped data accepts a `Scope` (derived from `AuthContext.resolvedSites`) and **always** appends `WHERE siteId IN (...)` (or the equivalent join). A `SiteScope` helper centralizes this so no repository can "forget" the filter. A lint/test rule asserts every site-scoped repository call passes a scope.

**`AuthContext.resolvedSites`:** the set of Site IDs the user may act within, derived from assignments. `null`/empty handling:
- If the user has a `siteId IS NULL` assignment (Super Admin) → `resolvedSites = "*"` (all); repositories special-case `*` to skip the filter (audited).
- Otherwise → explicit list; repositories filter to it.

**PostgreSQL path (ADR-0002):** when PG lands, add RLS policies keyed on `current_setting('app.site_scope')` (set per request from `AuthContext`). The repository-layer filter stays as defense-in-depth; RLS becomes the DB-level backstop. No application code change required — only a migration adding policies + a per-request `SET LOCAL`.

**Cross-site data leakage is a critical defect** (PRD §10 "data integrity"). The test plan (§20) includes explicit cross-site isolation tests: a user scoped to Site A must receive 0 rows from Site B for every site-scoped endpoint.

---

## 9. Audit architecture

**Store:** `AuditEvent` table (append-only). 

**Capture points (Phase 1):**
- `identity.session.signin` (success/failure), `identity.session.signout`
- `identity.user.create/update/disable/reset-password`
- `identity.role.create/update/assign-permission`
- `identity.assignment.create/delete`
- `org.site.create/update/deactivate`
- `org.department.create/update/deactivate`
- `authorization.denied` (any `can()` failure) — critical for auditors

**Fields (PRD §13):** `actorUserId`, `action`, `entityType`, `entityId`, `previousState` (JSON snapshot before), `newState` (JSON snapshot after), `reason` (free-text, required for sensitive actions), `outcome` (SUCCESS/FAILURE/DENIED), `sessionId`, `ipAddress`, `userAgent`, `occurredAt`.

**Immutability (PRD §10/§13 "normal users cannot edit/delete audit history"):**
- **Repository layer:** the `AuditEventRepository` exposes only `create()` and `read()` — no `update()`/`delete()`. This is a code-level invariant enforced by the interface shape + code review.
- **DB layer (SQLite):** add a `CREATE TRIGGER ... BEFORE DELETE / UPDATE ON AuditEvent` that raises an error, preventing any direct DB mutation even by a future buggy path. (SQLite supports `RAISE(ABORT)` triggers.) Documented in ADR.
- **Super-admin carve-out:** only a documented, audited **purge/archival** operation (Phase 13, retention policy) may touch historical audit rows, and even then via a one-off script with its own audit record. Not exposed as an API in Phase 1.

**Read access:** `audit.read` permission (Auditor, Quality Manager, Super Admin). Queryable by actor, entity, action, time range. Export (`audit.export`) produces a tamper-evident CSV (sequential numbering + row hashes) for regulatory review — Phase 1 implements a basic export; full tamper-evidence hashing is refined in Phase 13.

**Performance:** indexed on `(occurredAt)`, `(actorUserId)`, `(entityType, entityId)`, `(action)`. Archive strategy (Phase 13) moves cold events to cold storage.

---

## 10. API design

**Convention:** REST-ish route handlers under `src/app/api/`, thin — they parse/validate with zod, delegate to a service, and return a consistent envelope. No business logic in handlers (PRD §11).

**Envelope:**
```ts
// success
{ "data": T, "meta"?: { page, pageSize, total } }
// error (RFC 7807-ish)
{ "error": { "code": "string", "message": "string", "details"?: object } }
```
HTTP status codes: 200, 201, 204, 400 (validation), 401 (unauth), 403 (forbidden — also emits `authorization.denied` audit), 404, 409 (conflict/duplicate), 422 (state-transition invalid), 429 (rate-limited), 500.

**Phase 1 endpoints (i18n-aware via `[locale]` on pages, not on `/api`):**

```
POST   /api/auth/callback/credentials        (next-auth)
POST   /api/auth/signout                      (next-auth)
GET    /api/auth/session                      (next-auth)

GET    /api/identity/users                    (list, site-scoped, paginated)
POST   /api/identity/users                    (create)
GET    /api/identity/users/:id
PATCH  /api/identity/users/:id                (update profile)
POST   /api/identity/users/:id/disable
POST   /api/identity/users/:id/reset-password
POST   /api/identity/users/:id/assignments    (grant role in scope)

GET    /api/identity/roles
GET    /api/identity/permissions              (catalog)
PATCH  /api/identity/roles/:id                (edit grants)

GET    /api/org/sites
POST   /api/org/sites
GET    /api/org/sites/:id
PATCH  /api/org/sites/:id
GET    /api/org/sites/:id/departments
POST   /api/org/departments

GET    /api/audit/events                      (filter: actor, entity, action, from, to)
GET    /api/audit/events/export               (CSV)
```

**Validation:** every handler defines a zod schema for params + body; rejects on invalid (400). No `any` at the boundary.

**Idempotency:** create endpoints accept an optional `Idempotency-Key` header (Phase 1: stored in a small table or memoized) to prevent duplicate creates on retry — relevant for audit-grade correctness (PRD §10). (Phase 1 implements for user/create + assignment/create; full idempotency framework is Phase 13.)

**Rate limiting:** in-memory token bucket on auth + write endpoints (local-first; no Redis). Keyed by IP + userId where available.

---

## 11. UI architecture

**Routing (App Router):**
```
src/app/
  [locale]/                  # next-intl segment: en | fr | ar
    (auth)/
      sign-in/page.tsx       # localized sign-in
      sign-out/page.tsx
    (app)/                   # authenticated shell
      layout.tsx             # sidebar + topbar + sticky footer + ThemeProvider + QueryProvider
      page.tsx               # dashboard landing (KPI placeholders; Phase 11 fills real KPIs)
      identity/
        users/page.tsx       # list + create + assignments
        roles/page.tsx
      organization/
        sites/page.tsx
        departments/page.tsx
      audit/
        events/page.tsx      # filterable audit log
      settings/page.tsx      # locale, theme (user prefs)
  api/...                    # (see §10)
  layout.tsx                 # root: <html>, fonts, NextIntlClientProvider, SessionProvider, Toaster
  globals.css                # + RTL rules
middleware.ts                # locale negotiation + auth + RBAC
```

**Shell components:** `AppSidebar` (module navigation, site switcher for multi-site users), `AppTopbar` (user menu, locale switcher, theme toggle, notifications bell), `AppFooter` (sticky, `mt-auto` per UI rules), `ThemeProvider` (next-themes, light/dark), `QueryProvider` (TanStack Query), `CommandPalette` (cmdk, for power users).

**i18n (next-intl v4):**
- `src/i18n/routing.ts` — locales `['en','fr','ar']`, default `en`, `localePrefix: 'always'`.
- `src/i18n/request.ts` — server message loader.
- `src/messages/{en,fr,ar}.json` — catalogs; structured by module (`identity.*`, `org.*`, `audit.*`, `common.*`).
- **RTL:** `<html dir={locale==='ar'?'rtl':'ltr'}>`. Tailwind logical properties (`ps-`/`pe-`/`ms-`/`me-`) for direction-aware spacing. Icon mirroring for directional icons in RTL. Tested with a real RTL render in the test plan.
- **No hard-coded user-facing strings** — all via `useTranslations()`/`getTranslations()`. ESLint rule (custom or `no-literal-strings`-ish) to enforce in Phase 1.

**Branding (Q9 — neutral industrial/medical):** retain the neutral shadcn palette; add a subtle "medical industrial" accent (slate/teal-leaning neutral, **not** indigo/blue per UI rules). Professional typography (Geist). Dense tables, clear status badges, KPI cards. Loading/empty/error states for every async surface. Motion subtle (framer-motion for view transitions only).

**Accessibility:** semantic HTML, ARIA on interactive widgets, keyboard navigation, `sr-only` labels, 44px touch targets, color contrast AA. RTL + LTR both tested.

**State:** TanStack Query for server state (users, roles, sites, audit); Zustand for ephemeral client state (sidebar collapse, command palette open). Forms via react-hook-form + zod resolver.

---

## 12. Security

- **Authn:** argon2id + pepper; DB sessions; lockout; rate-limit. (§5)
- **Authz:** 3-layer enforcement (UI/middleware/service); least privilege; site/department/module scope; denied-attempts audited. (§6, §8)
- **Input validation:** zod at every API boundary; strict TS (`noImplicitAny: true` to be re-enabled); React escapes by default (XSS baseline); no `dangerouslySetInnerHTML` without sanitization (none planned in Phase 1).
- **CSRF:** next-auth built-in for its routes; double-submit token + `SameSite=Lax` + origin check for app mutation routes.
- **Secrets:** `.env` only; `AUTH_PEPPER`, `NEXTAUTH_SECRET`, `DATABASE_URL`. `.env` is gitignored (already). No secrets in source. A `docs/operations/secrets.md` documents required env vars.
- **Headers:** `next.config.ts` `headers()` sets CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. HSTS when served over TLS (Phase 13 ops).
- **Session cookie:** `httpOnly`, `secure` (when TLS), `sameSite: 'lax'`, signed by `NEXTAUTH_SECRET`.
- **Audit:** §9 (every sensitive action + every denial).
- **Rate limiting:** §10 (in-memory).
- **Dependency hygiene:** `bun audit` in CI; no unpinned critical deps.
- **Threat model note:** Phase 1 threat model documented in `docs/architecture/threat-model-phase1.md` (STRIDE per surface: sign-in, session, RBAC, audit, multi-site). Produced during Phase 1 design via `grill-with-docs`.

---

## 13. Testing

**Stack (to add):** Vitest (unit/integration), Playwright (E2E), MSW (API mocking), `@testing-library/react`. Prisma test DB (a separate SQLite file under `db/test.db`, reset per run). `bun run test` + `bun run test:e2e` scripts.

**Conventions:** tests live next to source (`*.test.ts`) or in `__tests__/`; E2E in `tests/e2e/`. TDD via the `tdd` skill (red→green→refactor) for domain/state-machine/service logic. No test is deleted/weakened to make a build pass (PRD §15).

**Coverage target:** domain + service + RBAC-enforcement + audit layers ≥ 90% line coverage; UI ≥ 70%; E2E covers the golden paths. Coverage gated in CI.

---

## 14. Migration strategy

This section has two meanings; both are covered:

### 14a. SQLite → PostgreSQL (infrastructure migration, ADR-0002)

- **Now (Phase 1):** SQLite, schema written PG-portably (no SQLite-only types; enums as strings+zod; `Json` for snapshots; `DateTime` throughout). Adopt `prisma migrate dev` for versioned migrations (validation evidence).
- **When PG is available:** flip `datasource.provider` to `postgresql`, update `DATABASE_URL`, run `prisma migrate deploy` against an empty PG, then a one-time **data migration script** (`scripts/migrate-sqlite-to-postgres.ts`) copies rows with referential checks. Add RLS policies keyed on `app.site_scope`. Repository-layer scope filters stay as defense-in-depth.
- **Risk:** enum-as-string drift; mitigate with a zod schema that is the single source of truth for allowed values, shared by app + a migration validator.
- **No data loss:** the migration script is idempotent and transactional on the PG side; the SQLite source is read-only during cutover.

### 14b. Existing-project data migration (none needed)

The existing Prisma schema has only demo `User`/`Post` with no real data. Phase 1 **replaces** the schema (the demo `Post` model and its broken `authorId` are removed). `db:push --accept-data-loss` is acceptable here because there is no real data to preserve. This is called out in the Phase Validation Report.

---

## 15. Matt Pocock skills to use (Phase 1)

Deliberate selection (not blanket). Per ADR-0001, skills are subordinate to the PRD.

| Phase 1 activity | Skill | Why |
|---|---|---|
| Resolve any Phase-1 domain ambiguity (User-vs-Employee, Assignment scope semantics) | `grill-with-docs` (→ `grilling` + `domain-modeling`) | align before schema; updates `CONTEXT.md`/ADRs inline |
| Sharpen RBAC/audit terminology | `domain-modeling` | keep `CONTEXT.md`/`DOMAIN_GLOSSARY.md` authoritative |
| Design the identity module seams (repository/service/domain) | `codebase-design` | deep modules; logic not in UI |
| Turn this plan + grilling into a published spec | `to-spec` | writes `.scratch/phase-1/spec.md` |
| Break the spec into tracer-bullet tickets with blocking edges | `to-tickets` | writes `.scratch/phase-1/issues/NN-*.md` |
| Implement each ticket (auth, RBAC, audit, i18n, shell) | `tdd` + `implement` | red→green→refactor; closes with `code-review` |
| Debug any hard issue (e.g., next-auth + Prisma adapter quirk) | `diagnosing-bugs` | reproduce→minimise→hypothesise→instrument→fix→regression |
| Phase gate quality | `code-review` | Standards + Spec axes, parallel sub-agents |
| Deepen architecture after the build | `improve-codebase-architecture` | survey for deepening opportunities |
| Resolve merge conflicts if any | `resolving-merge-conflicts` | intent-traced |

**Not used in Phase 1:** `wayfinder` (reserved for Phase 10+ multi-session efforts), `triage` (no issue backlog yet beyond Phase 1 tickets), `prototype`/`wizard`/`research` (not needed).

---

## 16. Files / modules to change

**New (Phase 1 build):**
```
prisma/schema.prisma                              # REPLACE demo schema with Phase 1 schema (§4)
prisma/migrations/...                             # versioned migrations (adopt migrate dev)
prisma/seed.ts                                    # demo sites/departments/roles/permissions + 1 demo user per role
scripts/migrate-sqlite-to-postgres.ts             # future cutover (stub + doc)
src/i18n/routing.ts, src/i18n/request.ts
src/messages/{en,fr,ar}.json
src/lib/auth.ts                                   # next-auth config (providers, adapter, callbacks)
src/lib/auth.session-cache.ts                     # in-memory session cache
src/lib/auth.pepper.ts                            # argon2id + pepper
src/lib/rbac.ts                                   # can(), AuthContext, resolvedSites, Scope
src/lib/audit.ts                                  # audit() helper + AuditEventRepository (create/read only)
src/lib/site-scope.ts                             # SiteScope filter helper
src/lib/errors.ts, src/lib/api-envelope.ts, src/lib/zod-schemas.ts
src/lib/db.ts                                     # keep; env-gate query logging
src/modules/identity/{api,service,domain,infrastructure}/...
src/modules/organization/...
src/modules/audit/...
src/app/[locale]/(auth)/sign-in/page.tsx, sign-out/page.tsx
src/app/[locale]/(app)/layout.tsx, page.tsx
src/app/[locale]/(app)/identity/{users,roles}/page.tsx
src/app/[locale]/(app)/organization/{sites,departments}/page.tsx
src/app/[locale]/(app)/audit/events/page.tsx
src/app/[locale]/(app)/settings/page.tsx
src/app/api/identity/..., /api/org/..., /api/audit/...
src/app/layout.tsx                                # wire NextIntlClientProvider + SessionProvider + ThemeProvider
src/app/globals.css                               # RTL rules, industrial accent tokens
src/components/app/{app-sidebar,app-topbar,app-footer,command-palette,locale-switcher,theme-toggle,user-menu}.tsx
src/middleware.ts                                 # locale + auth + RBAC
docs/architecture/{auth-strategy,rbac-model,multi-site-isolation,audit-architecture,threat-model-phase1}.md
docs/architecture/rbac-matrix.md                  # role → permission defaults
docs/api/identity.md, docs/api/organization.md, docs/api/audit.md
docs/operations/secrets.md, docs/operations/env.md
docs/testing/phase-1-test-plan.md
docs/adr/0002-sqlite-to-postgresql-migration.md
docs/adr/0003-nextauth-db-sessions-over-jwt.md
docs/adr/0004-rbac-assignment-scoping-model.md
docs/adr/0005-audit-immutability-via-triggers.md
.scratch/phase-1/spec.md, .scratch/phase-1/issues/NN-*.md
vitest.config.ts, playwright.config.ts, tests/e2e/..., tests/setup.ts
```

**Modified (toolchain tightening — Phase 1 prep):**
```
next.config.ts        # ignoreBuildErrors:false, reactStrictMode:true, security headers()
eslint.config.mjs     # enforce real rules; keep ignoring skills/ + docs/agents/skills/
tsconfig.json         # noImplicitAny:true, target ES2022
package.json          # +test/test:e2e scripts; +deps (see §18)
.env.example          # document AUTH_PEPPER, NEXTAUTH_SECRET, DATABASE_URL
```

**Removed:**
```
src/app/api/route.ts              # the "Hello, world!" route (replaced by real /api/*)
src/app/page.tsx                  # logo page (replaced by [locale]/(app)/page.tsx)
```

---

## 17. Risks (Phase 1 specific)

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| P1-R1 | next-auth v4 + Prisma adapter + SQLite quirk (session/adapter edge cases) | M | H | spike early via `tdd`; pin versions; ADR-0003 records the chosen config |
| P1-R2 | Multi-site isolation leak via a forgotten repository call | M | Critical | `SiteScope` helper + lint/test asserting every site-scoped repo call passes scope; explicit cross-site E2E tests |
| P1-R3 | argon2id native build fails on bun | L | M | use `@node-rs/argon2` (prebuilt for the platform); fallback `argon2-browser` documented |
| P1-R4 | i18n/RTL retrofit cost if added late | M | H | wire in Phase 1 (this plan); RTL E2E test |
| P1-R5 | `ignoreBuildErrors` left on → type errors ship | H | H | turned off in Phase 1 prep; CI fails on TS errors |
| P1-R6 | Audit immutability bypassed by a future admin path | L | Critical | DB trigger + repository interface shape + code review; no delete API |
| P1-R7 | Super-admin global-scope grant misused | M | H | guarded at assignment-create; audited; default off |
| P1-R8 | Rate limiter (in-memory) doesn't survive multi-process | L | M | acceptable on single-process Next standalone; documented; PG/Redis path in Phase 13 |
| P1-R9 | SQLite write concurrency under load | L | M | WAL mode enabled; acceptable for LAN; PG cutover removes the ceiling |
| P1-R10 | Demo seed mistaken for real Circum data | L | H | every demo row `isDemo:true`; UI badges "DEMO/TEST" |
| P1-R11 | Owner can't review a huge PR | M | M | `to-tickets` breaks work into tracer-bullet slices; review per slice |

---

## 18. Dependencies (new packages to add)

```
@next-auth/prisma-adapter    # DB sessions for next-auth v4
@node-rs/argon2              # argon2id password hashing (native, bun-friendly)
vitest, @vitest/coverage-v8  # unit/integration test runner
@playwright/test             # E2E
msw                          # API mocking in tests
@testing-library/react, @testing-library/jest-dom  # component tests
```

All added via `bun add -d` (test deps) / `bun add` (runtime). No removals except the demo `Post` model. Versions pinned in `package.json`.

---

## 19. Acceptance criteria (definition of done for Phase 1)

Phase 1 is **DONE** only when ALL of the following hold (PRD §19 Phase Gate):

1. **Authn:** a user can sign in (FR/EN/AR), sign out; bad password is rejected + locked after 5 tries; sessions are DB rows and revocable; sign-in/out audited.
2. **RBAC:** the 18 roles + permission catalog are seeded; `can()` enforces permission + site/department/module scope at middleware AND service layers; a denied attempt returns 403 and emits an `authorization.denied` audit event.
3. **Organization:** Sites/Departments CRUD works; demo seed (3 sites) present and labelled; site-scoped lists respect the user's `resolvedSites`.
4. **Multi-site isolation:** cross-site isolation tests pass for every site-scoped endpoint (Site-A user sees 0 Site-B rows).
5. **Audit:** every Phase 1 sensitive action + every denial is recorded with PRD §13 fields; audit is read-only (update/delete rejected at DB via trigger); audit list + CSV export work with `audit.read`/`audit.export`.
6. **i18n/RTL:** all UI strings via catalogs; `ar` renders RTL correctly; locale persists per user.
7. **UI shell:** Circum-branded shell renders on mobile + desktop; sticky footer; light/dark; accessible (keyboard, ARIA, contrast).
8. **Security:** CSP/headers set; CSRF on mutations; secrets in env only; no `any` at API boundary; `bun run lint` + `tsc --noEmit` clean.
9. **Tests:** Vitest + Playwright green; coverage targets met; cross-site + audit-immutability + lockout + RTL E2E pass.
10. **Docs:** ADRs 0002–0005 written; `CONTEXT.md`/`DOMAIN_GLOSSARY.md` updated; API docs + secrets/env docs present; RBAC matrix present.
11. **Phase Validation Report** produced (PRD §20) with status PASS (or CONDITIONAL with documented owner-approved deviations).
12. **Owner approval** to advance.

A successful build/lint is **not** sufficient (PRD §17). Browser-verified interactivity via Agent Browser is required (sign-in flow, RBAC denial, audit log, RTL switch all exercised).

---

## 20. Test plan

**Layered matrix (mapped to acceptance criteria §19):**

| Layer | What | Examples | Tool |
|---|---|---|---|
| Unit (domain) | state machines, `can()`, `Scope` resolution, `AuthContext` derivation, zod schemas | User status transitions; assignment scope math; permission namespace parse | Vitest |
| Unit (service) | use-cases with mocked repos | createUser disables on bad input; resetPassword rotates hash + audits; assignment-create rejects global scope unless super_admin | Vitest + mocks |
| Integration (repo) | Prisma against test DB | cross-site filter; audit write-only; unique constraints; cascade rules | Vitest + test DB |
| Integration (API) | route handlers with MSW-less real service, mocked auth | 403 on missing perm; 401 unauth; 400 zod; 409 duplicate; envelope shape | Vitest + supertest-ish |
| Auth | next-auth flow | sign-in success/failure; lockout; session revocation; pepper applied | Vitest + Playwright |
| Authorization | `can()` + middleware | every endpoint's perm+scope enforced; denied audited | Vitest + Playwright |
| Audit | immutability | DB trigger rejects UPDATE/DELETE on AuditEvent; every sensitive action recorded with prev/new state | Vitest (trigger) + E2E |
| Multi-site isolation | cross-site | Site-A user GET /api/org/sites excludes Site-B; GET /api/identity/users excludes Site-B users | E2E + API |
| UI | components | sidebar nav by permission; locale switcher; theme toggle; RTL layout; forms validate | RTL + Vitest |
| E2E (golden paths) | full browser | sign-in → see only authorized modules → open audit → switch to AR/RTL → sign out, audited | Playwright + Agent Browser |
| Regression | prior behavior | re-run suite on every slice; no skipped/deleted tests | CI |
| Security | headers, CSRF, secrets | CSP present; mutation blocked without CSRF token; no secret strings in bundle | Vitest + Playwright |

**Specific must-pass tests (critical-defect prevention):**
- T-ISOL-01: user scoped to Site A receives empty list for Site-B-only resources on every site-scoped endpoint.
- T-AUDIT-01: direct `DELETE FROM AuditEvent` is rejected by trigger.
- T-AUDIT-02: a denied `can()` emits an `authorization.denied` event with actor+action+ip.
- T-LOCK-01: 5 bad passwords lock the account for 15 min; 6th attempt rejected even with correct password.
- T-RBAC-01: Operator role cannot access `/api/identity/users` (403 + audited).
- T-I18N-01: Arabic locale renders `dir="rtl"` and all visible strings translated; no hard-coded English.
- T-PEPPER-01: changing `AUTH_PEPPER` invalidates all existing password verifications (pepper is applied).

---

```
PHASE 1 PLAN STATUS: WAITING FOR OWNER APPROVAL
```

**I am stopping here.** I will not implement Phase 1, will not create tickets under `.scratch/phase-1/` beyond this plan, and will not begin the toolchain tightening or schema changes until the owner approves this plan. Awaiting your approval and any adjustments to scope, the RBAC matrix defaults, the demo seed, or the SQLite→PostgreSQL sequencing.
