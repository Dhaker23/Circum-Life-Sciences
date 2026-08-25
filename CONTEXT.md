# Circum — CONTEXT (Ubiquitous Language)

> This is the **concise glossary** of the Circum ubiquitous language. It is devoid of implementation details. For detailed definitions, regulatory context, and controlled-workflow state machines, see `DOMAIN_GLOSSARY.md`. For the authoritative product scope, see `docs/PRD/` (Circum Master PRD).
>
> Maintained per the `domain-modeling` skill: terms are captured here as they are resolved during grilling/design. Challenge any drift against this file.

## Language

**Site**
A physical manufacturing location (e.g. a cleanroom facility). Owns Departments, Equipment, Cleanrooms, and is the scoping boundary for much RBAC and traceability.

**Product**
A medical device or manufactured item type that Circum produces. Has Revisions and a BOM. _Avoid_: SKU (use only when quoting external systems), article.

**Product Revision**
A controlled version of a Product's design/specification. A Revision carries its own BOM and routing. Traceability flows through Revisions, not just Products.

**BOM (Bill of Materials)**
The controlled list of Materials (with quantities) required to build one unit of a Product Revision.

**Material**
A physical input substance/component tracked in the BOM. Has Material Lots from Suppliers.

**Material Lot**
A specific received batch of a Material from a Supplier, with its own quantity, status, and genealogy. _Avoid_: batch (reserved for Manufacturing Batch).

**Supplier**
An external source of Materials or services. Tracked for supplier quality.

**Work Order**
An authorized instruction to produce a quantity of a Product Revision by a date, following a Routing. Consumes Material Lots and produces Manufacturing Batches / Device Lots.

**Routing**
The controlled sequence of Operations to build a Product Revision.

**Operation**
A single step in a Routing, executed on Equipment by Operators, with parameters and inspection.

**Manufacturing Batch**
A produced quantity of a Product Revision under one Work Order, tracked as a single traceable unit through QC, packaging, sterilization, review, and release. _Avoid_: lot (ambiguous; use Device Lot or Material Lot).

**Device Lot**
A traceable unit of finished devices, typically a subset/split of a Manufacturing Batch, carrying full genealogy through to shipment.

**Equipment**
A physical machine/instrument used in an Operation or test. Tracked for maintenance and calibration status (VALID / EXPIRING / EXPIRED / OUT OF SERVICE).

**Inspection**
A quality check (in-process or final) producing a pass/fail or measured result against a Specification.

**Specification**
The controlled acceptance criterion for a Test. _Never invented_ by software; configurable, never overridden by AI.

**Test / Test Method**
A laboratory or in-process examination of a Sample producing a Result reviewed against a Specification.

**NCR (Nonconformance Report)**
A record that something does not conform to requirements. Triggers Deviation/RCA/CAPA as applicable.

**Deviation**
A controlled record of a planned departure from an approved process/specification, with assessment, investigation, review, closure.

**RCA (Root Cause Analysis)**
The structured investigation identifying the root cause of an NCR/Deviation.

**CAPA (Corrective and Preventive Action)**
A controlled record of actions to correct and prevent recurrence, with effectiveness verification before closure.

**Change Control**
A controlled record governing changes to products, processes, documents, equipment, etc. (Request → Impact → Risk → Approval → Implementation → Verification → Effectiveness → Closure).

**Risk**
A managed record of hazards, severity, probability, and mitigations for a product/process.

**Validation**
Evidence-generating qualification: IQ (Installation), OQ (Operational), PQ (Performance), plus process/equipment/cleanroom/test-method validation. Never invents acceptance criteria.

**Cleanroom**
A monitored classified room with configurable points, parameters, units, and alert/action limits. Limits are never hard-coded.

**Packaging**
The controlled process/materials/lots that configure, pack, and inspect finished devices.

**Sterilization**
A configurable process (EtO, Gamma, Beta/e-beam, X-ray) applied to a Device Lot, tracked per cycle/parameters/release. Software **never** autonomously releases sterile product.

**Batch Review**
The QA review of a Manufacturing Batch's full record (production, materials, traceability, equipment, operators, inspection, lab, deviations, NCR, CAPA, packaging, sterilization, controlled documents) before disposition.

**Disposition / Release**
The authorized human decision on a reviewed batch: Approved (Released) / Hold / Rework / Reject. Never performed by AI.

**Audit Trail**
Immutable record of who/what/when/previous→new/reason/session for controlled records. Normal users cannot edit/delete it.

**OEE**
Overall Equipment Effectiveness = Availability × Performance × Quality.

**VSM (Value Stream Map)**
Supplier → Material → Process → Inventory → Process → Customer, measuring lead time, value-added time, non-value-added time, value-added ratio.

## Relationships

- A **Site** has many **Departments**, **Equipment**, **Cleanrooms**.
- A **Product** has many **Product Revisions**; a Revision has one **BOM** and one **Routing**.
- A **BOM** references many **Materials**; a **Material** has many **Material Lots** from a **Supplier**.
- A **Work Order** (for a **Product Revision**) consumes **Material Lots**, follows a **Routing** of **Operations**, and produces **Manufacturing Batches** / **Device Lots**.
- A **Manufacturing Batch** / **Device Lot** links to **Operations**, **Equipment**, **Operators**, **Inspections**/**Tests**, **Packaging**, **Sterilization**, and is subject to **Batch Review** → **Disposition**.
- An **NCR** may trigger a **Deviation** → **RCA** → **CAPA**; a **Change Control** may be raised separately.
- **Validation** (IQ/OQ/PQ) qualifies **Equipment**, processes, **Cleanrooms**, test methods.

## Flagged ambiguities (resolve via `/grill-with-docs` before Phase 1)

- **"lot"**: overloaded. Resolved proposal — use **Material Lot** (input) vs **Device Lot** (output) vs **Manufacturing Batch** (the production run). Owner to confirm.
- **"batch" vs "device lot"**: is a Device Lot always a sub-division of a Manufacturing Batch, or can they be 1:1? Open for Phase 1 grilling.
- **"release"**: overloaded (sterilization release vs batch disposition/release vs document effective-release). Proposal — qualify each use. Owner to confirm.
- **"deviation" vs "ncr"**: a Deviation is a *planned* departure; an NCR is an *unplanned* nonconformance. Owner to confirm Circum's exact usage.
- **CONTEXT.md vs DOMAIN_GLOSSARY.md overlap**: proposal — CONTEXT.md = concise ubiquitous language (this file); DOMAIN_GLOSSARY.md = detailed definitions + workflow state machines + regulatory notes. Owner to confirm the split.

## Phase 2 proposed terms (domain-modeling, pending owner confirmation D1-D5)

> Sharpened via `grill-with-docs` + `domain-modeling` for Phase 2 (Product/Revision/BOM/Material/MaterialLot/Supplier). These are PROPOSED resolutions grounded in the PRD; not yet confirmed. See `docs/PRD/PHASE-2-IMPLEMENTATION-PLAN.md` §3.

**Device** (PROPOSED D1)
Conceptual terminology for a *finished unit* of a Product. NOT a separate master-data entity. "Device Lot" (Phase 3) is a traceable batch of finished Product units. Regulatory classification lives on Product as `deviceClass`. _Avoid_: modeling Device as a separate table (doubles relationships).

**Product Revision** (PROPOSED D2 — effectivity)
A controlled version of a Product's design/spec. Has exactly one BOM (1:1). State machine: `DRAFT → IN_REVIEW → APPROVED → EFFECTIVE → SUPERSEDED → OBSOLETE`. When a Revision becomes EFFECTIVE, its BOM is **frozen** (immutable). Any BOM change requires a new Revision (via Change Control, Phase 7). A Revision is superseded by exactly one newer Revision (`supersededById`).

**Material Lot** (PROPOSED D3 — lifecycle)
A received batch of a Material from a Supplier, at a Site. State machine: `RECEIVED → QUARANTINE → APPROVED → IN_USE → EXHAUSTED`, plus `QUARANTINE → REJECTED` (terminal). `APPROVED → QUARANTINE` allowed (return to quarantine on issue). Tracks `quantityReceived` and `quantityAvailable` (available ≤ received, invariant).

**Site ownership** (PROPOSED D4)
Product, ProductRevision, BOM, BOMLine, Material, MaterialSupplier, Supplier are **global** (shared catalog/procurement data, no siteId). MaterialLot is **site-owned** (`siteId` required; multi-site isolation applies). Transfer between sites is a future Phase 13 logistics feature.

**Supplier–Material** (PROPOSED D5)
A Material can be sourced from many Suppliers (M:N via MaterialSupplier, with `isPreferred`). A MaterialLot comes from exactly one Supplier. Supplier `qualificationStatus`: APPROVED / CONDITIONAL / DISQUALIFIED (foundation for supplier quality, Phase 7).
