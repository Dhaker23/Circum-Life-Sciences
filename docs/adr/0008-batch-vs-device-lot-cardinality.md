# ADR-0008: ManufacturingBatch 1:N DeviceLot (Production Run vs Traceable Sub-Unit)

- **Status:** Accepted (Phase 3, owner-confirmed decision D1)
- **Date:** Phase 3
- **Deciders:** Circum project owner
- **Supersedes:** (none)
- **Related:** `docs/PRD/PHASE-3-IMPLEMENTATION-PLAN.md` §3.1 and §3.9 (D1), `docs/PRD/CIRCUM_MASTER_PRD_FINAL.md` §5 (manufacturing batches / device lots), §10 (Traceability genealogy), §11 (Sterilization tracks device lot + sterilization lot separately), `CONTEXT.md` (Phase 3 proposed terms: Manufacturing Batch, Device Lot), ADR-0006 (BOM 1:1 effectivity, the controlled-Revision immutability pattern this ADR builds on), ADR-0007 (multi-site ownership model: production entities are site-owned)

## Context

Circum Master PRD §5 uses both "manufacturing batches" and "device lots" in the manufacturing-execution vocabulary without pinning down their precise relationship. PRD §10 places them in the traceability genealogy as "Work Order → Batch / Device Lot → OperationExecution → Material Consumption → MaterialLot". PRD §11 (Sterilization) tracks "device lot" and "sterilization lot" as distinct concepts, implying the unit that goes to sterilization may be smaller than the unit produced by a Work Order.

The `CONTEXT.md` ubiquitous language (Phase 3 proposed terms) distinguishes the two:

- **Manufacturing Batch** is the produced quantity of a Product Revision under one Work Order, the top-level traceable unit produced by a Work Order.
- **Device Lot** is a traceable unit of finished devices, typically a subset or split of a Manufacturing Batch, carrying full genealogy through to shipment.

The owner's critical constraint, stated during Phase 2 closure and re-affirmed in the Phase 3 brief, is: **do NOT assume that Batch = Device Lot.** This forbids the implicit merge that the PRD's slash notation ("Batch / Device Lot") can invite. The question this ADR resolves is therefore not whether the two are distinct (they are), but what the precise cardinality is.

The Phase 3 Implementation Plan §3.1 recorded this as decision D1 (proposed). The owner has confirmed D1 as proposed. This ADR records that confirmation.

## Decision

1. **ManufacturingBatch 1:N DeviceLot.** One Manufacturing Batch (the production run produced by a Work Order) may be split into multiple Device Lots. Each Device Lot belongs to exactly one Manufacturing Batch (`DeviceLot.batchId` is non-nullable, with a foreign key to `ManufacturingBatch`). They are separate entities; do NOT merge them.
2. **A Batch with exactly one Device Lot is the simple case.** The model allows splitting a production run into multiple Device Lots for downstream segmentation (sterilization lots, packaging lots, shipment lots), but it does not require it. A Batch that ships as a single traceable unit has exactly one Device Lot, and that is a valid 1:N instance where N=1.
3. **The Batch is the production-run concept.** It is the unit produced by a Work Order, the unit for production/QC review (Phase 9 Batch Review), and the parent of its Device Lots.
4. **The Device Lot is the traceable-finished-unit concept.** It is the unit that carries genealogy downstream through sterilization, packaging, and shipment (PRD §11). It is the unit referenced when a downstream process needs to identify "which finished devices".
5. **Genealogy direction.** Traceability flows `WorkOrder → ManufacturingBatch → DeviceLot → OperationExecution → MaterialConsumption → MaterialLot`. A Device Lot inherits its upstream genealogy (Work Order, Product Revision, BOM, Material Lots consumed) through its parent Batch; the Batch is the genealogical anchor for what was produced, and the Device Lot is the genealogical anchor for what is shipped.
6. **Both entities are site-owned.** Per ADR-0007 the multi-site isolation model applies. `ManufacturingBatch.siteId` and `DeviceLot.siteId` are both required (non-nullable), and both reuse the Phase 1 `SiteScope` filter and `assertSiteAccess` guard on every read / create / transition path. A Device Lot cannot be split off into a different site from its parent Batch; `DeviceLot.siteId` must equal `ManufacturingBatch.siteId` (service-layer invariant, enforced at Device Lot creation).

### Enforcement

- **Schema.** `DeviceLot.batchId` is non-nullable with a foreign key to `ManufacturingBatch` (`onDelete: Restrict`; a Batch with Device Lots cannot be deleted without first resolving the Device Lots). `DeviceLot.siteId` must equal the parent Batch's `siteId`; this is checked in the Device Lot service's create path (`assertSiteAccess` plus a `batch.siteId === deviceLot.siteId` equality check).
- **Service-layer guard.** The Device Lot service's `splitBatch(batchId, { quantities, units })` method validates that the sum of the new Device Lots' quantities does not exceed the parent Batch's `actualQuantity` (or `plannedQuantity` when splitting before completion, per the Phase 3 plan). Over-splitting is rejected with `StateTransitionError` and audited.
- **Audited.** Every Device Lot creation, status transition (`CREATED → IN_PROCESS → COMPLETED`), and quantity update emits an `AuditEvent` (`manufacturing.devicelot.created` / `.transitioned` / `.denied`) per the Phase 1 audit pattern (ADR-0005). Rejected split attempts are audited with `outcome = DENIED`.
- **Tested.** Test `T-LOT-02` asserts that a Batch can have multiple Device Lots, that quantities are tracked per Device Lot, and that over-splitting is rejected. The test is part of the Phase 3 critical-test suite (alongside `T-WO-01`, `T-BATCH-01`).

## Rationale

- **Sterilization implies splitting.** PRD §11 tracks "device lot" and "sterilization lot" as distinct concepts, and a sterilization cycle is typically applied to a subset of a production run (one sterilization load, one sterilization lot number). If the Batch were the only finished-unit concept, a single production run destined for two sterilization cycles would have to be modeled as two Batches, which loses the "one production run" meaning and forces a fake Work Order split. Modeling the Device Lot as the unit that goes to sterilization (which may be smaller than the Batch) keeps the Batch as the production-run concept and the Device Lot as the downstream-traceable unit, which is exactly what PRD §11 implies.
- **Merging would lose the ability to split a production run.** A 1:1 merge treats the Batch and the Device Lot as the same row. Any downstream segmentation (sterilization lot, packaging lot, shipment lot) then has to be modeled either as a parallel "lot" entity (which is what Device Lot already is, just hidden) or as a re-issuance of multiple Batches (which destroys the Work Order → Batch production-run meaning). 1:N keeps the split explicit and traceable.
- **1:N keeps the Batch as the production/QC review unit.** Phase 9 Batch Review reviews the production record of a Batch (materials, operations, deviations, NCRs, CAPAs). That review is per production run, not per downstream split. Keeping the Batch as the review unit, with Device Lots as its traceable children, means Batch Review (Phase 9) and Sterilization Release (PRD §11, never autonomous) operate on the right unit each.
- **The simple case is preserved.** N=1 is allowed and is the default for production runs that are not split. The 1:N model is a strict superset of the 1:1 model: any 1:1 deployment is a 1:N deployment with one Device Lot per Batch. The cost of allowing N>1 is one extra entity and one extra foreign key; the cost of forbidding N>1 is the inability to segment a production run at all without redefining what a Batch is.

## Alternatives considered

- **1:1 (Manufacturing Batch and Device Lot are the same entity, one row).** Rejected. The owner explicitly forbade the assumption that Batch = Device Lot. Beyond that constraint, a 1:1 merge makes "Device Lot" a redundant alias for "Batch", removes the language the PRD uses to talk about downstream-traceable sub-units (PRD §11), and forces any future splitting to be modeled as multiple Batches per production run, which destroys the Work Order → Batch production-run meaning. The 1:1 case is preserved within 1:N as N=1; nothing is lost.
- **N:M (a Device Lot can span multiple Batches).** Rejected. A Device Lot that draws units from more than one Batch is not a traceable unit: its upstream genealogy (which Material Lots, which Operation Executions, which operators, which equipment) would be a union across Batches rather than a single chain, and the answer to "what was this Device Lot made from?" becomes ambiguous. PRD §10 requires a single traceability chain per finished unit. N:M breaks that property and is not considered further.
- **Device Lot as a status flag on the Batch (no separate entity).** Rejected. A flag cannot carry its own quantity, status, downstream lot numbers, sterilization references, or genealogy. Splitting a Batch into three Device Lots requires three independent state machines and three independent downstream chains; a flag on the Batch cannot represent that.

## Consequences

- **Positive (supports sterilization, packaging, and shipment segmentation).** A production run can be split into Device Lots that each go to a different sterilization cycle, packaging configuration, or shipment, while remaining children of one Batch. Phase 11 (Sterilization) and future packaging/shipment work operate on Device Lots without restructuring the production domain.
- **Positive (clean separation of production unit vs traceable unit).** The Batch is the unit produced and reviewed; the Device Lot is the unit shipped and traced downstream. Each phase that operates on production data has a clear, single entity to target.
- **Positive (forward-compatible with Phase 9 Batch Review).** Phase 9 Batch Review operates on a Manufacturing Batch and aggregates its Device Lots, Operation Executions, Material Consumptions, deviations, and NCRs. The 1:N model gives Phase 9 a stable parent entity to review against.
- **Negative / cost (two entities where one might suffice in the simple case).** Every Batch requires at least one Device Lot to be a useful traceable unit (a Batch with zero Device Lots is a planned or in-production Batch whose finished units have not yet been segmented). The service layer must auto-create a single Device Lot on Batch completion when no explicit split has been recorded, so the simple case stays simple for operators. This is a small, intentional cost.
- **Schema impact.** `ManufacturingBatch` has a one-to-many relation to `DeviceLot`. `DeviceLot.batchId` is non-nullable, foreign key to `ManufacturingBatch`, `onDelete: Restrict`. `DeviceLot.siteId` is non-nullable and must equal the parent Batch's `siteId` (service-layer invariant). `DeviceLot` carries its own `code` (unique per site), `quantity`, `unit`, and `status` (`CREATED`, `IN_PROCESS`, `COMPLETED`, per the Phase 3 plan D7).
- **Genealogy impact.** Combined with D2 (Work Order 1:N Manufacturing Batch), the full Phase 3 production genealogy is `WorkOrder 1:N ManufacturingBatch 1:N DeviceLot`, and traceability flows `WorkOrder → ManufacturingBatch → DeviceLot → OperationExecution → MaterialConsumption → MaterialLot`. This is the chain that Phase 9 Batch Review, Phase 11 Sterilization, and future recall/trace queries walk.
- **Risk (a user splits a Batch into too many Device Lots).** Excessive splitting complicates downstream tracking without operational benefit. Mitigated by: (a) the over-split guard (sum of Device Lot quantities cannot exceed the Batch quantity), (b) the audit trail on every split, (c) operational guidance that a Device Lot should correspond to a real downstream segmentation (a sterilization load, a packaging configuration, a shipment), not an arbitrary sub-division.
- **Reversibility.** Medium. Switching to 1:1 later would require collapsing every Batch's Device Lots into the Batch row, which is structurally possible but would lose the split history. Not planned.

## Compliance note

This ADR records an engineering control that supports production traceability by keeping the production-run unit (Manufacturing Batch) distinct from the downstream-traceable finished unit (Device Lot) and by allowing a production run to be split into traceable sub-units. It is not a claim of ISO 13485 / FDA 21 CFR Part 820 / Part 11 / GxP compliance. Compliance depends on intended use, validated configuration, the eventual Batch Review and Sterilization workflows (Phases 9 and 11), infrastructure, and evidence (PRD §17).
