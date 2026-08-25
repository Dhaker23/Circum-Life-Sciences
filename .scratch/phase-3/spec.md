# Phase 3 — Spec

> Published via `to-spec` from the approved Phase 3 Implementation Plan (`docs/PRD/PHASE-3-IMPLEMENTATION-PLAN.md`). Owner confirmed D1-D11 exactly as proposed. Binding constraints below.

## Objective
Establish the manufacturing execution domain: Work Order, Routing, Operation, Work Center, Manufacturing Batch, Device Lot, production execution (OperationExecution, Material Consumption/Reservation, Scrap/Rework), Shifts. The middle of the traceability genealogy (PRD section 10). No Phase 4+ functionality.

## Binding domain decisions (owner-confirmed)
- D1: ManufacturingBatch 1:N DeviceLot. Separate entities; never merged. Batch split into Device Lots for downstream segmentation.
- D2: WorkOrder 1:N ManufacturingBatch.
- D3: WorkCenter now (site-owned location/station). Equipment master/maintenance/calibration = Phase 8. Design so Equipment links to WorkCenter later without restructuring.
- D4: Operator = Employee (not User; not every operator has a login). Logger = authenticated User. Both auditable.
- D5: BOTH reservation + consumption. Reservation = planned allocation (updates quantityReserved, NOT consumed). Consumption = actual usage (decrements quantityAvailable, transactional, rejects over-consumption, preserves genealogy).
- D6: Routing 1:1 with ProductRevision, global, frozen when EFFECTIVE (same as BOM, ADR-0006).
- D7: WO: PLANNED->RELEASED->IN_PRODUCTION->COMPLETED->CLOSED +ON_HOLD/CANCELLED. Batch: PLANNED->IN_PRODUCTION->COMPLETED->READY_FOR_REVIEW +ON_HOLD. DeviceLot: CREATED->IN_PROCESS->COMPLETED. Phase 3 STOPS at READY_FOR_REVIEW (no QA release/disposition).
- D8: ProductionScrap + ProductionRework separate entities (quantity, reason, operator, logger, timestamp, audit). Full RCA/CAPA = Phase 6.
- D9: Manufacturing instructions = basic text field on Operation; no Document Control subsystem.
- D10: Shift = basic identity; no complex handover workflow.
- D11: Customer/Project OUT OF SCOPE.

## Critical traceability rule (owner)
Genealogy chain MUST be preserved:
Product -> ProductRevision -> {BOM, Routing} -> WorkOrder -> ManufacturingBatch -> DeviceLot -> OperationExecution -> MaterialConsumption -> MaterialLot
No alternative genealogy relationships. Phase 3 establishes the data foundation to answer: which material lots consumed for a device lot? which device lots from a batch? which WO produced a batch? which revision/BOM/routing governed production?

## In-scope deliverables
1. Prisma schema (additive, PG-portable): 12 new models + relations.
2. Domain layer: WO/Batch/DeviceLot state machines, routing immutability, quantity invariants, consumption transactionality.
3. Service layer: production module with can()+audit()+SiteScope. Transactional consumption.
4. API: /api/production/** with /transition endpoints.
5. UI: production pages + sidebar nav + i18n (FR/EN/AR).
6. Permissions: production.* catalog + least-privilege grants.
7. DEMO seed: work centers, shifts, routings+operations, work orders, batches, device lots, consumptions, executions, scrap/rework. All DEMO/TEST.
8. Tests: T-WO-01, T-BATCH-01, T-LOT-02, T-CONS-01, T-RES-01, T-ROUTE-01, T-ISOL-03, T-EXEC-01, T-SCRAP-01 + genealogy + regression. Phase 1+2 tests still pass.
9. Docs: ADRs 0008-0009, API docs, CONTEXT/GLOSSARY confirmed.

## Out of scope
NCR/Deviation/CAPA/RCA (Phase 6). Equipment maintenance/calibration (Phase 8). Batch Review/Release/Disposition (Phase 9). OEE/VSM (Phase 10). AI (Phase 12). Customer/Project. Full Document Control. Complex shift handover.

## Acceptance (DoD)
See Phase 3 Plan section 15 (17 points). Build/lint/typecheck/tests all pass. Browser-verified. Phase Gate complete (21 checks). Validation Report. STOP.
