# CIRCUM — PHASE 0 PROJECT DISCOVERY REPORT

> **Status:** WAITING FOR OWNER APPROVAL
> **Phase:** 0 — Discovery / Existing-Project Analysis / Architecture / Engineering Environment / Skills Capability
> **Method:** Matt Pocock `setup-matt-pocock-skills` + `domain-modeling` disciplines applied to PRD §2 ("Existing Project First") and GLM Master Prompt §5.
> **Scope rule:** No features implemented. This report is read-only discovery + engineering-environment setup only.
> **Sources of truth:** `upload/CIRCUM_MASTER_PRD_FINAL.md`, `upload/CIRCUM_GLM5.2_MASTER_PROMPT_FINAL.md`, direct inspection of `/home/z/my-project`.

---

## 1. Executive Summary

The "existing Circum project" is, in reality, a **fresh Next.js 16 Z.ai Code scaffold**. It contains a working base stack (Next.js 16.1.3 + React 19 + TypeScript 5 + Tailwind 4 + shadcn/ui + Prisma 6/SQLite + next-auth v4 + next-intl v4) but **none of the Circum medical-device/QMS domain, modules, auth, i18n, tests, or documentation exist yet**. The Prisma schema holds only demo `User`/`Post` models; the only API route returns `"Hello, world!"`; the only page renders a logo.

The **Matt Pocock skills engineering-process toolkit has been installed and configured** (25 promoted skills under `docs/agents/skills/`; repo config under `docs/agents/`; domain seed in `CONTEXT.md` + `DOMAIN_GLOSSARY.md`; ADR-0001 records the decision). The skills are process disciplines, never Circum business modules, and are subordinate to the Circum PRD.

**Gap verdict:** ~0% of the PRD's functional scope is implemented. The scaffold is a reasonable **foundation** but every Circum module (Manufacturing, Traceability, QMS, Documents, Training, Equipment, Validation, Cleanroom, Lab, Packaging, Sterilization, Batch Review/Release, Lean/OEE/VSM, Analytics, AI Assistant) must be built phase by phase under the mandatory Phase Gate.

**Three structural concerns** must be owner-decided before Phase 1:
1. **Database:** PRD §11 prefers **PostgreSQL**; the environment currently uses **SQLite**. This is a real conflict to resolve (see §5, §21, Open Q4).
2. **Toolchain discipline:** `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `reactStrictMode: false`; `eslint.config.mjs` disables almost all rules. This contradicts the PRD's "evidence over assumptions / tests over hope" principle and must be tightened (see §16, §21).
3. **Controlled-workflow vs auto-cron:** the host environment's standing rule asks for an autonomous 15-minute development cron after web work. The Circum PRD mandates "never advance automatically" and "WAIT FOR OWNER APPROVAL." I have **not** created that cron; this conflict needs an owner decision (see §17, Open Q5).

**Recommendation:** approve Phase 0, resolve the open questions (especially Q4 DB and Q5 cron), then proceed to **Phase 1 — Identity / Organization / Sites / Departments / Roles / Permissions / Authentication / Audit**.

```
PHASE 0 STATUS: WAITING FOR OWNER APPROVAL
```

---

## 2. Existing Project Structure

```
/home/z/my-project
├── .env                       # DATABASE_URL=file:/home/z/my-project/db/custom.db
├── .git/                      # 1 commit ("Initial commit"); no remote; ~all files untracked
├── .gitignore
├── .zscripts/                 # host dev orchestration (dev.sh, build.sh, mini-services-*.sh)
├── Caddyfile                  # gateway on :81 → :3000, +XTransformPort query routing
├── components.json            # shadcn/ui config: style=new-york, baseColor=neutral, cssVariables
├── db/custom.db               # SQLite database file (empty/demo)
├── download/                  # (host artifact)
├── eslint.config.mjs          # extremely permissive (see §16)
├── examples/websocket/        # socket.io reference (server.ts :3003, frontend.tsx)
├── mini-services/             # empty (.gitkeep) — for independent bun services
├── next.config.ts             # output: standalone; ignoreBuildErrors:true; reactStrictMode:false
├── package.json               # full stack (see §3)
├── postcss.config.mjs
├── prisma/schema.prisma       # SQLite; only demo User + Post models
├── public/                    # logo.svg, robots.txt
├── skills/                    # ⚠ Z.ai platform skills (ASR/LLM/TTS/VLM/docx/pdf/...), NOT Matt Pocock
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Geist fonts, Toaster; metadata = "Z.ai Code Scaffold"
│   │   ├── page.tsx           # 'use client' — renders logo only
│   │   ├── globals.css        # Tailwind 4 + shadcn tokens (light/dark)
│   │   └── api/route.ts       # GET → { message: "Hello, world!" }
│   ├── components/ui/         # 55 shadcn/ui components (full New York set)
│   ├── hooks/                 # use-toast, use-mobile
│   └── lib/
│       ├── db.ts              # PrismaClient singleton (log:['query'])
│       └── utils.ts           # cn()
├── tailwind.config.ts
├── tests/                     # 3 *.sh runtime build scripts (host infra), no app tests
└── upload/                    # CIRCUM_MASTER_PRD_FINAL.md, CIRCUM_GLM5.2_MASTER_PROMPT_FINAL.md
```

**Newly created in Phase 0 (this report's work):** `CONTEXT.md`, `DOMAIN_GLOSSARY.md`, `docs/agents/` (skills + issue-tracker/domain/triage-labels config), `docs/adr/0001-adopt-matt-pocock-skills.md`, `docs/PRD/PHASE-0-DISCOVERY-REPORT.md` (this file), `.scratch/` (issue-tracker root).

---

## 3. Technology Stack

| Layer | Installed | Circum-fit | Notes |
|---|---|---|---|
| Framework | Next.js 16.1.3 (App Router, Turbopack, `output: standalone`) | ✅ matches PRD §11 | — |
| Language | TypeScript 5 (`strict: true`, but `noImplicitAny: false`) | ✅ | tsconfig target ES2017 (low; consider ES2022) |
| React | 19.0.0 | ✅ | — |
| Styling | Tailwind CSS 4 + `tw-animate-css` | ✅ matches PRD §11 | — |
| UI lib | shadcn/ui (New York, neutral base), Lucide icons, 55 components | ✅ matches PRD §14 | full component set present |
| ORM | Prisma 6.11 + `@prisma/client` | ⚠ provider mismatch | schema uses **SQLite**; PRD §11 prefers **PostgreSQL** (see §5) |
| DB | SQLite (`db/custom.db`) | ⚠ | inadequate for multi-site/concurrency/Part 11 (see §5, §13) |
| Auth | next-auth v4.24.11 | ⚠ installed, **unconfigured** | no providers, no session strategy, no RBAC (see §7) |
| i18n | next-intl v4.3.4 | ⚠ installed, **unconfigured** | PRD §4 requires FR/EN/AR + RTL; none wired |
| State | Zustand 5, TanStack Query 5, TanStack Table 8 | ✅ | — |
| Forms/Validation | react-hook-form 7 + zod 4 + @hookform/resolvers | ✅ | — |
| Charts | recharts 2.15 | ✅ | for OEE/analytics dashboards |
| Motion | framer-motion 12 | ✅ | PRD §14: motion must improve usability, not distract |
| Markdown | @mdxeditor/editor, react-markdown, react-syntax-highlighter | ✅ | useful for document control / AI answers |
| Realtime | socket.io (examples/) | ✅ | mini-service pattern available |
| AI SDK | z-ai-web-dev-sdk 0.0.18 | ✅ | **backend-only** per env rules; AI Assistant (PRD §9) foundation |
| Editor rich | input-otp, embla-carousel, cmdk, vaul, react-day-picker, react-resizable-panels | ✅ | — |
| DnD | @dnd-kit/* | ✅ | useful for kanban/shifts/VSM |
| Misc | uuid, date-fns, sharp, sonner | ✅ | — |
| Test runner | **none** | ❌ | no vitest/jest/playwright (see §14) |
| Docker | **none** | ❌ | PRD §11 lists Docker/Docker Compose (see §14) |
| Lint | ESLint 9 + eslint-config-next | ⚠ | config disables almost all rules (see §16) |

**Stack fit:** the base is PRD-aligned (Next.js/React/TS/Tailwind). The two real mismatches are **SQLite vs PostgreSQL** and the **absent test/Docker/i18n/auth wiring**.

---

## 4. Existing Architecture

There is **no Circum architecture yet** — only the default Next.js App Router layout:

- **Presentation:** `src/app/page.tsx` (client component, logo only), `src/app/layout.tsx` (root layout, fonts, Toaster).
- **API:** `src/app/api/route.ts` (single route, Hello World). No route groups, no middleware, no service layer.
- **Application/Domain/Infrastructure layers:** absent. PRD §11 requires `Presentation → API → Application Services → Domain Logic → Infrastructure → Database/Cache/Events`. "Critical business logic must not live only in the UI." Nothing exists to evaluate against this yet.
- **Realtime:** a reference socket.io server (`examples/websocket/server.ts`, port 3003) and client (`frontend.tsx`); pattern is available but unused by the app.
- **Gateway:** Caddy on `:81` proxies to `:3000` and supports `?XTransformPort=<port>` routing to mini-services (e.g. a future socket.io service on 3003). Aligns with the host environment's single-exposed-port constraint.
- **Build:** `output: standalone` (good for local-first deployment, PRD §12).

**Verdict:** architecture is a blank canvas on the PRD's preferred stack. No anti-patterns to undo, but also no domain seams to preserve.

---

## 5. Database

- **Provider:** SQLite (`datasource db { provider = "sqlite" }`), file at `file:/home/z/my-project/db/custom.db`.
- **Schema:** two demo models only:
  ```prisma
  model User  { id, email @unique, name?, createdAt, updatedAt }
  model Post  { id, title, content?, published, authorId, createdAt, updatedAt }  // note: no relation declared to User
  ```
  - `Post.authorId` is a bare `String` with **no `@relation`** — a latent data-integrity defect (PRD §10/§11: "prevent broken references"). No foreign keys enforced.
- **Client:** `src/lib/db.ts` — singleton PrismaClient with `log: ['query']` (verbose; fine for dev, noisy for prod).
- **Migrations:** none (`db:push` only; no `prisma/migrations/`).

**Circum-fit assessment:**
- PRD §11 **prefers PostgreSQL**. SQLite is acceptable for a local-first single-site dev/demo but is **inadequate** for: multi-site concurrency, row-level security / site-scoping, robust `JSON`/array types, full-text audit search, and some Part 11 expectations (concurrent transactional integrity at scale).
- Prisma's SQLite has limitations (no native `enum`, no `@db.Decimal`, limited concurrent writers) that will collide with QMS domain modeling (controlled enums, decimal quantities/parameters).
- The environment's standing rule says "SQLite client only." This **conflicts with PRD §11** and must be owner-resolved (Open Q4).

**Verdict:** DB layer is a placeholder. No Circum domain entities exist (see §10/§11).

---

## 6. API

- One route: `GET /api` → `{ message: "Hello, world!" }`.
- No Circum resources (no `/api/products`, `/api/batches`, `/api/ncr`, …).
- No middleware (auth, i18n locale, audit logging, RBAC enforcement).
- No request validation layer wired (zod is installed but unused at the API boundary).
- No error envelope / problem-details convention.
- No rate limiting, CSRF protection, or input sanitization policy.

**Verdict:** API surface is 0% of PRD scope. Build from scratch in Phase 1+.

---

## 7. Authentication

- `next-auth` v4.24.11 is a dependency but **completely unconfigured**: no `[...nextauth]/route.ts`, no `authOptions`, no providers, no session strategy, no JWT/DB adapter, no `SessionProvider` in the layout, no `middleware.ts` for route protection.
- No user/role/permission model in the schema (the demo `User` has only `email`/`name`).
- No RBAC, least-privilege, site/department/module scoping (PRD §3).
- No audit trail (PRD §13).
- No password/secret management policy.

**Verdict:** auth is the **#1 Phase 1 deliverable** (matches PRD roadmap Phase 1). The library is present; the implementation is entirely missing.

---

## 8. UI/UX

- **Layout root:** `src/app/layout.tsx` — Geist Sans + Mono fonts, `bg-background text-foreground`, `<Toaster/>`. Metadata still says "Z.ai Code Scaffold" (must become Circum-branded; PRD §14).
- **Home page:** `src/app/page.tsx` — `'use client'`, centered logo, inline styles. Not Circum UI.
- **Design system:** full shadcn/ui New York / neutral set (55 components), Tailwind 4 tokens, light/dark via `next-themes` (dependency present; `ThemeProvider` not wired into layout). OKLCH color palette.
- **i18n/RTL:** `next-intl` present but **unconfigured**. PRD §4 requires French, English, Arabic (RTL). No `middleware.ts` locale routing, no message catalogs, no RTL stylesheet. Arabic RTL is a **non-trivial** build concern (layout direction, icon mirroring, date/number formatting).
- **Sticky-footer / responsive / accessibility:** not yet applicable (no real pages). Must be enforced from Phase 1 per the UI/UX standards.
- **No KPI cards / tables / charts / timelines / workflow views** (PRD §14) — all to build.

**Verdict:** design tokens + component library are ready; no Circum interface exists.

---

## 9. Existing Features

**Circum functional features present: 0.**

The scaffold provides only platform primitives: a running dev server, a component library, a DB client, an AI SDK, and a realtime example. None of the PRD §5 modules exist:

| PRD Module | Status |
|---|---|
| Manufacturing (sites/products/BOM/routing/work orders/batches) | ❌ |
| Traceability (forward/backward genealogy) | ❌ |
| Quality/QMS (inspection/NCR/deviation/RCA/CAPA/change/risk/supplier quality/audits/batch review/release) | ❌ |
| Document Control (Draft→…→Obsolete) | ❌ |
| Training (Employee→…→Authorization) | ❌ |
| Equipment/Maintenance/Calibration (VALID/EXPIRING/EXPIRED/OUT OF SERVICE) | ❌ |
| Validation (IQ/OQ/PQ) | ❌ |
| Cleanroom monitoring (configurable limits) | ❌ |
| Laboratory/testing (Sample→Test→Spec→Result→Disposition) | ❌ |
| Packaging | ❌ |
| Sterilization (EtO/Gamma/Beta/X-ray; never auto-release) | ❌ |
| Batch Review/Release (human-only disposition) | ❌ |
| Lean/OEE/VSM | ❌ |
| Analytics/dashboards | ❌ |
| AI Assistant (Answer/Evidence/Interpretation/Recommendation/Limitations) | ❌ |
| Enterprise Security (RBAC/audit/least-privilege) | ❌ |

---

## 10. Medical-Device Domain Model

**Existing:** none (demo `User`/`Post` only).

**Seeded in Phase 0** (authoritative extraction from the PRD, not invented):
- `CONTEXT.md` — concise ubiquitous language (Site, Product, Product Revision, BOM, Material, Material Lot, Supplier, Work Order, Routing, Operation, Manufacturing Batch, Device Lot, Equipment, Inspection, Specification, Test, NCR, Deviation, RCA, CAPA, Change Control, Risk, Validation IQ/OQ/PQ, Cleanroom, Packaging, Sterilization, Batch Review, Disposition/Release, Audit Trail, OEE, VSM) + relationships + flagged ambiguities.
- `DOMAIN_GLOSSARY.md` — detailed definitions, controlled-workflow state machines (Document, Training, Deviation, CAPA, Change Control, Batch Review/Release, Validation, Lab), AI-governance reminder, priority order, open terminology.

**Flagged ambiguities** (for `/grill-with-docs` before Phase 1):
- `lot` overload (Material Lot vs Device Lot vs Manufacturing Batch).
- Manufacturing Batch ↔ Device Lot cardinality (1:1 vs 1:N).
- `release` overload (sterilization release vs batch disposition vs document effective-release).
- Deviation (planned) vs NCR (unplanned) demarcation in Circum's usage.
- Exact NCR state machine.
- Multi-site data isolation model (per-site DB vs shared DB with site-scoping).

---

## 11. Missing Domain Entities

All Circum domain entities are missing. The Phase 1–9 build must add (non-exhaustive, grouped by PRD module):

- **Identity/Org (Phase 1):** User, Role, Permission, Site, Department, SiteMembership, AuditEvent, Session.
- **Manufacturing (Phase 2–3):** Product, ProductRevision, BOM, Material, MaterialLot, Supplier, Routing, Operation, WorkOrder, ManufacturingBatch, DeviceLot, Shift, Handover, Operator.
- **Traceability (Phase 4):** Genealogy edges (MaterialLot→Batch→DeviceLot→Operations→Equipment→Operators→Inspection→Packaging→Sterilization→Disposition→Shipment).
- **Quality/Lab (Phase 5–6):** Inspection, Sample, Test, TestMethod, Specification, Result, NCR, Nonconformity, Deviation, RootCause, CAPA, Disposition.
- **Docs/Training/Change/Risk/Audit (Phase 7):** ControlledDocument, DocumentRevision, Training, Assessment, Competency, ChangeControl, RiskRegister, RiskAssessment, Audit.
- **Equipment/Validation (Phase 8):** Equipment, MaintenancePlan, MaintenanceRecord, CalibrationRecord, Qualification (IQ/OQ/PQ), ValidationProtocol, ValidationResult.
- **Cleanroom/Packaging/Sterilization/Release (Phase 9):** Cleanroom, Classification, MonitoringPoint, Parameter, Limit, Reading, Excursion; PackagingLot, PackagingConfig; SterilizationCycle, SterilizationLot; BatchReview, BatchDisposition.
- **Lean/Analytics (Phase 10–11):** OEE record, DowntimeEvent, ScrapEvent, VSMNode, VSMEdge; KPI snapshots, Report.
- **AI (Phase 12):** AIInteraction (with Answer/Evidence/Interpretation/Recommendation/Limitations fields), RAGDocumentLink.

All controlled records must carry: unique ID, status, owner, evidence, approval history, audit trail, closure criteria (PRD §5).

---

## 12. Security Assessment

**Current posture: effectively absent.**

- **Authentication:** none configured (see §7).
- **Authorization/RBAC:** none; the demo `User` has no role.
- **Sessions:** no session strategy; no secure cookie config.
- **API authorization:** no middleware; `/api` is fully open.
- **Input validation:** zod installed but unused at API boundary.
- **Injection/XSS/CSRF:** React defaults mitigate XSS; no CSRF policy; Prisma parameterizes SQL (good); no SSRF/SSRF policy for AI/RAG fetches.
- **Secrets:** `.env` contains only `DATABASE_URL` (no secrets yet). Must enforce: no passwords/keys/tokens/PLC credentials in source (PRD §12).
- **Audit logging:** none.
- **Backup/recovery:** none.
- **Rate limiting / abuse:** none.

**Verdict:** security is a Phase 1+ build-out. The PRD priority order places Security below Data Integrity and Controlled Workflows but above Operational Efficiency — it is foundational and must be designed in from Phase 1, not bolted on.

---

## 13. Data Integrity Assessment

**Current:** weak.
- `Post.authorId` has **no `@relation`** → broken references possible (violates PRD §10: "prevent broken references").
- No DB-level uniqueness beyond `User.email`.
- No enums (SQLite limitation) → controlled statuses would be strings, requiring app-layer enforcement.
- No transactions policy, no idempotency, no state-transition guards.
- No immutability for audit records.

**Required (PRD §10/§11/§13):** DB constraints + transactions + foreign keys + validation + idempotency + state-transition protection; prevent duplicates, broken references, impossible quantities/timestamps, unauthorized edits, invalid workflow transitions; never silently delete controlled records; audit trail immutable to normal users.

**Verdict:** must be designed into the schema and a domain/state-machine layer from Phase 1. The `codebase-design` + `domain-modeling` skills will drive this.

---

## 14. Testing Assessment

**Current:** none.
- No test runner (no vitest/jest/playwright config).
- `tests/` contains only host-infrastructure shell scripts (python/database runtime builds), not app tests.
- `package.json` has no `test` script.
- No unit/integration/API/DB/auth/workflow/UI/E2E/regression tests (all required by PRD §15 and the Phase Gate, §19).

**Verdict:** a test runner + conventions must be established **before** Phase 1 feature work (the Phase Gate requires Unit/Integration/API/DB/Auth/Workflow/UI/E2E/Regression). Recommend **Vitest** (unit/integration) + **Playwright** (E2E) + **MSW** (API mocking) + Prisma test DB. The `tdd` skill (red→green→refactor) will drive feature work.

---

## 15. Performance Assessment

Not yet measurable (no real features). Baseline observed: dev server `Ready in 770ms`; `GET /` 200 in ~30ms after warm compile. `output: standalone` is good for local-first. `log: ['query']` in Prisma is dev-noisy and should be env-gated. No caching layer (PRD allows Redis "only where justified"). No analytics/indexing concerns yet (no data). Future risks: traceability genealogy queries (deep graphs), OEE aggregation over large time windows, audit-log growth — plan indexes + materialized summaries in Phase 10–11.

---

## 16. Technical Debt

| Item | Severity | Origin |
|---|---|---|
| `next.config.ts`: `typescript.ignoreBuildErrors: true` | 🔴 High | lets type errors ship — violates "evidence over assumptions" |
| `next.config.ts`: `reactStrictMode: false` | 🟠 Medium | suppresses dev-time correctness checks |
| `eslint.config.mjs`: disables ~all TS/React/Next rules | 🔴 High | no automated quality gate; PRD Phase Gate requires code review but lint is the first line |
| `Post.authorId` has no `@relation` | 🟠 Medium | broken-reference risk; demo only but must not be copied |
| Prisma `log: ['query']` unconditional | 🟡 Low | dev noise / perf in prod |
| `tsconfig` target ES2017, `noImplicitAny: false` | 🟡 Low | loosens type safety |
| No `test` script / runner | 🔴 High | blocks Phase Gate |
| SQLite vs PRD PostgreSQL preference | 🔴 High | structural; see §5 |
| Git: ~all files untracked, no remote | 🟠 Medium | no version-control safety net yet |
| `src/app/page.tsx` uses inline styles + `'use client'` for static content | 🟡 Low | will be replaced in Phase 1 |
| `skills/` (Z.ai) vs `docs/agents/skills/` (Matt Pocock) naming collision | 🟡 Low | documented here to avoid confusion |
| `.env` committed-friendly (only DATABASE_URL) | 🟢 Info | keep it that way |

**Debt to clear before Phase 1:** items marked 🔴 (toolchain discipline, test runner, DB decision). The `code-review` and `improve-codebase-architecture` skills will track this.

---

## 17. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | SQLite chosen for expediency, locking out multi-site/Part 11 needs | High | Critical | Owner decision now (Open Q4); if SQLite kept for Phase 0–1, plan PG migration ADR before Phase 3 |
| R2 | `ignoreBuildErrors` + permissive eslint let defects through | High | High | Tighten config in Phase 1 prep (§21) |
| R3 | No test infrastructure → cannot satisfy Phase Gate | Certain | Critical | Stand up Vitest+Playwright before Phase 1 features |
| R4 | next-auth misconfiguration (e.g., JWT without rotation, weak session secret) | Medium | Critical | Follow next-auth v4 hardening + ADR for session strategy |
| R5 | i18n/RTL added late → expensive retrofit | Medium | High | Wire next-intl + RTL skeleton in Phase 1 |
| R6 | AI SDK used on client (env rule violation) / AI bypasses controlled workflows | Medium | Critical | Keep z-ai-web-dev-sdk backend-only; enforce AI-governance contract (PRD §9) in code + review |
| R7 | "Auto-continue cron" host rule vs Circum "never advance automatically" | Medium | High | **Not created.** Owner decision (Open Q5) |
| R8 | Domain ambiguity (lot/release/deviation-vs-ncr) baked into schema | Medium | High | Resolve via `/grill-with-docs` before Phase 2 schema |
| R9 | No git remote / everything untracked → progress loss | Medium | Medium | Commit Phase 0 artifacts; decide on remote |
| R10 | Over-reliance on skills as ceremony, slowing delivery | Medium | Medium | Skill selection deliberate (§18); skip skills that don't fit |

---

## 18. Skills / Engineering Environment Assessment

**Matt Pocock skills status: INSTALLED + CONFIGURED.**

- **Install route:** "tinkerer" (owned editable files in repo). The interactive `npx skills@latest add mattpocock/skills` installer was attempted but its internal clone exceeded the sandbox execution deadline; the equivalent outcome (owned skill files) was achieved via shallow `git clone` + copy, which the repo README explicitly endorses as a valid route.
- **Installed set:** 25 promoted skills (18 `engineering/` + 7 `productivity/`) at `docs/agents/skills/`. `misc/` and `in-progress/` intentionally excluded.
- **Repo config (`setup-matt-pocock-skills` output):**
  - `docs/agents/issue-tracker.md` → **local markdown** under `.scratch/` (no git remote; local-first controlled env).
  - `docs/agents/domain.md` → **single-context** (no monorepo signals).
  - `docs/agents/triage-labels.md` → default 5 canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`).
  - Root agent file (`CLAUDE.md` vs `AGENTS.md`) + `## Agent skills` block: **deferred to owner** (the setup skill says "don't pick for them" — Open Q1).
- **Domain seed:** `CONTEXT.md` + `DOMAIN_GLOSSARY.md` created; `docs/adr/0001` records the adoption decision.
- **`skills` CLI:** available locally as a devDependency (`skills@1.5.23`, binaries `skills` + `add-skill`) for future `update`/`list`/`find` operations.

**Skill → Circum task mapping (deliberate, not blanket):**

| Engineering situation | Skill | Circum note |
|---|---|---|
| Requirements/design clarification before a phase or major decision | `grill-with-docs` (→ `grilling` + `domain-modeling`) | use for Open Questions; maintains CONTEXT.md/ADRs |
| Building/sharpening the domain model | `domain-modeling` | drive CONTEXT.md + DOMAIN_GLOSSARY.md |
| Module/seam design | `codebase-design` | deep modules; critical logic not in UI |
| Feature implementation | `tdd` (red→green→refactor) + `implement` | Phase Gate requires tests |
| Hard bugs / perf regressions | `diagnosing-bugs` | reproduce→minimise→hypothesise→instrument→fix→regression |
| Code quality at phase gate | `code-review` | Standards + Spec axes |
| Architecture deepening | `improve-codebase-architecture` | run periodically |
| Multi-session planning (Phase 10–14) | `wayfinder` | decision tickets |
| Turning discussion into a spec | `to-spec` | publish to `.scratch/<feature>/spec.md` |
| Breaking approved work into tickets | `to-tickets` | tracer-bullet tickets with blocking edges |
| Issue triage | `triage` | uses `triage-labels.md` (engineering issues only, not QMS records) |

**Authority hierarchy (recorded in ADR-0001):** Circum Master PRD > approved ADRs > Matt Pocock skill guidance. A skill never overrides a controlled Circum workflow; on conflict → STOP → identify → propose → wait for owner approval.

---

## 19. PRD vs Existing Project — Gap Analysis

| PRD requirement (§) | Existing | Gap |
|---|---|---|
| §1 Vision (medical-device QMS platform) | scaffold only | ~100% |
| §3 RBAC (18 roles, least privilege, site/dept/module scoping) | none | 100% |
| §4 Languages FR/EN/AR+RTL | next-intl present, unconfigured | ~100% |
| §5 Core modules (Mfg/Trace/QMS/Docs/Training/Equipment/Validation/Cleanroom/Lab/Packaging/Sterilization) | none | 100% |
| §6 Batch review/release (human-only disposition) | none | 100% |
| §7 Lean/OEE/VSM | none | 100% |
| §8 Analytics | none | 100% |
| §9 AI Assistant (governed; never auto-release/approve) | SDK present, no assistant | ~100% |
| §10 Security/Data integrity | none; weak (broken FK) | ~100% |
| §11 Architecture (layered; PG preferred; Docker) | flat; SQLite; no Docker | structural |
| §12 Local-first | `output: standalone` ✓ | partial |
| §13 Integrations (ERP/MES/PLC/SCADA/IoT/RFID/LIMS/PLM/HR/maintenance) | none | 100% |
| §14 UI/UX (industrial, data-dense, RTL) | shadcn tokens only | ~95% |
| §15 Matt Pocock skills | **installed + configured** ✅ | done (Phase 0) |
| §16 Documentation tree | seeded (CONTEXT/GLOSSARY/adr/PRD) | skeleton only |
| §17 Validation-minded engineering | not yet | 100% |
| §18 Roadmap phases 0–14 | Phase 0 this report | Phase 1+ pending |
| §19 Mandatory Phase Gate | process ready | apply per phase |
| §20 Phase Validation Report | template understood | produce at each gate |
| §21 Demo data (labelled) | none yet | from Phase 2 |
| §22 Success criteria | not yet measurable | — |

---

## 20. Recommended Architecture

Keep the PRD-aligned base; add the missing structural seams. (Detail to be elaborated in `docs/architecture/` during Phase 1 prep, via `codebase-design`.)

```
src/
├── app/                        # Presentation (App Router) — routes, layouts, server components
│   ├── [locale]/              #   i18n segment (FR/EN/AR) via next-intl
│   ├── (auth)/                #   sign-in / sign-out
│   ├── (app)/                 #   authenticated shell: sidebar, topbar, notifications
│   └── api/                   #   route handlers (thin → delegate to services)
├── modules/                   # Application Services + Domain Logic, one folder per Circum module
│   ├── identity/              #   Phase 1: users, roles, permissions, sites, departments, audit
│   ├── manufacturing/         #   Phase 2–3
│   ├── traceability/          #   Phase 4
│   ├── quality/               #   Phase 5–6
│   ├── docs-training/         #   Phase 7
│   ├── equipment-validation/  #   Phase 8
│   ├── cleanroom-packaging-sterilization/  # Phase 9
│   ├── lean/                  #   Phase 10
│   ├── analytics/             #   Phase 11
│   └── ai/                    #   Phase 12 (backend-only z-ai-web-dev-sdk)
│   each module:
│     ├── api/                 #   route handlers (thin)
│     ├── service/             #   application services / use-cases
│     ├── domain/              #   entities, value objects, state machines, invariants
│     ├── infrastructure/      #   prisma repositories, adapters
│     └── __tests__/           #   unit + integration
├── lib/                       # cross-cutting (db, auth config, i18n config, audit, errors, zod schemas)
├── components/                # shared UI (shadcn/ui + Circum components)
└── middleware.ts              # auth + locale + RBAC enforcement
```

- **DB:** PostgreSQL (preferred) — owner decision pending (Open Q4). If SQLite retained for Phase 0–1 local dev, write a migration ADR and keep schema PG-compatible (avoid SQLite-only types).
- **Auth:** next-auth v4 (Credentials + optional OIDC for SSO); DB adapter; JWT or DB sessions via ADR; RBAC enforced in `middleware.ts` + service layer; audit event on every controlled transition.
- **i18n:** next-intl with `[locale]` segment; AR with `dir="rtl"`; message catalogs under `src/messages/{fr,en,ar}.json`; no hard-coded user-facing strings.
- **AI:** backend-only `z-ai-web-dev-sdk` behind a `modules/ai/service` that enforces the Answer/Evidence/Interpretation/Recommendation/Limitations contract and the "never auto-approve/release/close" guardrails.
- **Tests:** Vitest (unit/integration) + Playwright (E2E) + MSW; Prisma test DB per run; CI gate.
- **Realtime:** socket.io mini-service (port 3003) for shop-floor live updates (shifts, cleanroom excursions), reached via `io("/?XTransformPort=3003")`.
- **Deployment:** `output: standalone` Docker image (to be added); local-first by default.

---

## 21. Required Changes (before / during Phase 1)

**Before Phase 1 features (owner-approved prep):**
1. Resolve Open Q4 (DB: SQLite-now-and-migrate vs PostgreSQL-now). Write ADR-0002.
2. Tighten `next.config.ts`: `typescript.ignoreBuildErrors: false`, `reactStrictMode: true`.
3. Rewrite `eslint.config.mjs` to enforce a real quality gate (next core-web-vitals + TS strict rules ON; keep `skills/` and `docs/agents/skills/` ignored).
4. Add Vitest + Playwright + MSW + a `test` script + `tests/` structure; add CI-ready `bun run test`.
5. Resolve Open Q1 (root agent file CLAUDE.md vs AGENTS.md) and add the `## Agent skills` block.
6. Resolve Open Q5 (auto-cron conflict).
7. Commit Phase 0 artifacts to git; decide on a remote (Open Q7).

**During Phase 1 (Identity/Org/Auth/Audit) — via `grill-with-docs` → `to-spec` → `to-tickets` → `tdd`/`implement` → `code-review`:**
8. Domain model: User, Role, Permission, Site, Department, SiteMembership, AuditEvent, Session (with state machines + invariants).
9. next-auth wiring (providers, session strategy, `SessionProvider`, `middleware.ts` route protection).
10. RBAC enforcement layer (least privilege, site/dept/module scoping).
11. Audit trail primitive (immutable, captures PRD §13 fields).
12. i18n skeleton (`[locale]`, FR/EN/AR catalogs, RTL).
13. Circum-branded app shell (sidebar, topbar, sticky footer, theme provider).
14. Phase 1 Phase Validation Report + STOP + owner approval.

---

## 22. Phase 1 Scope (preview — not started)

Per PRD §18 roadmap: **Phase 1 — Identity / Organization / Sites / Departments / Roles / Permissions / Authentication / Audit.**

- In-scope: items 8–13 above.
- Out-of-scope: product/BOM/manufacturing (Phase 2+), quality records (Phase 5+), AI assistant (Phase 12).
- Entry criteria: Phase 0 approved + Required Changes 1–7 done.
- Exit criteria: Phase Gate (§19) passed + Phase Validation Report (§20) + owner approval.

---

## 23. Open Questions (require owner decision before Phase 1)

1. **Root agent file:** create `CLAUDE.md` or `AGENTS.md` at repo root for the `## Agent skills` block? (Matt Pocock repo uses `CLAUDE.md` with `AGENTS.md` as a symlink.) *Recommendation: `CLAUDE.md`.*
2. **Issue tracker:** confirm **local markdown** under `.scratch/` (recommended for no-remote, local-first repo), or specify GitHub/GitLab/Linear/Other?
3. **CONTEXT.md vs DOMAIN_GLOSSARY.md split:** confirm CONTEXT.md = concise ubiquitous language; DOMAIN_GLOSSARY.md = detailed definitions + workflow state machines. (Alternative: collapse into one file.)
4. **Database (structural conflict):** PRD §11 prefers **PostgreSQL**; the host environment rule says "SQLite client only." Options: (a) PostgreSQL now (overrides env rule — needs owner sign-off); (b) SQLite for Phase 0–1 local dev with a documented migration ADR to PostgreSQL before Phase 3; (c) SQLite throughout (rejects PRD §11 preference — not recommended for a multi-site medical-device platform). *Recommendation: (b).*
5. **Auto-continuation cron (controlled-workflow conflict):** the host environment's standing rule asks for an autonomous 15-minute `webDevReview` cron that "independently selects work focus and continues development." The Circum PRD mandates "Never advance automatically," "STOP → owner approval," and "Never allow AI to autonomously approve, release, close or modify controlled quality records." I have **deliberately not created** that cron. Options: (a) no auto-cron ever (strict Circum controlled workflow) — *recommendation*; (b) a heavily-gated cron limited to read-only QA/status reporting (never code changes, never state transitions); (c) owner explicitly opts in to autonomous continuation. *Decision needed.*
6. **Domain ambiguities (for `/grill-with-docs`):** see `CONTEXT.md` "Flagged ambiguities" and `DOMAIN_GLOSSARY.md` §16 (lot/release/deviation-vs-ncr/batch-vs-device-lot/multi-site isolation/NCR state machine).
7. **Git:** commit the Phase 0 artifacts now? Add a remote (GitHub/GitLab/other)? The repo currently has no remote and ~all files untracked.
8. **Triage labels:** confirm the 5 defaults, or supply Circum-specific overrides?
9. **Theming/branding:** any Circum brand colors/logo to use (PRD §14 says professional industrial enterprise interface; the UI rules say avoid indigo/blue unless requested)? Currently neutral shadcn palette.

---

```
PHASE 0 STATUS: WAITING FOR OWNER APPROVAL
```

**I am stopping here.** I will not begin Phase 1, will not create an autonomous development cron, and will not implement features until the owner approves Phase 0 and resolves the open questions (especially Q4 database, Q5 cron, Q1 root file).
