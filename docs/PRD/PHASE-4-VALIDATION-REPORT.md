# CIRCUM — PHASE 4 VALIDATION REPORT

> **Phase:** 4 — Quality Foundation: NCR, Deviation, Investigation (RCA), CAPA, Change Control, Risk Assessment
> **Status:** CONDITIONAL PASS
> **Date:** Phase 4 completion
> **Method:** `to-spec → to-tickets → domain-modeling → codebase-design → tdd/implement → code-review (self) → regression → validation` per PRD §19/§23.
> **Predecessor:** Phase 3 (approved/closed). Domain decisions D1-D12 owner-confirmed (D2 with modification: CAPA polymorphic source).

---

## 1. Implementation summary

Phase 4 establishes the Quality foundation: 6 controlled-record entities (NCR, Deviation, Investigation, CAPA, ChangeControl, RiskAssessment) with strict state machines, human-only approval gates, AI governance (PRD §9), polymorphic linkage to production (D8), and full audit. This is the most regulated layer of the platform — every transition is explicit, validated, authorized, and audited.

**6 new entities** + ProductionScrap/Rework `ncrId` optional FK (D10 traceability).

**14 new API routes** under `/api/quality/**` with `/transition`, `/approve`, `/conclude` endpoints + closure/approval guards.

**6 new UI pages** + sidebar Quality nav group + i18n FR/EN/AR.

**27 new quality.* permissions**, least-privilege grants; AI never gets `approve`/`close`/`transition` for controlled human actions.

## 2. Domain decisions implemented

- **D1 NCR ≠ Deviation**: NCR = unplanned nonconformity (reactive); Deviation = planned departure (proactive). Separate entities. ✅
- **D2 Investigation ≠ CAPA (with modification)**: Investigation = separate entity (finds cause); CAPA = separate entity (acts). **CAPA uses polymorphic source** (`sourceType` + `sourceId`) + optional `investigationId`. CAPA does NOT hard-require an Investigation. Tested (CAPA-without-investigation). ✅
- **D3 NCR state machine**: DRAFT→CONTAINMENT→INVESTIGATION→DISPOSITION→CLOSED +CANCELLED. Tested T-NCR-01. ✅
- **D4 Deviation state machine**: DRAFT→ASSESSMENT→INVESTIGATION(optional)→REVIEW→CLOSED +REJECTED. Tested T-DEV-01. ✅
- **D5 CAPA state machine**: OPEN→ACTION_PLAN→IMPLEMENTATION→EFFECTIVENESS→CLOSED. **Closure requires effectiveness verification + human verifier** (AI must never close). Tested T-CAPA-01. ✅
- **D6 Change Control state machine**: REQUEST→IMPACT→RISK→APPROVAL→IMPLEMENTATION→VERIFICATION→EFFECTIVENESS→CLOSED +REJECTED. **Implementation requires human approval** (AI must never approve). Tested T-CHG-01. ✅
- **D7/D12 Risk**: RiskAssessment, severity(1-5)×probability(1-5)=RPN(1-25). Tested T-RISK-01. ✅
- **D8 Polymorphic linkage**: entityType + entityId, service-validated (allowed type, entity exists, site ownership match, cross-site rejected). Tested T-LINK-01, T-ISOL-04. ✅
- **D9 Document Control**: string refs only; no DC subsystem (Phase 7). ✅
- **D10 NCR disposition → scrap**: no auto-create; NCR links to ProductionScrap via optional `ncrId`; human action required. ✅
- **D11 Deviation validity**: validFrom/validUntil optional; expiration does NOT auto-close; no silent mutation by date. Tested. ✅

## 3. Entities

NCR, Deviation, Investigation, CAPA (polymorphic source + optional investigationId), ChangeControl, RiskAssessment. All site-owned, all carry controlled-record fields (unique ID, status, owner, evidence, audit trail, closure criteria).

## 4. State machines

- **NCR**: DRAFT→CONTAINMENT→INVESTIGATION→DISPOSITION→CLOSED; +CANCELLED (from DRAFT/CONTAINMENT). CLOSED + CANCELLED terminal.
- **Deviation**: DRAFT→ASSESSMENT→INVESTIGATION(optional)→REVIEW→CLOSED; +REJECTED (from DRAFT/ASSESSMENT/REVIEW). CLOSED + REJECTED terminal.
- **Investigation**: IN_PROGRESS→CONCLUDED. CONCLUDED terminal.
- **CAPA**: OPEN→ACTION_PLAN→IMPLEMENTATION→EFFECTIVENESS→CLOSED. CLOSED terminal. **Closure guard**: effectivenessVerification + effectivenessVerifiedByUserId required.
- **ChangeControl**: REQUEST→IMPACT→RISK→APPROVAL→IMPLEMENTATION→VERIFICATION→EFFECTIVENESS→CLOSED; +REJECTED. CLOSED + REJECTED terminal. **Implementation guard**: approvedByUserId + approvedAt required.
- All transitions explicit (`/transition` endpoint), validated (state-machine guard), authorized (`requirePermission`), audited (previousState/newState + reason). No arbitrary state mutation.

## 5. API routes

14 route handlers: ncrs (list/create/get/transition), deviations (list/create/transition/approve), investigations (create/conclude), capas (list/create/transition), changes (create/transition/approve), risks (create/update). All zod-validated, envelope-wrapped, RBAC-guarded. Closure/approval guards in service layer.

## 6. Permissions

27 `quality.*` permissions. Least-privilege: super_admin full; site_admin read+create+transition (no approve); quality_manager/quality_engineer full quality (incl. approve/close); qa_reviewer read+transition+approve; plant_manager/production_manager read; auditor read-only. **AI governance**: no `quality.*.approve`, `quality.*.close`, or controlled `quality.*.transition` permission is ever granted to an AI role (Phase 12). Service layer enforces human-only via `requirePermission` (derived from next-auth human session).

## 7. UI

6 pages: ncrs (table with severity/status badges, concerns entity), deviations (table with applies-to, status), investigations (placeholder), capas (table with source/type/investigation, AI governance notice), changes (table with type/status), risks (placeholder). Sidebar "Quality" nav group (6 items, permission-gated). i18n FR/EN/AR + RTL.

## 8. Genealogy relationships

Quality records link to production via polymorphic reference (D8): NCR.concernsEntityType/Id → Batch/DeviceLot/MaterialLot/WorkOrder/etc. CAPA.sourceType/Id → NCR/Investigation/Audit/Trend/Complaint/Other. ProductionScrap.ncrId → NCR (D10 traceability). The genealogy chain is preserved and queryable (tested T-LINK-01).

## 9. Tests/results

**Vitest: 129 tests, all PASS** (9.4s).
- Phase 1 regression (17): audit immutability, RBAC denial, cross-site, lockout, pepper, session, RTL.
- Phase 2 regression (34): revision/BOM/lot state machines, quantity invariants, cross-site MaterialLot isolation, DISQUALIFIED supplier.
- Phase 3 regression (33): WO/Batch/DeviceLot state machines, consumption transactionality, routing immutability, cross-site production isolation, operator/logger separation.
- Phase 4 (45): T-NCR-01 (6), T-DEV-01 (6), T-INV-01 (3), T-CAPA-01 (7), T-CHG-01 (7), T-RISK-01 (2), T-ISOL-04 (1), T-LINK-01 (1), T-AI-GUARD-01 (3), CAPA-without-investigation (1), state-machine bypass (4), deviation expiration (1), regression (1), + 2 extra DB tests.

**Browser verification (agent-browser):**
- Admin: NCRs page shows NCR-CH-001 (CRITICAL, INVESTIGATION) ✅
- CAPAs page shows CAPA-CH-001 (IMPLEMENTATION, investigation-sourced) + CAPA-CH-002 (ACTION_PLAN, NCR-sourced without investigation [D2 mod]) ✅
- AI governance notice displayed on CAPAs page ✅
- Screenshot saved: `docs/validation/phase4-quality-capas.png`

## 10. Defects found/fixed

- Prisma 1:1 relation ambiguity (NCR↔Investigation, Deviation↔Investigation) → fixed with named relations + `@unique` on investigationId.
- Bidirectional FK confusion (RiskAssessment↔Deviation/Change) → simplified to RiskAssessment-owns-FK + reverse arrays.
- Test DB missing Phase 4 tables (db push didn't create migration SQL) → generated `phase4_quality` migration via `prisma migrate diff`.
- Test parallelism causing DB reset conflicts → `fileParallelism: false` + `singleFork: true`.
- `validUntil` Date comparison in test → `.getTime()`.

## 11. Security review

- RBAC: 27 quality.* permissions, least-privilege, 3-layer enforced. ✅
- AI governance (PRD §9): no approve/close/transition perms for AI; service-layer human-only guards on CAPA closure, Deviation approval, Change approval. Tested T-AI-GUARD-01. ✅
- Polymorphic validation (D8): allowed type, entity exists, site ownership match (cross-site rejected), all audited. ✅
- CAPA closure guard: effectivenessVerification + human verifier required. ✅
- Change implementation guard: human approval required. ✅
- All transitions explicit + authorized + audited. ✅

## 12. Site-isolation review

All 6 quality entities site-owned (SiteScope + assertSiteAccess). Cross-site leakage = CRITICAL. Tested T-ISOL-04 (Site-A NCR not visible from Site-B). Quality-to-production polymorphic references also respect site isolation (cross-site linkage rejected at service layer).

## 13. Audit review

Every create/transition/approve/conclude emits AuditEvent (quality.ncr.create/transition, quality.deviation.create/transition/approve, quality.investigation.create/conclude, quality.capa.create/transition, quality.change.create/transition/approve, quality.risk.create/update). previousState/newState + reason captured. Audit append-only (Phase 1 triggers; regression-tested).

## 14. Data-integrity review

- FKs + cascades: Restrict for Site (quality records survive site deletion? No — Restrict prevents site deletion while quality records exist); SetNull for optional User/Investigation links. ✅
- Uniques: NCR(siteId,code), Deviation(siteId,code), Investigation(siteId,code), CAPA(siteId,code), ChangeControl(siteId,code), RiskAssessment(siteId,code), NCR.investigationId @unique (1:1), Deviation.investigationId @unique (1:1). ✅
- State machines: all enforced. ✅
- Polymorphic references: service-validated (entity exists + same site). ✅
- RPN: computed = severity × probability, 1-25. ✅

## 15. Browser verification

Admin: NCRs page (NCR-CH-001 CRITICAL INVESTIGATION), CAPAs page (CAPA-CH-001 IMPLEMENTATION + CAPA-CH-002 ACTION_PLAN [D2 mod] + AI governance notice), Deviations/Changes pages render. Screenshot saved.

## 16. Known limitations

1. **Audit site-scoping** best-effort (RLS when PG).
2. **Polymorphic references** service-validated (not DB FKs); PG could add validation triggers.
3. **CAPA/Change closure/approval guards** service-enforced (cleaner error than DB trigger); Phase 13 may add DB guards.
4. **Playwright E2E** for quality flows added to backlog.
5. **No Document Control** (Phase 7); string refs only.
6. **No Laboratory/Testing** (Phase 5).
7. **No Batch Review/Release** (Phase 9).
8. **Investigations/Risks pages** are placeholders (list view; full UI deferred).
9. **vitest.config.ts poolOptions** type warning (non-blocking; vitest runtime supports it).

## 17. Technical debt

- 88 ESLint warnings (mostly pre-existing shadcn `any` + unused vars in tests).
- `middleware.ts` → `proxy.ts` rename (Next 16 deprecation, carried).
- Transition buttons UI (NCR/Deviation/CAPA/Change state transitions; API ready, UI deferred).
- Investigations/Risks list pages not yet fetching data (placeholder UI).

## 18. Production blockers

- **PostgreSQL migration (ADR-0002)** required before production. Owner carry-forward #1.
- No other production blockers for Phase 4 scope.

## 19. Final acceptance status

**CONDITIONAL PASS.**

Phase 4 is functionally complete, secure, tested (129/129 tests green incl. all 9 critical Phase 4 tests + CAPA-without-investigation + state-machine bypass + AI governance + regression), and browser-verified. Conditions are the known limitations above (none block Phase 5; all are Phase 13 hardening except the PostgreSQL migration which is required before production).

```
PHASE 4 STATUS: READY FOR OWNER REVIEW
```

**STOP.** Not starting Phase 5. Awaiting owner explicit approval.
