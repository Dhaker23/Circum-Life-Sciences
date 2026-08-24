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
