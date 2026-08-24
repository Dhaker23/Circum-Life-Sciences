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
