# Circum — CLAUDE.md

> Root agent instructions for the Circum Life Sciences platform. This file is the single entry point for any coding agent working in this repo. It is **not** a spec; for product scope see `docs/PRD/`, for domain language see `CONTEXT.md` + `DOMAIN_GLOSSARY.md`, for decisions see `docs/adr/`.

## What Circum is

Circum is a **Medical Device Manufacturing & Quality Management (QMS) Platform** for a regulated CDMO environment. It is **validation-minded, local-first, multilingual (FR/EN/AR+RTL), and audit-ready**. The authoritative product requirements live in `docs/PRD/CIRCUM_MASTER_PRD_FINAL.md` (copied from `upload/`).

## Authority hierarchy (non-negotiable)

1. **Circum Master PRD** (`docs/PRD/`) — primary source of truth.
2. **Approved ADRs** (`docs/adr/`).
3. **Matt Pocock skill guidance** (`docs/agents/skills/`) — engineering-process discipline only.

If a skill's output conflicts with an approved Circum requirement (especially controlled-workflow, traceability, or data-integrity requirements): **STOP → identify the conflict → propose a resolution → wait for owner approval.** Never let a skill weaken a controlled quality process.

## Priority order (PRD §1, §8)

**Safety > Quality > Traceability > Data Integrity > Controlled Workflows > Validation Evidence > Security > Operational Efficiency > Lean/OEE/VSM > AI.**

No AI feature, dashboard, or UI shortcut may bypass a controlled quality process. **AI must never** release product, approve batch disposition, close CAPA, close critical problems, approve deviations/changes/documents, modify validated parameters, override specifications, delete quality records, or fabricate evidence. Human approval is mandatory; core factory workflows must continue when AI is unavailable.

## Operating principles (PRD §26)

Correctness over speed. Evidence over assumptions. Small controlled changes over giant changes. Tests over hope. Domain language over vague terminology. Controlled workflows over shortcuts. Human approval over autonomous quality decisions.

## How to work here

- **Read before you code:** `CONTEXT.md`, `DOMAIN_GLOSSARY.md`, relevant `docs/adr/`, and the active phase's report under `docs/PRD/`.
- **Phase gates are mandatory (PRD §19/§23):** every phase ends with Build → Unit → Integration → API → DB → Auth → Workflow → UI → EEE → Regression → Security/Data-integrity/Audit/Domain/Code/Performance/Browser reviews → Fix → Retest → Final regression → Phase Validation Report → STOP → owner approval. **Never advance automatically.**
- **Domain language:** name variables/functions/files using the terms in `CONTEXT.md`. If a term is missing or ambiguous, flag it for `/grill-with-docs` rather than inventing one.
- **Controlled records:** every controlled entity carries unique ID, status, owner, evidence, approval history, audit trail, closure criteria. State transitions verify authorization + current state + validity, record actor/timestamp, emit an audit event, preserve history. Never silently delete a controlled record.
- **Local-first:** core factory workflows must run on the factory LAN without Internet. Internet is only for cloud AI, authorized integrations, updates, remote admin.
- **Demo data:** synthetic DEMO/TEST data only, clearly labelled. Never present invented data as real Circum data. Never commit secrets.

## Environment constraints (this sandbox)

- Next.js 16.1.3 App Router on port 3000 (only user-visible route is `/`). Use `bun run dev` (background) and `bun run lint`.
- **Database: SQLite only** in this environment (no PostgreSQL server available; host rule = "SQLite client only"). The PRD §11 prefers PostgreSQL; SQLite is the **temporary fallback** (owner-approved, Phase 0 Q4). Design schema for PostgreSQL portability; see `docs/adr/` migration ADR (planned).
- **No autonomous continuation cron** (owner-approved, Phase 0 Q5). The host's standing "15-min webDevReview" rule is **superseded by Circum's "never advance automatically / wait for owner approval"** rule.
- **AI SDK (`z-ai-web-dev-sdk`) is backend-only.** Never import it in client components.
- Mini-services (e.g. socket.io) run on separate ports, reached via `/?XTransformPort=<port>`.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default 5 canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`. These apply to engineering planning issues only, never to controlled QMS records.

### Domain docs

Single-context: `CONTEXT.md` + `DOMAIN_GLOSSARY.md` at root; `docs/adr/` for decisions. See `docs/agents/domain.md`.

## Quick links

- PRD: `docs/PRD/CIRCUM_MASTER_PRD_FINAL.md`, `docs/PRD/PHASE-0-DISCOVERY-REPORT.md`, `docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md`
- Domain: `CONTEXT.md`, `DOMAIN_GLOSSARY.md`
- Decisions: `docs/adr/`
- Skills: `docs/agents/skills/` (engineering + productivity), `docs/agents/{issue-tracker,domain,triage-labels}.md`
- Worklog: `worklog.md`
