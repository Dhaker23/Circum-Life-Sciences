# Circum — Project Worklog

Shared handover document. Each agent appends a section starting with `---`. Do not overwrite.

---
Task ID: 0
Agent: main-orchestrator (Z.ai Code)
Task: CIRCUM Phase 0 — configure/verify Matt Pocock Skills environment, then perform Phase 0 Project Discovery ONLY. STOP and wait for owner approval. Do not start Phase 1.

Work Log:
- Read `upload/CIRCUM_MASTER_PRD_FINAL.md` and `upload/CIRCUM_GLM5.2_MASTER_PROMPT_FINAL.md` (authoritative sources of truth).
- Verified environment capability: terminal/bash ✅, Node v24.18.0 ✅, npm/npx 11.16.0 ✅, bun 1.3.14 ✅, git 2.47.3 ✅, GitHub reachable ✅, npm registry reachable ✅.
- Inspected existing project at `/home/z/my-project`: Next.js 16.1.3 Z.ai Code scaffold. Prisma schema = demo `User`+`Post` only (SQLite at `db/custom.db`). `next-auth` v4 + `next-intl` v4 installed but unconfigured. No tests, no Docker, no docs, no Circum domain. `next.config.ts` has `ignoreBuildErrors:true` + `reactStrictMode:false`. `eslint.config.mjs` disables ~all rules. Git: 1 commit, no remote, ~all files untracked. Dev server runs clean on :3000 (logo page). `skills/` dir = Z.ai platform skills (NOT Matt Pocock).
- Attempted `npx skills@latest add mattpocock/skills` — installer's internal clone exceeded sandbox execution deadline. Installed `skills@1.5.23` as devDep; the `add --list` command also exceeded deadline.
- Achieved equivalent install via shallow `git clone --depth 1 https://github.com/mattpocock/skills /tmp/mp-skills` (2.0M) — the documented "tinkerer" route (owned editable skill files).
- Installed 25 Matt Pocock promoted skills (18 `engineering/` + 7 `productivity/`) into `docs/agents/skills/`. Includes `setup-matt-pocock-skills`.
- Ran `setup-matt-pocock-skills` (prompt-driven): explored repo (no git remote, no CLAUDE.md/AGENTS.md, no CONTEXT.md, no docs/adr/, no .scratch/, triage available, no monorepo signals → single-context). Wrote `docs/agents/issue-tracker.md` (local-markdown), `docs/agents/domain.md` (single-context + Circum PRD-supremacy rule), `docs/agents/triage-labels.md` (5 default labels). Deferred root agent file choice (CLAUDE.md vs AGENTS.md) to owner per the skill's "don't pick for them" rule.
- Seeded domain model via `domain-modeling` discipline: `CONTEXT.md` (concise ubiquitous language + relationships + flagged ambiguities) and `DOMAIN_GLOSSARY.md` (detailed medical-device/QMS definitions + controlled-workflow state machines + AI-governance reminder). All terms extracted authoritatively from the PRD; nothing invented.
- Created `docs/adr/0001-adopt-matt-pocock-skills.md` (decision: adopt as engineering-process toolkit, subordinate to PRD; conflict rule STOP→identify→propose→wait).
- Created `docs/PRD/PHASE-0-DISCOVERY-REPORT.md` covering all 23 required sections + `PHASE 0 STATUS: WAITING FOR OWNER APPROVAL`.
- Created `docs/{architecture,validation,testing,operations,api,user-guides}/` and `.scratch/` directories (PRD §16 doc tree).
- Did NOT implement any features. Did NOT create an autonomous development cron (conflicts with PRD "never advance automatically" — surfaced as Open Question #5).

Stage Summary:
- **Matt Pocock skills environment: INSTALLED + CONFIGURED** (25 skills at `docs/agents/skills/`; repo config at `docs/agents/`; domain seed at `CONTEXT.md` + `DOMAIN_GLOSSARY.md`; ADR-0001).
- **Existing project verdict:** fresh Next.js 16 Z.ai scaffold; ~0% of Circum PRD scope implemented; base stack is PRD-aligned but DB (SQLite vs PRD-preferred PostgreSQL), toolchain discipline (`ignoreBuildErrors`, permissive eslint), tests, auth, i18n, docs are all missing/weak.
- **Phase 0 report produced** at `docs/PRD/PHASE-0-DISCOVERY-REPORT.md` with 23 sections + 9 open questions.
- **Key open questions for owner:** Q1 root agent file (CLAUDE.md vs AGENTS.md); Q4 database (SQLite vs PostgreSQL — structural conflict with host "SQLite-only" rule); Q5 auto-cron (host "15-min webDevReview" rule vs Circum "never advance automatically" — I did NOT create it; recommendation: none); Q3 CONTEXT/GLOSSARY split; Q6 domain ambiguities for `/grill-with-docs`.
- **Status:** `PHASE 0 STATUS: WAITING FOR OWNER APPROVAL`. STOPPED. Not starting Phase 1.

Unresolved issues / risks (priority for next phase):
1. **[Blocker]** Owner decision on Q4 (database) and Q5 (auto-cron) before any Phase 1 prep.
2. **[High]** Tighten `next.config.ts` (`ignoreBuildErrors:false`, `reactStrictMode:true`) and `eslint.config.mjs`; stand up Vitest+Playwright test runner — before Phase 1 features.
3. **[High]** Resolve domain ambiguities (lot/release/deviation-vs-ncr/batch-vs-device-lot/multi-site isolation) via `/grill-with-docs` before Phase 2 schema work.
4. **[Medium]** Commit Phase 0 artifacts to git; decide on remote.
5. **[Medium]** Wire next-intl i18n skeleton (FR/EN/AR+RTL) and next-auth in Phase 1.

---
Task ID: 0-closure + 1-plan
Agent: main-orchestrator (Z.ai Code)
Task: Phase 0 owner decisions approved. Close Phase 0 housekeeping + produce the CIRCUM PHASE 1 IMPLEMENTATION PLAN. Do NOT implement Phase 1. STOP and wait for owner approval.

Work Log:
- Received owner Phase 0 decisions: Q1 CLAUDE.md; Q3 keep CONTEXT+GLOSSARY; Q4 PostgreSQL if env supports else SQLite fallback; Q5 NO autonomous cron; Q6 grill ambiguities before Phase 2; Q7 commit, no remote; Q8 default triage labels; Q9 neutral industrial/medical visual.
- Verified PostgreSQL availability: NOT available (no psql/postgres binaries, no 5432 listener, only libpq5 client libs; host rule = "SQLite client only"). Per owner's Q4 fallback clause, SQLite remains temporary. Surfaced as constraint, not silently accepted. Wrote ADR-0002 (SQLite→PostgreSQL migration path: PG-portable schema, adopt prisma migrate dev, cutover script, RLS policies when PG lands).
- Created CLAUDE.md (root agent file) with: Circum context, authority hierarchy (PRD > ADRs > skills), priority order, operating principles, phase-gate rule, controlled-records rule, local-first rule, environment constraints (SQLite-only, NO autonomous cron, AI SDK backend-only), and the `## Agent skills` block (issue-tracker/domain/triage-labels pointers) per setup-matt-pocock-skills template. Completes the setup-matt-pocock-skills flow (Q1).
- Updated docs/PRD/PHASE-0-DISCOVERY-REPORT.md §23: marked all 9 open questions RESOLVED with the owner's decisions and the PostgreSQL-availability finding.
- Produced docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md (20 sections as requested): objectives, requirements (PRD traceability), domain entities, full Prisma schema (SQLite, PG-portable: User/Role/Permission/RolePermission/Assignment/Site/Department/Account/Session/VerificationToken/AuditEvent), authentication (next-auth v4 + Prisma adapter DB sessions + argon2id + pepper + lockout), RBAC (3-layer enforcement, 18 seeded roles, permission catalog, Assignment scoping), org/site/department model, multi-site isolation (repository-layer SiteScope + future RLS), audit architecture (append-only + DB trigger immutability), API design (REST envelope + endpoints), UI architecture ([locale] routing + FR/EN/AR RTL + Circum shell), security (CSP/CSRF/secrets/headers), testing (Vitest+Playwright+MSW), migration strategy (SQLite→PG + demo-schema replacement), Matt Pocock skills mapping (grill-with-docs/domain-modeling/codebase-design/to-spec/to-tickets/tdd/implement/diagnosing-bugs/code-review/improve-codebase-architecture), files/modules to change, risks (11), dependencies (@next-auth/prisma-adapter, @node-rs/argon2, vitest, playwright, msw, testing-library), acceptance criteria (12-point DoD), test plan (layered matrix + 7 critical-defect-prevention tests).
- Committed: commit 5dddca3 "Phase 0 closure + Phase 1 implementation plan" (4 files, +844/-9). No remote added (Q7). Note: host environment had auto-committed the bulk of Phase 0 artifacts earlier (commit 8f75535).
- Did NOT implement Phase 1. Did NOT create tickets under .scratch/phase-1/ beyond the plan. Did NOT touch next.config.ts / eslint / schema / test runner (those are Phase 1 execution, gated on plan approval). Did NOT create any autonomous cron (Q5).
- Verified lint clean (exit 0) after doc-only changes.

Stage Summary:
- **Phase 0: CLOSED.** All owner decisions applied. CLAUDE.md created; ADR-0002 written; open questions resolved; committed.
- **Phase 1 Implementation Plan: PRODUCED** at docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md (20 sections, production-grade spec). Covers identity/org/RBAC/auth/audit/i18n/security/testing/migration with PRD traceability, concrete Prisma schema, API endpoints, UI routes, skills mapping, risks, dependencies, 12-point acceptance criteria, and a layered test plan.
- **Key environment constraint surfaced:** PostgreSQL is NOT available in this sandbox → SQLite (temporary, owner-approved) with a documented PG-portable schema + cutover script (ADR-0002).
- **Status:** `PHASE 1 PLAN STATUS: WAITING FOR OWNER APPROVAL`. STOPPED. Not implementing Phase 1.

Unresolved issues / risks (priority for next phase):
1. **[Blocker]** Owner approval of the Phase 1 Implementation Plan before any execution.
2. **[High, on approval]** Phase 1 prep: tighten next.config.ts (ignoreBuildErrors:false, reactStrictMode:true) + eslint.config.mjs + tsconfig (noImplicitAny:true); add test deps + scripts; these are the first execution slices.
3. **[High]** ADRs 0003 (next-auth DB sessions over JWT), 0004 (RBAC assignment scoping), 0005 (audit immutability via triggers) to be written during Phase 1 design (referenced by the plan).
4. **[Medium]** Owner review of the proposed default RBAC matrix (18 roles → permission grants) and the demo seed (3 sites) before seeding.
5. **[Medium]** Confirm User-vs-Employee distinction (flagged in plan §3) — may need a quick grill-with-docs during Phase 1 design.

---
Task ID: s1
Agent: adr-writer (subagent)
Task: Write Phase 1 ADRs 0003-0005 + RBAC matrix doc

Work Log:
- Read context before writing: worklog.md, CLAUDE.md, CONTEXT.md, DOMAIN_GLOSSARY.md, docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md (sections 5, 6, 8, 9, 17, 20 in particular), docs/adr/0001 and 0002, and the domain-modeling ADR-FORMAT skill. Confirmed the Phase 1 plan already references ADRs 0003/0004/0005 by name and the rbac-matrix.md path, so these docs are the deferred design records called for by the plan and the prior worklog's risk item #3.
- Wrote docs/adr/0003-nextauth-db-sessions-over-jwt.md (Accepted, Phase 1): database sessions via @next-auth/prisma-adapter over JWT; opaque token; maxAge 8h / updateAge 1h; in-memory LRU session cache (TTL ~30s) to mitigate the per-request DB read (PRD §11 allows local memory caching); Credentials provider, argon2id (OWASP params) + AUTH_PEPPER; lockout after 5 failures for 15 min; in-memory IP+email rate limiting; every sign-in (success+failure) and sign-out audited; OIDC reserved for future SSO, not enabled (local-first, PRD §12). Rejected alternatives: JWT (no revocation, weak audit link), external IdP now (breaks local-first), custom session table (reinvents security-critical code). Ends with a compliance note (infrastructure control, not a Part 11 claim, PRD §17).
- Wrote docs/adr/0004-rbac-assignment-scoping-model.md (Accepted, Phase 1): permission keys namespaced <module>.<resource>.<action> as a system-defined catalog (not user-editable); 18 PRD roles seeded isSystem:true; Assignment = unit of least-privilege binding User to Role within Scope {siteId?, departmentId?, moduleScope?}; multiple assignments per user, union of active (status=ACTIVE, within validFrom/validUntil); 3-layer enforcement (UI = usability only, NOT authorization; API/middleware requirePermission early-reject; service/domain can() authoritative); can() semantics for site/department scope matching with super-admin global carve-out (siteId IS NULL requires super_admin, enforced at assignment-create); authorization.denied audit on every failure; default grants intentionally narrow (Auditor read-only, Executive Viewer dashboards-only, Operator self-profile-only), no broad admin perms for dev convenience. Rejected: role-only without scope, permissions-on-user, ABAC now, single-layer enforcement. References the rbac-matrix.md. Ends with compliance note.
- Wrote docs/adr/0005-audit-immutability-via-triggers.md (Accepted, Phase 1): AuditEvent append-only; AuditEventRepository interface exposes only create() and read() (no update/delete); DB-level enforcement on SQLite via BEFORE UPDATE and BEFORE DELETE triggers calling SELECT RAISE(ABORT, 'AuditEvent is append-only: ...'); portable PostgreSQL equivalent documented (function raising EXCEPTION + triggers, plus REVOKE as defense-in-depth); purge/archival carve-out is operator-run, versioned script only (not an API in Phase 1), manages trigger disable/enable within a transaction and writes its own audit.purge event; full PRD §13 field set (actorUserId ON DELETE SET NULL so audit outlives user deletion, previousState/newState JSON, reason, outcome SUCCESS/FAILURE/DENIED, sessionId, ipAddress, userAgent, occurredAt); Phase 1 capture points enumerated (session, user/role/assignment CRUD, site/department CRUD, authorization.denied). Rejected: app-only enforcement, soft-delete flag, separate append-only store now, REVOKE-only (not portable to SQLite). Maps to tests T-AUDIT-01 (DELETE rejected) and T-AUDIT-02 (denied emits authorization.denied). Ends with compliance note (immutability control, not full Part 11 claim).
- Wrote docs/architecture/rbac-matrix.md: a 19-row x 7-group matrix (identity.users, identity.roles, identity.assignments, org.sites, org.departments, audit, session) with an action-token legend (R/C/U/D/A/X/dis/rp/ap/deact/rev), per-role scope qualifiers, per-role notes, the Phase 1 permission-key catalog, the 3-layer enforcement + multi-site isolation summary, the "defaults not hard-coding" note, the later-phase extension convention (<module>.<resource>.<action> extends unchanged; Phase 1 groups are the trust foundation and are not re-granted), and a note flagging the PRD 18-vs-19 role count discrepancy as a documentation item to confirm with the owner. Least-privilege defaults applied per the owner constraint: Super Administrator is the only global-scope role; Site Administrator is scoped to own site with no audit delete/export and no global grants; Auditor is read-only everywhere with audit.export; Executive Viewer has no Phase 1 grants (dashboard module ships later); no broad admin perms for convenience.
- Verified no em-dashes in prose across all four files (grep for U+2014/U+2013); the only em-dash usage is the literal cell token "—" in the RBAC matrix table, which the task spec defines explicitly as the "no permission" marker. No application source, schema, or test code was written; no existing files were modified other than creating these four new files and appending this worklog entry.
- Lint not run (markdown only; no source touched). No git commit performed (subagent; orchestrator owns commits).

Stage Summary:
- **Files created (4):**
  - docs/adr/0003-nextauth-db-sessions-over-jwt.md (database sessions + cache + argon2id/pepper + lockout; OIDC deferred)
  - docs/adr/0004-rbac-assignment-scoping-model.md (Assignment+Scope model, 3-layer enforcement, super-admin global guard, denial auditing)
  - docs/adr/0005-audit-immutability-via-triggers.md (append-only repo + SQLite RAISE(ABORT) triggers + PG equivalent + purge carve-out + PRD §13 fields)
  - docs/architecture/rbac-matrix.md (19-role x 7-group default matrix + legend + scope notes + extension convention)
- **Key decisions recorded:** (a) DB sessions over JWT for revocability + audit link; (b) Assignment as the unit of least-privilege with 3-layer enforcement where UI-hiding is explicitly NOT authorization; (c) audit immutability at both the repository-interface shape AND the DB trigger level (defense-in-depth against buggy paths and direct DB access); (d) least-privilege defaults with no broad admin grants for convenience; (e) the <module>.<resource>.<action> convention extends to later-phase modules without structural change.
- **Surfaced (not blocking):** the PRD §3 / DOMAIN_GLOSSARY §1 "18 roles" count actually enumerates 19 distinct names; flagged in the matrix doc as a documentation item for owner confirmation. Does not affect the model, seed, or enforcement.
- **Next actions (for orchestrator):** these ADRs unblock Phase 1 execution slices for auth (slice: next-auth DB session wiring), RBAC (slice: permission catalog + Assignment + can() + middleware guard), and audit (slice: AuditEvent model + repository + trigger migration). The rbac-matrix.md is the seed spec for the RolePermission seed migration. Consider committing the four docs together.

---
Task ID: s0-s10 (Phase 1 implementation)
Agent: main-orchestrator (Z.ai Code) + adr-writer subagent (s1)
Task: Execute Phase 1 (Identity/Org/RBAC/Auth/Audit/i18n/Shell) under mandatory Phase Gate. to-spec -> to-tickets -> TDD -> implement -> tests -> code-review -> validation. STOP. No Phase 2.

Work Log:
- Slice 0 (foundation): installed deps (@next-auth/prisma-adapter, @node-rs/argon2, vitest, playwright, msw, testing-library); tightened next.config.ts (ignoreBuildErrors:false, reactStrictMode:true, security headers), eslint.config.mjs (prefer-const/no-debugger/no-unreachable errors, no-explicit-any/no-unused-vars warnings), tsconfig.json (noImplicitAny:true, ES2022); added vitest.config.ts, playwright.config.ts, tests/setup.ts, tests/mocks/server.ts, .env.example; generated real NEXTAUTH_SECRET + AUTH_PEPPER in .env; added test/typecheck/db:seed scripts.
- Slice 0b (to-spec/to-tickets): wrote .scratch/phase-1/{spec.md,tickets.md} (14 tracer-bullet tickets T01-T14).
- Slice 1 (ADRs, subagent): ADR-0003 (next-auth sessions), ADR-0004 (RBAC scoping), ADR-0005 (audit immutability), docs/architecture/rbac-matrix.md (19 roles x permission groups, least-privilege). Flagged 18-vs-19 roles count (PRD lists 19 names incl. Super Admin); seeded all 19.
- Slice 2 (schema): full Prisma schema (User, Employee separate from User per owner #4, Role, Permission, RolePermission, Assignment, Site, Department, Account, Session, VerificationToken, AuditEvent). prisma migrate dev -> migration 20260824235927_phase1_init. Appended SQLite triggers (audit_no_update/audit_no_delete RAISE ABORT) + WAL. Verified T-AUDIT-01 via scripts/verify-audit-triggers.ts (UPDATE+DELETE rejected).
- Slice 3+4 (seed): prisma/seed.ts -> 24 permissions, 19 system roles, least-privilege RolePermission grants (no broad admin perms), 3 DEMO sites (CH/FR/TN, isDemo), 13 departments, 6 demo users (one per representative role, scoped), 5 demo employees (some linked to User, some not). All DEMO/TEST labelled.
- Slice 5 (core lib): src/lib/{auth.ts (next-auth JWT+DB hybrid after v4 Credentials constraint), auth.password.ts (argon2id+pepper), auth.lockout.ts (5/15min + rate limiter), auth-context.ts (getAuthContext/requireAuthContext/requirePermission), rbac.ts (can/authorize/buildAuthContext/Scope/AuthContext), audit.ts (create/read ONLY, exportAuditEventsCsv), site-scope.ts (SiteScope/assertSiteAccess), errors.ts, api-envelope.ts, zod-schemas.ts, permissions.ts (catalog)}.
- Slice 6 (modules): src/modules/{identity,organization,audit}/service/index.ts — repos take SiteScope, services call can()+audit(), 3-layer enforcement.
- Slice 7 (API): /api/{auth/[...nextauth], me, identity/*, org/*, audit/*} — zod-validated, envelope, requirePermission-guarded. Removed Hello-World route. middleware.ts (locale+auth+RBAC, API returns 401 JSON not redirect).
- Slice 8 (i18n+shell): next-intl (routing.ts, request.ts), messages/{en,fr,ar}.json, [locale]/layout.tsx (html/body + setRequestLocale + dir), LocaleDirection client component (syncs dir/lang on locale switch), providers.tsx (SessionProvider+ThemeProvider+QueryClientProvider), app/{app-sidebar,app-topbar,theme-toggle,users-table}.tsx, sign-in page, (app)/layout.tsx (shell+sticky footer), dashboard (KPI cards), users/roles/sites/departments/audit/settings pages.
- Slice 9 (tests): tests/integration/critical-tests.test.ts — 17 tests covering all 7 critical tests (T-AUDIT-01/02, T-ISOL-01, T-LOCK-01, T-PEPPER-01, T-RBAC-01, T-SESSION-01, T-I18N-01). ALL PASS.
- Slice 10 (gate): lint 0 errors (37 warnings, mostly pre-existing shadcn any), typecheck clean, 17/17 tests pass, browser-verified (agent-browser): sign-in admin -> dashboard -> users (6 demo) -> audit (identity.session.signin events + append-only notice) -> Arabic RTL switch (dir=rtl lang=ar) -> screenshot saved. Updated ADR-0003 with JWT+DB hybrid implementation note. Wrote docs/PRD/PHASE-1-VALIDATION-REPORT.md (CONDITIONAL PASS) + docs/operations/secrets.md.
- Committed: ef6215c "Phase 1: Identity, Organization, RBAC, Auth, Audit, i18n, App Shell".

Key issues resolved during build:
- next-auth v4 Credentials requires JWT strategy (not database) -> JWT+DB hybrid: Session row created on sign-in, session() callback validates against DB every request (revocable+auditable, ADR-0003 updated).
- next-intl getLocale() in root layout ran before setRequestLocale -> moved html/body to [locale]/layout.tsx.
- RolePermission select on 'key' failed (key on Permission not join) -> nested include + normalize.

Stage Summary:
- **Phase 1: IMPLEMENTED + VALIDATED.** Identity, Organization, RBAC (19 roles, 24 perms, 3-layer), Auth (argon2id+pepper+lockout, JWT+DB hybrid revocable sessions), Multi-site isolation (SiteScope+assertSiteAccess), Audit (append-only DB triggers), i18n (FR/EN/AR+RTL), App shell. 17/17 critical tests PASS. Browser-verified. ADRs 0003-0005 + RBAC matrix + validation report.
- **Status:** CONDITIONAL PASS. PHASE 1 GATE STATUS: READY FOR OWNER REVIEW. STOPPED. Not starting Phase 2.
- **Known limitations (Phase 13 hardening):** audit site-scoping for non-global users is best-effort; in-memory rate limiter is per-process; session cache deferred; CSRF double-submit token deferred; idempotency-key deferred; Playwright E2E suite configured but only Vitest critical tests populated (manual browser verification done); SQLite temporary (PG migration required before prod per ADR-0002).
- **No autonomous cron created** (owner #5). **No Phase 2 functionality** (owner #11). **No broad admin perms** (owner #1). **User != Employee** (owner #4). **Audit append-only tested** (owner #6). **Cross-site isolation tested** (owner #5).

Unresolved issues / risks (priority for next phase):
1. **[Blocker]** Owner approval of Phase 1 Validation Report before Phase 2.
2. **[High, before production]** PostgreSQL migration (ADR-0002) — environment doesn't support PG; must occur before prod-critical operation.
3. **[Medium]** Codify the manual browser golden path as a Playwright spec (T13 partial).
4. **[Medium]** Rename middleware.ts -> proxy.ts (Next 16 deprecation, non-breaking).
5. **[Low]** Address 37 ESLint warnings (mostly pre-existing shadcn any in ui/*).
