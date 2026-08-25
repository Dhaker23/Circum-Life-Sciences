# Phase 4 — Spec

> Published via `to-spec` from the approved Phase 4 Implementation Plan. Owner confirmed D1-D12 with a critical modification to D2 (CAPA does NOT hard-require an Investigation; polymorphic source). Binding constraints below.

## Objective
Establish the Quality foundation: NCR, Deviation, Investigation (RCA), CAPA, Change Control, Risk Assessment. Controlled records with strict state machines, human-only approval gates, AI governance (PRD section 9). Links to production via polymorphic reference. No Phase 5+ functionality.

## Binding domain decisions (owner-confirmed)
- D1: NCR (unplanned) and Deviation (planned) are SEPARATE entities. Never merged. No generic QualityIssue.
- D2 (MODIFIED): Investigation and CAPA are separate entities. Investigation finds cause; CAPA acts. BUT CAPA does NOT hard-require an Investigation. CAPA uses polymorphic source (sourceType + sourceId) to allow future sources (NCR/audit/trend/complaint/investigation/other) without DB redesign. Optional investigationId FK for the common case. Source-specific rules in service layer.
- D3: NCR state machine: DRAFT->CONTAINMENT->INVESTIGATION->DISPOSITION->CLOSED +CANCELLED. All transitions explicit/validated/authorized/audited.
- D4: Deviation: DRAFT->ASSESSMENT->INVESTIGATION(optional)->REVIEW->CLOSED +REJECTED. Do not silently skip assessment/review.
- D5: CAPA: OPEN->ACTION_PLAN->IMPLEMENTATION->EFFECTIVENESS->CLOSED. Closure requires effectiveness verification + authorized human + evidence + audit. AI MUST NEVER close CAPA.
- D6: Change Control: REQUEST->IMPACT->RISK->APPROVAL->IMPLEMENTATION->VERIFICATION->EFFECTIVENESS->CLOSED +REJECTED. Implementation requires human approval. AI MUST NEVER approve/close a change.
- D7: RiskAssessment: severity(1-5) x probability(1-5) = RPN(1-25). Foundation only; no full FMEA.
- D8: Polymorphic linkage (entityType + entityId). Strict service validation: allowed type, entity exists, site ownership matches (cross-site rejected), authorization, auditability. Invalid + cross-site references rejected + tested.
- D9: Document Control = string refs only. No DC subsystem (Phase 7).
- D10: NCR disposition does NOT auto-create ProductionScrap. NCR -> controlled disposition -> authorized human action -> ProductionScrap. Traceability maintained (ProductionScrap.ncrId optional FK).
- D11: Deviation validFrom/validUntil optional. Expiration does NOT auto-close; triggers controlled workflow/notification. No silent mutation by date.
- D12: Risk scale 1-5 / 1-5 / RPN 1-25. Simple. No full FMEA.

## Quality domain separation (owner)
NCR != Deviation. Investigation != CAPA. CAPA != Change Control. Risk != Investigation. Change != CAPA. Separate controlled records. No generic QualityIssue.

## AI governance (owner)
AI may assist (analysis, summarize, suggest). AI MUST NOT: approve NCR/Deviation/CAPA/Change, close CAPA, close controlled records, override RBAC/state machines, modify audit, bypass human gates. No AI role gets quality.*.approve or quality.*.transition permissions.

## In-scope deliverables
1. Prisma schema (additive, PG-portable): 6 new models + ProductionScrap/Rework ncrId + Site/User relations.
2. Domain layer: state machines (NCR/Deviation/CAPA/Change), closure guards (CAPA effectiveness), approval guards (Change human approval), RPN computation, polymorphic validation.
3. Service layer: quality module with can()+audit()+SiteScope+polymorphic validation+cross-site rejection+human-only guards.
4. API: /api/quality/** with /transition, /approve, /conclude; guards.
5. UI: 6 quality pages + sidebar nav + i18n (FR/EN/AR).
6. Permissions: quality.* catalog + least-privilege grants; AI never approve/transition.
7. DEMO seed: NCR against batch, investigation, CAPA (with + without investigation), deviation, change, risk. All DEMO/TEST.
8. Tests: 9 critical + CAPA-without-investigation + invalid/cross-site polymorphic + AI denial + disposition-scrap + deviation expiration + audit immutability + state-machine bypass + regression (84 prior).
9. Docs: ADRs 0010-0011, API docs, CONTEXT/GLOSSARY confirmed.

## Out of scope
Laboratory/Testing/Inspection/Sample/Specification/Result (Phase 5). Equipment/Calibration (Phase 8). Cleanroom/Packaging/Sterilization (Phase 9). Batch Review/Release (Phase 9). OEE/VSM (Phase 10). AI Assistant (Phase 12). Document Control subsystem (Phase 7). Training (Phase 7). Supplier Quality/Audits (Phase 7). Full FMEA.

## Acceptance (DoD)
See Phase 4 Plan section 15 (17 points). Build/lint/typecheck/tests all pass. Browser-verified. Phase Gate complete. Validation Report. STOP.
