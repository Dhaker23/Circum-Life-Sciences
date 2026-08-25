# Phase 2 — Spec

> Published via `to-spec` from the approved Phase 2 Implementation Plan (`docs/PRD/PHASE-2-IMPLEMENTATION-PLAN.md`). Owner confirmed D1-D8 exactly as proposed. Binding constraints below.

## Objective
Establish the manufacturing master-data foundation: Product, ProductRevision, BOM, BOMLine, Material, MaterialSupplier, MaterialLot, Supplier. The input-side prefix of the traceability genealogy (PRD section 10). No Phase 3 functionality.

## Binding domain decisions (owner-confirmed)
- D1: Device = conceptual (NOT a table). Product.deviceClass captures regulatory class. Future serialized-device traceability not prohibited but out of Phase 2.
- D2: BOM 1:1 with ProductRevision. Frozen when EFFECTIVE (immutable; no edit/delete of BOM or lines). Changes require a new Revision. BOM editable only in DRAFT/IN_REVIEW.
- D3: MaterialLot lifecycle: RECEIVED -> QUARANTINE -> APPROVED -> IN_USE -> EXHAUSTED; QUARANTINE -> REJECTED (terminal). Track quantityReceived + quantityAvailable. Transitions explicit/validated/audited. No arbitrary state changes via direct API/DB.
- D4: GLOBAL (no siteId): Product, ProductRevision, BOM, BOMLine, Material, MaterialSupplier, Supplier. SITE-OWNED: MaterialLot (siteId required, SiteScope enforced). Cross-site MaterialLot leakage = CRITICAL defect.
- D5: Material M:N Supplier via MaterialSupplier (isPreferred). MaterialLot belongs to exactly ONE Supplier. Supplier qualificationStatus: APPROVED/CONDITIONAL/DISQUALIFIED. DISQUALIFIED supplier cannot be silently treated as approved (enforce on MaterialLot create/transition).
- D6: deviceClass enum (I/IIa/IIb/III + non-device), controlled.
- D7: CoA document link DEFERRED (string ref field only; full integration with Document Control later).
- D8: Customer/Project OUT OF SCOPE.
- IMPORTANT: Do NOT invent additional domain entities.

## In-scope deliverables
1. Prisma schema (additive, PG-portable): 8 new models.
2. Domain layer: ProductRevision state machine, MaterialLot state machine, BOM immutability guard, quantity invariants (available <= received, > 0).
3. Service layer: manufacturing module (products/revisions/bom/materials/lots/suppliers) with can() + audit() + SiteScope + DISQUALIFIED supplier enforcement.
4. API: /api/manufacturing/** with explicit /transition endpoints (audited). BOM mutation rejected when revision not DRAFT/IN_REVIEW.
5. UI: manufacturing pages (products, revisions, bom, materials, material-lots, suppliers) + sidebar nav + i18n (FR/EN/AR).
6. Permissions: manufacturing.* catalog + least-privilege grants.
7. DEMO seed: products (DEVICE IIa/IIb + COMPONENT), revisions (EFFECTIVE + DRAFT), BOMs, materials, suppliers, site-owned lots in various statuses. All DEMO/TEST labelled.
8. Tests: T-ISOL-02, T-BOM-01, T-REV-01, T-LOT-01, T-QUANT-01 + unit/integration/API/regression. Phase 1 tests still pass.
9. Docs: ADRs 0006-0007, API docs, CONTEXT/GLOSSARY confirmed.

## Out of scope
Work Order, Routing, Operation, Manufacturing Batch, Device Lot (Phase 3). Traceability execution queries (Phase 4). NCR/Deviation/CAPA (Phase 6). Change Control (Phase 7). Document Control/CoA (Phase 7). Customer/Project. Serialized device tracking.

## Acceptance (DoD)
See Phase 2 Plan section 15 (13 points). Build/lint/typecheck/tests all pass. Browser-verified. Phase Gate complete. Validation Report. STOP.
