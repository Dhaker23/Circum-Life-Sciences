# ADR-0006: BOM is 1:1 with ProductRevision and Frozen at Effectivity

- **Status:** Accepted (Phase 2, owner-confirmed decision D2)
- **Date:** Phase 2
- **Deciders:** Circum project owner
- **Supersedes:** (none)
- **Related:** ADR-0002 (SQLite to PostgreSQL migration), `docs/PRD/PHASE-2-IMPLEMENTATION-PLAN.md` §3.2, `CONTEXT.md` (Phase 2 proposed terms, Product Revision effectivity)

## Context

Circum Master PRD §10 places the Bill of Materials (BOM) under the Product Revision in the traceability genealogy: "Product → Revision → BOM → Material Lot → …". The ubiquitous language in `CONTEXT.md` states "a Revision carries its own BOM and routing", and the BOM is defined as the controlled list of Materials (with quantities) required to build one unit of a Product Revision.

The Phase 2 domain-modeling pass surfaced an ambiguity that the PRD does not resolve directly: **is the BOM independently versioned with its own effectivity dates, or is it 1:1 with its Product Revision and frozen when that Revision becomes Effective?**

This matters for traceability (PRD priority order: Safety > Quality > Traceability > …). If a BOM can be edited in place after a Revision is Effective, then the answer to "which BOM produced this Lot?" becomes ambiguous: a Lot built yesterday may have been produced against BOM contents that no longer match the BOM row referenced by its Revision. For a medical-device QMS that is unacceptable.

The Phase 2 Implementation Plan (§3.2) recorded this as decision D2 (proposed). The owner has confirmed D2 as proposed. This ADR records that confirmation.

## Decision

1. **BOM is 1:1 with ProductRevision.** `BOM.productRevisionId` is unique. A Product Revision has exactly one BOM; a BOM belongs to exactly one Product Revision. There is no independent BOM version number, no `effectiveFrom`/`effectiveTo` on the BOM itself, and no many-to-one from BOMs to a Revision.
2. **The BOM becomes immutable when its ProductRevision becomes `EFFECTIVE`.** Once the Revision reaches `EFFECTIVE`, the BOM and every BOMLine under it are frozen: BOMLines cannot be edited, added, or deleted; the BOM row itself cannot be modified or deleted. The BOM's `status` field mirrors the Revision's status.
3. **Any BOM change requires a new ProductRevision**, created through Change Control (Phase 7). When the new Revision becomes `EFFECTIVE`, the previous Revision transitions to `SUPERSEDED` via its `supersededById` self-reference. The superseded Revision and its BOM remain immutable and queryable for genealogy.
4. **BOM edits are allowed only while the Revision is `DRAFT` or `IN_REVIEW`.** Once the Revision reaches `APPROVED`, the BOM is already locked (the lock is applied at `EFFECTIVE` at the latest, and `APPROVED` is treated as locked to prevent last-minute edits between approval and effectivity). The mutability window is closed before approval.
5. **Traceability takes priority over implementation convenience** (PRD priority order, CLAUDE.md). The strictest, most traceable model is chosen deliberately. A BOM change is a design change, not a clerical correction.

### Enforcement

- **Service-layer guard.** The BOM and BOMLine service methods (create / update / delete / reorder) consult the parent Revision's `status`. If the status is `APPROVED`, `EFFECTIVE`, `SUPERSEDED`, or `OBSOLETE`, the mutation is rejected and the service throws `StateTransitionError` (the existing domain error type from Phase 1). The guard is in the service layer, not the API layer alone, so it applies to every caller (API, scheduled job, future import script).
- **Audited.** A rejected mutation attempt still emits an `AuditEvent` (action `manufacturing.bom.denied` or `manufacturing.bomline.denied`, outcome `DENIED`) with the actor, the Revision id, and the attempted action, per the Phase 1 audit pattern (ADR-0005). Failed attempts are inspectable.
- **Tested.** Test `T-BOM-01` asserts that a BOMLine edit (add / update / delete) against an `EFFECTIVE` Revision is rejected by the service and that the audit event is written. The test is part of the Phase 2 critical-test suite.
- **No DB-level trigger in Phase 2.** Immutability is enforced in the service layer in Phase 2 (consistent with how the Phase 1 audit triggers are reserved for the highest-risk invariant, append-only audit). If a future risk assessment recommends a DB-level backstop on BOMLine for an Effective Revision, it can be added as a `BEFORE UPDATE` / `BEFORE DELETE` trigger on the same pattern as ADR-0005. Not required for Phase 2.

## Alternatives considered

- **BOM independently versioned with its own effectivity dates** (`BOM.version`, `BOM.effectiveFrom`, `BOM.effectiveTo`, many BOMs per Revision): rejected. This gives weaker traceability because the Revision no longer uniquely identifies "the BOM that built this Lot". The question "which BOM produced this Lot?" becomes a date-range join (Lot.productionDate between BOM.effectiveFrom and BOM.effectiveTo), which is fragile under clock skew, timezone handling, and back-dated entries. It also lets a BOM change without a corresponding Revision change, which is exactly what medical-device design control forbids: a BOM change is a design change and requires a new revision plus re-validation impact assessment.
- **In-place BOM edits with an audit log only** (BOM editable at any time, every change recorded in `AuditEvent`): rejected. An audit log records that a change happened but does not preserve the BOM's state as it was at the time a given Lot was produced. Genealogy breaks: the Lot references a BOM that no longer represents what was actually used. Medical-device design changes require a new revision with full history, not an overwrite with a log entry.
- **BOM frozen only at `OBSOLETE`** (editable through `EFFECTIVE` and `SUPERSEDED`): rejected. Once a Revision is `EFFECTIVE` it is in production use; editing its BOM after that point is exactly the case that breaks genealogy. `OBSOLETE` is too late.

## Consequences

- **Positive (strictest traceability).** Every BOM change is a design change with a full revision history. The Revision id alone is sufficient to recover the exact BOM that produced any Lot. Genealogy queries are deterministic (no date-range joins, no clock-skew edge cases).
- **Positive (clean Change Control hook).** Future Change Control (Phase 7) connects naturally to revision creation: a Change Control record authorizes the new Revision, the new Revision becomes `EFFECTIVE`, and the old Revision becomes `SUPERSEDED` with `supersededById` pointing to the new one. No parallel BOM-version workflow to maintain.
- **Negative / cost (more ceremony for BOM edits).** A typo or a small material swap that would be a one-line edit under the in-place model becomes "create a new Revision, route it through review and approval, supersede the old one". This is intentional ceremony for a regulated device QMS, not a bug. It is accepted.
- **Schema impact.** `BOM.productRevisionId` is `@unique`. `BOM.status` mirrors the Revision status. `BOM.version` is constant per Revision (always 1 under this model; the field exists for forward-compatibility and is not user-meaningful in Phase 2). `ProductRevision.supersededById` is a self-reference for the supersession chain.
- **Risk.** A user expects to "just fix the BOM" and is surprised by the new-Revision workflow. Mitigated by: (a) UI surfacing the immutability state on the BOM page (a visible "Frozen" badge when the Revision is APPROVED / EFFECTIVE / SUPERSEDED / OBSOLETE, with a "Start a new Revision" call-to-action), (b) the rejected-mutation audit trail, (c) onboarding documentation. The workflow is the design, not friction to be removed.
- **Reversibility.** Low. Switching to an independently versioned BOM later would require a data migration to synthesize historical BOM versions from the Revision chain and a re-issuance of every effective Revision. Not planned.

## Compliance note

This ADR records an engineering control that supports traceability and design-control discipline. It is not a claim of ISO 13485 / FDA 21 CFR Part 820 / Part 11 / GxP compliance. Compliance depends on intended use, validated configuration, the eventual Change Control workflow (Phase 7), infrastructure, and evidence (PRD §17).
