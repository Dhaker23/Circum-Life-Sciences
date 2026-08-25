# Phase 5 — Spec

> Published via `to-spec` from the approved Phase 5 Implementation Plan. Owner confirmed D1-D11. Binding constraints below.

## Objective
Establish the Laboratory, Inspection, Testing, and Specifications domain. PRD section 5 chain: Product/Lot -> Sample -> Test -> Method -> Specification -> Result -> Review -> Disposition. Never invent specifications. No Phase 6+ functionality.

## Binding domain decisions (owner-confirmed)
- D1: Inspection (shop-floor, simple) != Laboratory Test (formal lab, sample+method+result+review+disposition). Separate entities. No generic QualityCheck.
- D2: Specification = standalone controlled entity. Never invented by system. Created/approved by authorized humans.
- D3: TestMethod (how) != Specification (what's acceptable). TestMethod M:N Specification via TestMethodSpec.
- D4: Sample: DRAWN->RECEIVED_IN_LAB->IN_TEST->CONSUMED or RETAINED (terminal). Multiple TestResults per Sample. Every TestResult preserves traceability to its exact Sample.
- D5 (CRITICAL): TestResult: SAMPLE_RECEIVED->IN_PROGRESS->RESULT_ENTERED->REVIEWED->DISPOSITIONED. **AUTOMATIC EVALUATION MUST NOT EQUAL DISPOSITION.** System may evaluate PASS/FAIL/NOT_EVALUABLE against spec, but PASS must NOT auto-release, FAIL must NOT auto-reject. Human review + human disposition required. AI MUST NEVER disposition. Dispositions: PASS_RELEASE/FAIL_HOLD/FAIL_REJECT/CONDITIONAL_RELEASE.
- D6: Inspection: PENDING->PASSED/FAILED/CONDITIONAL (simple, no review/disposition workflow).
- D7: Specification: DRAFT->APPROVED->EFFECTIVE->SUPERSEDED. Immutable when EFFECTIVE. AI must never approve/modify/override/invent specs.
- D8: GLOBAL: Specification, TestMethod, TestMethodSpec. SITE-OWNED: Sample, TestResult, Inspection. Cross-site leakage = CRITICAL defect.
- D9: Auto-evaluation permitted (PASS/FAIL/NOT_EVALUABLE). Evaluation must be auditable (spec version, method, measured value, units, timestamp, eval logic). Evaluation != disposition.
- D10: Specification on Inspection is OPTIONAL. If present, must be effective; preserve exact revision.
- D11: Sample consumption tracking: quantity collected, consumed, remaining, consumption state, timestamps, actor/audit. Don't invent universal units.

## Critical controlled-workflow rule (D5)
Measured Result -> Specification Evaluation (PASS/FAIL/NOT_EVALUABLE) -> Human Review -> Human Disposition
The system evaluates but does NOT disposition. Human authorization required for all dispositions.

## AI governance (owner)
AI may: summarize, assist analysis, highlight unusual results, explain specs, assist users.
AI MUST NEVER: create/modify/approve/override specs, invent acceptance criteria, change measured results, disposition TestResults, release/reject results, bypass human review/RBAC, modify audit.

## Traceability chain (owner)
Product/Lot -> Sample -> Test -> Test Method -> Specification -> Result -> Review -> Human Disposition
Never break traceability. Preserve exact Specification revision on TestResult.

## In-scope deliverables
1. Prisma schema (additive, PG-portable): 6 new models + NCR/Site/User/Employee relations.
2. Domain layer: Spec/Method/Sample/Result/Inspection state machines, auto-evaluation logic (eval != disposition), spec immutability, sample quantity invariants.
3. Service layer: laboratory module with can()+audit()+SiteScope+polymorphic validation+human-only disposition/approval guards.
4. API: /api/lab/** + /api/inspection/** with /transition, /disposition.
5. UI: 5 lab/inspection pages + sidebar nav + i18n (FR/EN/AR).
6. Permissions: lab.* + inspection.* catalog + least-privilege grants; AI never approve/disposition.
7. DEMO seed: specs, methods, samples, results (PASS + FAIL), inspections. All DEMO/TEST.
8. Tests: 11 critical + 14 extra + regression (129 prior).
9. Docs: ADRs 0012-0013, API docs, CONTEXT/GLOSSARY confirmed.

## Out of scope
Equipment/Calibration (Phase 8). Cleanroom (Phase 9). Packaging/Sterilization (Phase 9). Batch Review/Release (Phase 9). OEE/VSM (Phase 10). AI (Phase 12). Document Control (Phase 7). Full FMEA.

## Acceptance (DoD)
See Phase 5 Plan section 15 (18 points). Build/lint/typecheck/tests all pass. Browser-verified. Phase Gate complete. Validation Report. STOP.
