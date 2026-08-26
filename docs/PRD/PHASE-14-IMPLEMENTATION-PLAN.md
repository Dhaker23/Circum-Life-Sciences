# CIRCUM — PHASE 14 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 14 — Enterprise Hardening / Performance / Security / Final Validation
> **Predecessor:** Phases 1-13 (all approved/closed). 71 models. 402/402 tests pass. 168 permissions. 0 lint errors / 243 warnings.
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only).
> **Source of truth:** Circum Master PRD §14 (UI/UX), §17 (Validation-Minded Engineering), §18 (Phase 14 roadmap), §19 (Mandatory Phase Gate), §20 (Phase Validation Report), §22 (Success Criteria), §10 (Security/Data Integrity).
> **Critical owner constraints:**
> - "Do not invent entities, terminology, workflows, regulatory requirements, data sources, integrations, or functionality."
> - "Enterprise hardening / performance / security / final validation" (PRD §18 Phase 14)
> - "Preserve all Phase 1–13 functionality and architecture."
> - "Clearly separate VERIFIED, ENVIRONMENT-BLOCKED, DEFERRED, and NOT IMPLEMENTED items."
> - "NO AUTONOMOUS ADVANCEMENT. NO AUTONOMOUS CRON."

---

## 0. Context: what Phase 14 covers

PRD §18 Phase 14: **"Enterprise hardening / performance / security / final validation."**

This is the **final phase** of the Circum development roadmap. It is not a feature phase — it is a **hardening and validation phase** that closes the project to production-readiness.

### 0.1 The fundamental nature of Phase 14

Phase 14 is fundamentally different from Phases 1-13:
- Phases 1-13 **built** the system (identity, manufacturing, quality, traceability, lab, docs, equipment, cleanroom, lean, analytics, AI, integrations, deployment).
- Phase 14 **hardens** the system: verifies it meets PRD §22 success criteria, resolves technical debt, adds the missing E2E test layer, performs security/performance review, and produces the final validation evidence.

**Phase 14 introduces ZERO new domain entities.** It may introduce:
- E2E tests (Playwright)
- Performance tests
- Security review artifacts
- Lint debt reduction
- The `vitest.config.ts` typecheck fix (if safe)
- Deferred UI completion (state-transition buttons, detail-page tabs from earlier phases)
- Documentation consolidation

### 0.2 Carry-forward items (from Phase 13 + earlier)

The owner explicitly requires Phase 14 to account for these carry-forward items:

| # | Item | Status | Phase 14 action |
|---|---|---|---|
| 1 | PostgreSQL/RLS environment verification | ENVIRONMENT-BLOCKED | Document as a production-deployment gate; cannot resolve in sandbox |
| 2 | Docker build/runtime verification | ENVIRONMENT-BLOCKED | Document as a production-deployment gate; cannot resolve in sandbox |
| 3 | Production Z.ai provider verification | ENVIRONMENT-BLOCKED | Document as a production-deployment gate; cannot resolve in sandbox |
| 4 | Lint technical debt (243 warnings) | VERIFIED (documented) | Reduce where safe; document what remains |
| 5 | Pre-existing `vitest.config.ts` typecheck issue | VERIFIED (documented) | Fix if safe (vitest 4 `poolOptions` migration) |
| 6 | Distributed rate limiting | DEFERRED | Requires Redis (not in sandbox); document as production requirement |
| 7 | Vector search for RAG | DEFERRED | Requires pgvector (PostgreSQL); document as future enhancement |
| 8 | Concrete integration adapters | NOT IMPLEMENTED | Each requires real target system + OWNER DECISION + ADR; not Phase 14 scope |
| 9 | Automated backup scheduling | DEFERRED | Requires cron/external scheduler; document as operations requirement |
| 10 | Deferred UI work (state-transition buttons, detail-page tabs) | VERIFIED (partial) | Complete where the existing schema/services support it |
| 11 | Playwright E2E coverage | NOT IMPLEMENTED | Phase 14 adds E2E tests for critical workflows |
| 12 | `middleware.ts` → `proxy.ts` rename (Next 16 deprecation) | VERIFIED (documented) | Rename if safe (Next 16 convention) |

### 0.3 The non-negotiable principle

Phase 14 must **not break** any Phase 1-13 functionality. Every change must be tested against the full 402-test regression suite. The owner's rule: "Preserve all Phase 1–13 functionality and architecture."

---

## 1. Objectives

1. **E2E test coverage** (PRD §19 Phase Gate includes "E2E tests") — Playwright E2E tests for critical user workflows (sign-in, manufacturing, quality, batch review, analytics, AI assistant).
2. **Performance review** (PRD §19 Phase Gate includes "Performance review") — identify slow queries, N+1 patterns, large payload risks; document findings; optimize where safe.
3. **Security review** (PRD §19 Phase Gate includes "Security review") — comprehensive review of authentication, authorization, input validation, CSRF, XSS, secrets, audit, site isolation.
4. **Data-integrity review** (PRD §19 Phase Gate includes "Data-integrity review") — verify DB constraints, transactions, referential integrity, state-machine enforcement.
5. **Audit review** (PRD §19 Phase Gate includes "Audit review") — verify audit immutability, completeness, tamper-evidence.
6. **Code review** (PRD §19 Phase Gate includes "Code review") — review code quality, consistency, domain-language adherence.
7. **Domain-language review** (PRD §19 Phase Gate includes "Domain-language review") — verify CONTEXT.md + DOMAIN_GLOSSARY.md alignment with implementation.
8. **Lint debt reduction** — reduce the 243 warnings where safe; document what remains with classification.
9. **`vitest.config.ts` fix** — resolve the pre-existing vitest 4 `poolOptions` typecheck issue if safe.
10. **`middleware.ts` → `proxy.ts` rename** — adopt the Next 16 convention if safe.
11. **Deferred UI completion** — complete state-transition buttons and detail-page tabs where the existing schema/services support it.
12. **Final validation evidence** — produce the Phase 14 Validation Report + a consolidated Production Readiness Checklist.
13. **Full RBAC + audit + multi-site + Local-First + AI governance** — verify all Phase 1-13 governance remains intact.

**Out of scope:** New domain entities, new APIs, new UI features, new integrations, new AI capabilities, PostgreSQL execution, Docker execution, cloud AI verification (all ENVIRONMENT-BLOCKED or DEFERRED).

---

## 2. Requirements (PRD traceability)

| # | Requirement (PRD) | Phase 14 coverage | Owner decision |
|---|---|---|---|
| R1 | E2E tests (§19 Phase Gate) | Playwright E2E for critical workflows | **D1 — which workflows?** |
| R2 | Performance review (§19) | Query analysis, N+1 detection, payload audit | — |
| R3 | Security review (§19) | Auth, authz, input validation, CSRF, XSS, secrets, audit, site isolation | — |
| R4 | Data-integrity review (§19) | DB constraints, transactions, referential integrity, state machines | — |
| R5 | Audit review (§19) | Audit immutability, completeness, tamper-evidence | — |
| R6 | Code review (§19) | Code quality, consistency, domain-language adherence | — |
| R7 | Domain-language review (§19) | CONTEXT.md + DOMAIN_GLOSSARY.md alignment | — |
| R8 | Browser/console review (§19) | Browser verification of all critical pages | — |
| R9 | Success criteria (§22) | Verify: reliable, secure, maintainable, scalable, testable, observable, multilingual, traceable, audit-ready, validation-minded | — |
| R10 | Lint debt (carry-forward) | Reduce 243 warnings where safe; document remainder | **D2 — how aggressive?** |
| R11 | vitest.config.ts fix (carry-forward) | Fix vitest 4 poolOptions migration if safe | **D3 — safe to fix?** |
| R12 | middleware→proxy rename (carry-forward) | Adopt Next 16 convention if safe | **D4 — safe to rename?** |
| R13 | Deferred UI (carry-forward) | Complete state-transition buttons + detail tabs | **D5 — which deferred UI?** |

---

## 3. Domain model (grill-with-docs + domain-modeling)

### 3.1 E2E test scope (D1 — OWNER DECISION REQUIRED)

**Question:** Which user workflows get Playwright E2E tests?

**Analysis:**
- PRD §19 Phase Gate lists "E2E tests" as mandatory.
- The project has `playwright.config.ts` configured but `tests/e2e/` is empty.
- E2E tests are expensive (slow, flaky, require a running server).
- The owner's rule: "Do not invent." E2E tests should cover **existing** critical workflows, not speculative ones.

**Proposed resolution (D1):** **E2E tests for the 7 critical workflows:**
1. **Authentication** — sign-in, sign-out, failed sign-in, lockout.
2. **Manufacturing** — create product → revision → BOM → work order → batch → execute.
3. **Quality** — create NCR → deviation → investigation → CAPA → close (human-only).
4. **Batch review** — batch → ready for review → QA review → disposition (human-only).
5. **Traceability** — forward trace + backward trace + impact analysis.
6. **Analytics** — OEE dashboard + quality dashboard + corporate (authorized).
7. **AI assistant** — chat (with D6 fallback expected in sandbox).

**Not in E2E scope:** integrations (no concrete adapters), cleanroom/packaging/sterilization (covered by integration tests), document control/training (covered by integration tests).

**Recommendation: 7 critical workflows.** **Please confirm D1.**

### 3.2 Lint debt reduction strategy (D2 — OWNER DECISION REQUIRED)

**Question:** How aggressively does Phase 14 reduce the 243 lint warnings?

**Analysis:**
- 243 warnings, 0 errors.
- Owner's rule: "No suppression is permitted merely to make the Phase Gate pass."
- Owner's rule: "Security, authorization, correctness, and data-integrity warnings are defects, not ordinary technical debt."
- Most warnings are `@typescript-eslint/no-unused-vars` and `@typescript-eslint/no-explicit-any`.

**Proposed resolution (D2):** **Conservative reduction:**
- Fix warnings that are **actual defects** (security, correctness, data-integrity) — these are mandatory.
- Fix warnings that are **trivial** (unused imports, unused variables) — these are easy and reduce noise.
- **Do NOT suppress** warnings to improve the count.
- **Do NOT refactor** stable code merely to eliminate `no-explicit-any` warnings (risk of breaking functionality).
- Document the remaining warnings with classification (ordinary debt vs defect).

**Target:** Reduce from 243 to ~200-210 (fix trivial unused-vars; leave legitimate `any` usage in place with documentation). **OWNER DECISION: is this target acceptable, or should Phase 14 be more aggressive?**

**Recommendation: conservative (fix trivial + defects; document remainder).** **Please confirm D2.**

### 3.3 vitest.config.ts fix (D3 — OWNER DECISION REQUIRED)

**Question:** Is it safe to fix the pre-existing `vitest.config.ts` typecheck issue?

**Analysis:**
- The issue: vitest 4 removed `poolOptions` from the config type; the project uses `poolOptions: { forks: { singleFork: true } }`.
- The fix: move `poolOptions` to top-level `pool` + `singleFork` (vitest 4 migration).
- Risk: if the fix is wrong, tests may run in parallel (breaking the shared test DB).
- The owner's rule: "If Phase 13 safely resolves it as part of legitimate work, report that separately." (now Phase 14)

**Proposed resolution (D3):** **Fix it, with careful testing.** The vitest 4 migration guide says: `poolOptions: { forks: { singleFork: true } }` → `pool: "forks"` + `singleFork: true` (top-level). Run the full 402-test suite after the fix to verify sequential execution is preserved.

**Recommendation: fix with full regression verification.** **Please confirm D3.**

### 3.4 middleware.ts → proxy.ts rename (D4 — OWNER DECISION REQUIRED)

**Question:** Is it safe to rename `middleware.ts` to `proxy.ts` (Next 16 convention)?

**Analysis:**
- Next 16 deprecated the `middleware` file convention in favor of `proxy`.
- The dev log shows a warning: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`
- The fix: rename `src/middleware.ts` to `src/proxy.ts`.
- Risk: if the rename is incomplete, auth middleware stops running (security regression).

**Proposed resolution (D4):** **Rename it, with careful testing.** Verify that auth + locale routing still work after the rename. Run the full test suite + browser-verify sign-in.

**Recommendation: rename with full verification.** **Please confirm D4.**

### 3.5 Deferred UI completion (D5 — OWNER DECISION REQUIRED)

**Question:** Which deferred UI work does Phase 14 complete?

**Analysis:**
- Earlier phases noted "deferred UI work" (state-transition buttons, detail-page tabs).
- The owner's rule: "Do not invent functionality."
- Phase 14 should only complete UI that the existing schema/services already support.

**Proposed resolution (D5):** **Complete the state-transition buttons on detail pages that lack them.** Specifically:
- NCR detail: add transition buttons (DRAFT → CONTAINMENT → INVESTIGATION → DISPOSITION → CLOSED).
- Deviation detail: add transition buttons.
- CAPA detail: add transition buttons.
- ChangeControl detail: add transition buttons.
- Batch review detail: add disposition buttons (if not already present).

**Not in scope:** New detail pages, new tabs, new features. Only transition buttons on existing detail pages where the service already supports the transition.

**OWNER DECISION: which specific detail pages need transition buttons?** (I will audit the existing UI and propose a list.)

**Recommendation: complete transition buttons on quality/batch-review detail pages.** **Please confirm D5.**

### 3.6 No new schema changes

**Phase 14 introduces ZERO schema changes.** No new entities, no new fields, no migrations. The 71 existing models are final.

### 3.7 Summary of proposed domain decisions

| # | Decision | Proposed | Recommendation | Owner decision |
|---|---|---|---|---|
| D1 | E2E test scope | 7 critical workflows (auth, manufacturing, quality, batch review, traceability, analytics, AI) | Confirm | **REQUIRED** |
| D2 | Lint reduction | Conservative (fix trivial + defects; document remainder; target ~200-210) | Confirm | **REQUIRED** |
| D3 | vitest.config.ts fix | Fix vitest 4 poolOptions migration with full regression | Confirm | **REQUIRED** |
| D4 | middleware→proxy rename | Rename with full verification | Confirm | **REQUIRED** |
| D5 | Deferred UI | Complete transition buttons on quality/batch-review detail pages | Confirm | **REQUIRED** |

---

## 4. Database schema

**No changes.** Phase 14 introduces zero schema changes. The 71 existing models (through Phase 13) are final.

---

## 5. E2E test architecture

```
tests/e2e/
├── auth.spec.ts              (sign-in, sign-out, failed sign-in, lockout)
├── manufacturing.spec.ts     (product → revision → BOM → work order → batch → execute)
├── quality.spec.ts           (NCR → deviation → investigation → CAPA → close)
├── batch-review.spec.ts      (batch → review → disposition)
├── traceability.spec.ts      (forward trace + backward trace + impact analysis)
├── analytics.spec.ts         (OEE dashboard + quality dashboard + corporate)
└── ai-assistant.spec.ts      (chat with D6 fallback expected)
```

**Playwright config:** already exists (`playwright.config.ts`). E2E tests run against the dev server (`bun run dev` on port 3000).

**E2E test principles:**
- Each test is independent (fresh sign-in per test).
- Tests use DEMO/TEST data (never real data).
- Tests verify the **golden path** (not exhaustive edge cases — those are in integration tests).
- AI assistant test expects the D6 fallback (provider unavailable in sandbox).

---

## 6. Performance review

### 6.1 Query analysis
- Review Prisma queries for N+1 patterns (especially analytics, traceability, AI context resolver).
- Identify queries that fetch large result sets without pagination.
- Document findings; optimize where safe (add `select` projections, `take` limits).

### 6.2 Payload audit
- Review API responses for oversized payloads (e.g., returning full nested objects when only IDs are needed).
- Document findings; optimize where safe.

### 6.3 Frontend performance
- Review React component re-renders (useQuery cache keys, dependency arrays).
- Verify chart rendering performance (recharts with large datasets).
- Document findings.

### 6.4 No load testing
- Phase 14 does **not** include load/stress testing (requires infrastructure not available in sandbox).
- Document as a production-deployment verification item.

---

## 7. Security review

### 7.1 Authentication
- Verify argon2id password hashing with pepper.
- Verify account lockout after failed attempts.
- Verify session management (NextAuth with DB sessions, ADR-0003).

### 7.2 Authorization
- Verify RBAC enforcement on every API route (`requirePermission`).
- Verify site isolation (`assertSiteAccess` on every site-scoped query).
- Verify AI has zero mutation permissions.
- Verify integration permissions are human-only.

### 7.3 Input validation
- Verify zod schemas on every API input.
- Verify SQL injection protection (Prisma parameterized queries).
- Verify XSS protection (React auto-escaping + CSP headers).

### 7.4 CSRF / CORS
- Verify CSRF protection (NextAuth csrf token).
- Verify CORS configuration (same-origin by default).

### 7.5 Secrets
- Verify no secrets in code, logs, or API responses.
- Verify `.env` is gitignored.
- Verify integration credentials are AES-256-GCM encrypted.

### 7.6 Audit
- Verify audit immutability (DB triggers reject UPDATE/DELETE).
- Verify audit completeness (every mutation audited).
- Verify audit redaction (no credentials in audit records).

---

## 8. Data-integrity review

### 8.1 DB constraints
- Verify `@@unique`, `@@index`, foreign key constraints.
- Verify non-nullable fields.
- Verify enum-as-string + zod enforcement.

### 8.2 Transactions
- Verify transactional operations (material consumption, state transitions).
- Verify rollback on failure.

### 8.3 State machines
- Verify state-machine enforcement (NCR, Deviation, CAPA, ChangeControl, Batch, WorkOrder, etc.).
- Verify terminal states cannot be re-transitioned.

---

## 9. Audit review

- Verify AuditEvent is append-only (DB triggers).
- Verify every controlled-record mutation generates an audit event.
- Verify AI queries are audited.
- Verify integration syncs are audited.
- Verify corporate analytics access is audited.
- Verify exports are audited.
- Verify no credentials in audit records.

---

## 10. Code review + domain-language review

### 10.1 Code review
- Review code consistency (naming, error handling, logging).
- Review test coverage (402 tests; identify gaps).
- Review dependency risks (outdated packages, vulnerabilities).

### 10.2 Domain-language review
- Verify `CONTEXT.md` + `DOMAIN_GLOSSARY.md` alignment with implementation.
- Verify no terminology drift (variable names match domain terms).
- Update docs if drift is found.

---

## 11. Testing

**Target: ~15-25 E2E tests + full 402-test regression must pass.**

### 11.1 E2E tests (Playwright)
- 7 spec files covering the 7 critical workflows (D1).
- Each spec has 2-4 tests (golden path + key edge cases).
- Total: ~15-25 E2E tests.

### 11.2 Regression
- **All 402 Phase 1-13 tests must pass unchanged.**
- After D3 (vitest.config.ts fix) + D4 (middleware→proxy rename), re-run full regression.
- After D5 (deferred UI), re-run full regression.

### 11.3 No new integration tests
- Phase 14 adds E2E tests only. Integration test coverage is already comprehensive (402 tests).

---

## 12. Carry-forward item resolution

| # | Item | Phase 14 resolution | Category |
|---|---|---|---|
| 1 | PostgreSQL/RLS | Document as production-deployment gate; script + runbook ready (Phase 13) | ENVIRONMENT-BLOCKED |
| 2 | Docker build | Document as production-deployment gate; Dockerfile + compose ready (Phase 13) | ENVIRONMENT-BLOCKED |
| 3 | Z.ai provider | Document as production-deployment gate; D6 fallback verified (Phase 12) | ENVIRONMENT-BLOCKED |
| 4 | Lint debt (243) | Reduce to ~200-210 (D2); document remainder | VERIFIED → REDUCED |
| 5 | vitest.config.ts | Fix vitest 4 migration (D3) | VERIFIED → FIXED |
| 6 | middleware→proxy | Rename (D4) | VERIFIED → FIXED |
| 7 | Distributed rate limiting | Document as production requirement (requires Redis) | DEFERRED |
| 8 | Vector search for RAG | Document as future enhancement (requires pgvector) | DEFERRED |
| 9 | Concrete adapters | Document as future phases (require real target systems) | NOT IMPLEMENTED |
| 10 | Automated backup | Document as operations requirement | DEFERRED |
| 11 | Deferred UI | Complete transition buttons (D5) | VERIFIED → COMPLETED |
| 12 | Playwright E2E | Add 7 spec files (D1) | NOT IMPLEMENTED → IMPLEMENTED |

---

## 13. Technical-debt implications

- **Lint warnings:** 243 → ~200-210 (D2 conservative reduction).
- **vitest.config.ts:** fixed (D3) — pre-existing typecheck error resolved.
- **middleware→proxy:** renamed (D4) — Next 16 deprecation warning resolved.
- **No new technical debt introduced.**
- **Remaining debt:** documented in the Production Readiness Checklist.

---

## 14. OWNER DECISION REQUIRED — summary

**All 5 domain decisions (D1-D5) require owner confirmation.** All have sensible defaults proposed.

---

## 15. PHASE 14 IMPLEMENTATION MUST NOT START

After this plan is produced:

**STOP.**

Do NOT:
- implement Phase 14 E2E tests
- fix vitest.config.ts
- rename middleware→proxy
- complete deferred UI
- reduce lint debt
- begin Phase 15 (there is no Phase 15 — Phase 14 is final)

Wait for explicit owner approval of this plan **and** all 5 OWNER DECISION REQUIRED items (D1-D5).

---

## 16. Required workflow

```
PLAN → OWNER REVIEW → APPROVAL → IMPLEMENT → TEST → SELF-REVIEW →
SECURITY REVIEW → FIX → FULL REGRESSION → VALIDATION REPORT →
STOP → OWNER APPROVAL
```

**Never advance automatically.** (CLAUDE.md: the host's standing 15-min `webDevReview` cron is superseded by Circum's "never advance automatically / wait for owner approval" rule, owner-approved Phase 0 Q5.)

---

## 17. Production Readiness Checklist (Phase 14 deliverable)

Phase 14 produces a **Production Readiness Checklist** that clearly separates:

| Category | Items |
|---|---|
| **VERIFIED** | 402+ tests pass; typecheck clean; lint 0 errors; security review; data-integrity review; audit review; site isolation; AI governance; Local-First; E2E coverage |
| **ENVIRONMENT-BLOCKED** | PostgreSQL cutover + RLS; Docker build/runtime; Z.ai cloud provider verification |
| **DEFERRED** | Distributed rate limiting (Redis); vector search (pgvector); automated backup scheduling; concrete integration adapters |
| **NOT IMPLEMENTED** | Concrete ERP/MES/LIMS/PLC/SCADA/IoT/Barcode/RFID/PLM/HR/maintenance adapters (require real target systems) |

---

```
PHASE 14 PLAN STATUS: WAITING FOR OWNER APPROVAL (and D1-D5 confirmation)
```

**I am stopping here.** Awaiting your approval and confirmation of D1-D5.
