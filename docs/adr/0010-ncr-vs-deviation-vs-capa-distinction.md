# ADR-0010: NCR vs Deviation vs CAPA vs Investigation (Strict Separation of Quality Records)

- **Status:** Accepted (Phase 4, owner-confirmed decisions D1 + D2, with D2 modification)
- **Date:** Phase 4
- **Deciders:** Circum project owner
- **Supersedes:** (none)
- **Related:** `docs/PRD/PHASE-4-IMPLEMENTATION-PLAN.md` §3.1 (D1 NCR vs Deviation), §3.2 (D2 Investigation vs CAPA, owner-modified), §3.3 (D3 NCR state machine), §3.4 (D4 Deviation state machine), §3.5 (D5 CAPA state machine), `docs/PRD/CIRCUM_MASTER_PRD_FINAL.md` §5 (NCR/nonconformity, deviations, RCA, CAPA as distinct QMS records), §9 (AI must never close CAPA, never approve deviations/changes), §17 (Validation-minded), `CONTEXT.md` (Phase 4 proposed terms: NCR, Deviation, Investigation, CAPA), ADR-0005 (audit immutability), ADR-0007 (multi-site ownership: quality records are site-owned), ADR-0011 (polymorphic quality-to-production linkage + polymorphic CAPA source)

## Context

Circum Master PRD §5 lists "NCR/nonconformity, deviations, RCA, CAPA" as distinct QMS records in the Quality vocabulary. GLM §9 gives each a different controlled-workflow state machine. The PRD does not, however, pin down the precise semantic boundary between them. Three boundary questions had to be resolved before the Phase 4 schema could be finalized:

1. **Is a Deviation the same as an NCR?** The PRD uses both terms; CONTEXT.md proposes that a Deviation is a *planned* departure while an NCR is an *unplanned* nonconformity. The owner explicitly directed: "NCR ≠ Deviation ≠ CAPA. Do NOT create duplicate/overlapping entities. Do not create a generic QualityIssue entity."
2. **Is an Investigation the same as a CAPA?** GLM §9 lists "Investigation" as a state inside both the Deviation state machine and the CAPA state machine, which can invite the conflation that an investigation is just a step a CAPA performs. CONTEXT.md proposes that an Investigation (RCA) finds the root cause while a CAPA acts on it. The owner explicitly directed: "Investigation ≠ CAPA."
3. **Must every CAPA reference an Investigation?** The Phase 4 Implementation Plan §3.2 originally proposed that "CAPA cannot exist without a preceding Investigation" (a hard foreign key from `CAPA.investigationId` to `Investigation`). The owner confirmed the Investigation ≠ CAPA separation BUT modified this rule: do NOT hard-code a universal rule that every CAPA must have an Investigation. A CAPA MAY reference an Investigation when one exists. The architecture must allow future approved CAPA sources such as NCR, audit, trend, complaint, investigation, or other approved quality source, without requiring a database redesign. Source-specific business rules may be enforced by the service layer.

The Phase 4 Implementation Plan §3.1 (D1) and §3.2 (D2) recorded the proposed resolutions. The owner has confirmed D1 as proposed, and confirmed D2 with the modification above (CAPA source is polymorphic, Investigation is optional, source-specific rules are service-layer concerns). This ADR records both confirmations and the D2 modification.

## Decision

### 1. NCR (Nonconformity Report) is a separate entity, the *unplanned* nonconformity record (reactive)

An NCR records an **unplanned** discovery that something does not conform to requirements: a failed in-process check, a defective Device Lot found at inspection, a Material Lot out of spec, a finished device that fails final test. It is **reactive**: it is raised after the nonconformity is discovered.

- State machine (D3): `DRAFT → CONTAINMENT → INVESTIGATION → DISPOSITION → CLOSED`, plus `CANCELLED` (terminal, withdrawn before containment).
- `DRAFT`: NCR created, not yet acted upon.
- `CONTAINMENT`: immediate containment action taken (quarantine the lot, stop production, isolate the device lot, etc.).
- `INVESTIGATION`: an Investigation (RCA) entity has been created and linked to this NCR; root cause is being determined.
- `DISPOSITION`: a decision on the nonconforming item (USE_AS_IS, REWORK, REGRADE, SCRAP, RETURN_TO_SUPPLIER). May link to a ProductionScrap or ProductionRework.
- `CLOSED`: closure criteria met (containment done, investigation done if one was opened, disposition done, CAPA effectiveness verified if a CAPA was opened).
- `CANCELLED`: withdrawn before containment (terminal).
- The NCR links to the production entity it concerns via the polymorphic reference in ADR-0011 (`concernsEntityType` + `concernsEntityId`, e.g., BATCH, DEVICE_LOT, MATERIAL_LOT, WORK_ORDER, OPERATION_EXECUTION, PRODUCT_REVISION, MATERIAL, SUPPLIER).

### 2. Deviation is a separate entity, the *planned* departure record (proactive, pre-authorized)

A Deviation records a **planned** departure from an approved process, specification, BOM, or routing, requested *before* execution (for example, "we need to use a substitute Material for this one Batch because the specified one is unavailable"). It is **proactive** and **pre-authorized**: it is raised before the work is done, and QA approval authorizes the one-time departure.

- State machine (D4): `DRAFT → ASSESSMENT → INVESTIGATION (optional) → REVIEW → CLOSED`, plus `REJECTED` (terminal, QA rejected at REVIEW) and `CANCELLED`.
- `DRAFT`: deviation requested.
- `ASSESSMENT`: impact assessment (what does this departure affect: quality, safety, regulatory, validation?).
- `INVESTIGATION`: **optional**. A trivial deviation ("use Material Y in place of Material X for this one Batch, both equivalently qualified") may skip investigation. A non-trivial deviation that needs root-cause analysis creates an Investigation entity linked to this Deviation.
- `REVIEW`: QA review of the assessment (and investigation if any) and decision: approve the deviation (proceed with the departure) or reject.
- `CLOSED`: the deviation is closed (either the one-time departure was completed, or it was rejected at REVIEW).
- `REJECTED`: QA rejected the deviation (terminal).
- The ASSESSMENT and REVIEW steps must NOT be silently skipped. Investigation may be skipped for approved trivial deviations; assessment and review must not.
- The Deviation links to the entity the departure applies to via the polymorphic reference in ADR-0011 (`appliesToEntityType` + `appliesToEntityId`, e.g., ROUTING, OPERATION, BOM, BOM_LINE, BATCH, PRODUCT_REVISION).

### 3. Investigation (RCA) is a distinct entity, the structured root-cause analysis

An Investigation is NOT a state inside CAPA and NOT a state inside NCR or Deviation. It is a **separate controlled entity** that records the structured root-cause analysis. An NCR or Deviation transitions to its `INVESTIGATION` state by *creating* an Investigation entity linked to it.

- An Investigation links to exactly one source record (an NCR or a Deviation).
- It records methodology, findings, and the identified root cause.
- An Investigation *may* produce one or more CAPAs (a corrective action, a preventive action, or both). It is not required to.
- State: `IN_PROGRESS → CONCLUDED`.
- Key distinction: the Investigation *finds the cause*; a CAPA *acts on the cause*.
- The Investigation inherits site ownership from its source NCR or Deviation (ADR-0007).

### 4. CAPA (Corrective and Preventive Action) is a separate entity, the action record

A CAPA records actions to correct and prevent recurrence. It is **not** an investigation and **not** a quality event type. It is the action layer that follows analysis (when an analysis was performed).

- State machine (D5, adapted from GLM §9 with the Investigation state removed because Investigation is now a separate entity per D2): `OPEN → ACTION_PLAN → IMPLEMENTATION → EFFECTIVENESS → CLOSED`.
- `OPEN`: CAPA created.
- `ACTION_PLAN`: the corrective and/or preventive action is planned (what will be done, by whom, by when).
- `IMPLEMENTATION`: the action is being implemented.
- `EFFECTIVENESS`: effectiveness verification (did the action work; evidence required).
- `CLOSED`: effectiveness verified, CAPA closed. **Closure requires human effectiveness verification.** AI must never close a CAPA (PRD §9).
- The GLM "Investigation" state that appeared inside the CAPA state machine is removed: D2 makes Investigation a separate entity that *precedes* CAPA creation when an investigation is performed, and the D2 modification (below) makes an Investigation optional for CAPA.

### 5. D2 modification: CAPA does NOT hard-require an Investigation. CAPA source is polymorphic. Investigation is optional.

This is the owner's confirmed modification to D2. The original Phase 4 plan proposed that every CAPA must have a preceding Investigation (a hard `CAPA.investigationId` foreign key). The owner rejected that universality.

- A CAPA references its source via a **polymorphic source** pair: `sourceType` (an enum string, e.g., `NCR`, `AUDIT`, `TREND`, `COMPLAINT`, `INVESTIGATION`, `OTHER`) and `sourceId` (the source record's cuid).
- An optional `investigationId` foreign key exists for the common case where an Investigation precedes the CAPA. This is a convenience FK to support the typical NCR → Investigation → CAPA chain; it is nullable.
- The architecture must allow future approved CAPA sources to be added (audit, trend, complaint, other approved quality source) **without a database redesign**. Adding a new source type is a service-layer change (extend the allowed `sourceType` enum, add a service-layer validation rule), not a schema migration.
- Source-specific business rules are enforced by the service layer, not by the schema. For example, "a CAPA whose source is an NCR should link to that NCR's Investigation if one exists" is a service-layer rule; the schema does not encode it as a hard foreign key.
- This means: a CAPA from an audit, a CAPA from a complaint, a CAPA from a trend review, a CAPA from an investigation, and a CAPA from an NCR are all first-class CAPA records in the same table, distinguished by `sourceType`, not by separate tables or required foreign keys.

### 6. Strict separation maintained across all Quality records

The following separations are mandatory and structural:

- **NCR ≠ Deviation.** They have different state machines, different triggers (reactive vs proactive), and different semantics. They are separate tables.
- **Investigation ≠ CAPA.** Investigation finds the cause; CAPA acts on the cause. They are separate tables. An Investigation may exist without producing a CAPA (root cause found, no action needed); a CAPA may exist without a preceding Investigation (source is an audit, a complaint, a trend).
- **CAPA ≠ Change Control.** A CAPA corrects or prevents recurrence of a specific issue. A Change Control governs a formal change to a product, process, document, or equipment. A CAPA may *trigger* a Change Control (a corrective action may require a controlled change); they remain separate records.
- **Risk Assessment ≠ Investigation.** A RiskAssessment evaluates hazards, severity, probability, and mitigations for a subject. An Investigation finds the root cause of a specific nonconformity or deviation. A RiskAssessment may be referenced by a Deviation (impact step) or a Change Control (risk step); they are separate records.
- **Change Control ≠ CAPA.** See above.
- These records may reference one another (an NCR links to its Investigation, an Investigation links to its CAPAs, a Deviation links to its RiskAssessment, a CAPA links to its source, a Change Control links to its RiskAssessment) but they remain **separate controlled records**, each with its own state machine, audit trail, and closure criteria.
- **No generic QualityIssue or QualityEvent entity.** The owner explicitly forbade a single typed quality-event table. Each quality record type has its own table, its own state machine, and its own permission set.

### Enforcement

- **Schema.** Five separate tables: `NCR`, `Deviation`, `Investigation`, `CAPA`, `ChangeControl` (plus `RiskAssessment`, the subject of a separate decision). Each is site-owned per ADR-0007 (`siteId` non-nullable, reusing the Phase 1 `SiteScope` filter and `assertSiteAccess` guard). Each has its own `code` (unique per site), its own `status` field constrained to its state machine, and its own audit events.
- **CAPA source polymorphism.** `CAPA.sourceType` (string enum) and `CAPA.sourceId` (string, the source record's cuid) are the polymorphic source pair. `CAPA.investigationId` is an optional nullable foreign key to `Investigation` for the common NCR → Investigation → CAPA chain. There is no hard non-nullable FK from CAPA to Investigation. Indexes are specified in ADR-0011.
- **NCR / Deviation production linkage.** Polymorphic per ADR-0011 (`concernsEntityType` + `concernsEntityId` on NCR; `appliesToEntityType` + `appliesToEntityId` on Deviation).
- **State-machine enforcement.** Every transition endpoint validates the current state, the requested new state, the transition's authorization (RBAC), and the transition's preconditions (for example, CAPA → CLOSED requires `effectivenessVerifiedByUserId` to be non-null and to reference a human user, not an AI service principal). Invalid transitions are rejected with `StateTransitionError` and audited as `quality.*.denied` (ADR-0005 pattern).
- **AI governance (PRD §9).** AI service principals are NOT granted `quality.capa.close`, `quality.deviation.approve`, `quality.change.approve`, or `quality.capa.verify.effectiveness` permissions. The service layer additionally enforces a human-actor check on CAPA closure and on Deviation/Change approval: if the acting principal is an AI service principal, the transition is rejected with `AuthorizationError`, regardless of any granted permission. This is defense in depth: even a mis-issued permission grant cannot let an AI close a CAPA.
- **Audited.** Every create, transition, approval, and closure on each of the five entities emits an `AuditEvent` with previousState, newState, actor, timestamp, reason, and session (`quality.ncr.created`, `.transitioned`, `.denied`; same pattern for `quality.deviation.*`, `quality.investigation.*`, `quality.capa.*`, `quality.change.*`). Audit is append-only (ADR-0005).
- **Tested.** Test `T-NCR-01` asserts the NCR state machine and the NCR → Investigation → CAPA chain. Test `T-DEV-01` asserts the Deviation state machine including the optional-skip of Investigation and the non-skip of ASSESSMENT and REVIEW. Test `T-INV-01` asserts that an Investigation is a separate entity that may exist without producing a CAPA and may produce multiple CAPAs. Test `T-CAPA-01` asserts the CAPA state machine and the human-effectiveness-verification closure guard, including rejection of AI closure. Test `T-CAPA-01` is extended to assert that a CAPA can be created from a non-investigation source (e.g., `sourceType = AUDIT`) without an `investigationId`. Test `T-AI-GUARD-01` asserts that an AI service principal cannot close a CAPA, approve a Deviation, or approve a Change. Cross-site isolation is covered by `T-ISOL-04`.

## Rationale

- **Different state machines confirm different entities.** GLM §9 gives NCR (proposed via DOMAIN_GLOSSARY §4.6), Deviation, CAPA, and Change Control different state machines. A single typed QualityEvent table would have to encode all of those state machines as a single union, which collapses the controlled-workflow guarantees each entity needs (different transitions, different closure criteria, different approval gates). The owner's directive to keep them separate is consistent with the PRD and GLM.
- **Reactive vs proactive is a real semantic boundary.** An NCR is raised because something already went wrong; containment, disposition, and (often) root-cause analysis follow. A Deviation is raised because someone wants to do something different from the approved procedure, and QA must authorize that departure before the work proceeds. Conflating them would either force every planned departure through an NCR's containment workflow (which makes no sense for a pre-authorized departure) or force every unplanned nonconformity through a Deviation's authorization workflow (which makes no sense for a defect that has already occurred). They are different work patterns with different actors, different gates, and different closure criteria.
- **Investigation as a separate entity avoids duplication.** If Investigation were a state inside CAPA, then a CAPA would re-implement investigation logic (methodology, findings, root cause, conclusion) that the NCR's investigation step already needs. If Investigation were a state inside NCR but not inside CAPA, then a CAPA could not share an investigation's findings with its source NCR. Making Investigation a distinct entity that links to its source (NCR or Deviation) and that may produce one or more CAPAs lets one root-cause analysis feed multiple actions (corrective + preventive), which is the normal regulatory pattern.
- **The D2 modification is required for real CAPA sources.** In a regulated environment, CAPAs arise from many sources beyond investigations: audit findings, complaint trends, periodic quality reviews, supplier scorecards, management review outputs. If every CAPA hard-required an Investigation, the system would either have to fabricate an Investigation for non-investigation sources (corrupting the Investigation record with "no root cause identified, this CAPA came from an audit") or refuse to record those CAPAs (losing controlled-record coverage). The polymorphic-source design with an optional `investigationId` is the standard regulatory informatics pattern: the CAPA table records *what* the source was, and the service layer enforces *how* each source type is allowed to behave.
- **Source-specific rules belong in the service layer.** "A CAPA from an NCR should link to that NCR's Investigation if one exists" is a rule about the NCR source type. "A CAPA from an audit must reference the audit finding ID" is a rule about the audit source type. These rules evolve over time as the quality system matures, and they are policy, not schema. Encoding them in the schema (as non-nullable FKs that vary by source type) would require a schema migration every time a rule changes or a new source is added. The service layer is the right place.
- **Strict separation matches the regulatory record model.** ISO 13485 and 21 CFR Part 820 treat NCR, Deviation, CAPA, Change Control, and Risk as distinct controlled records, each with its own procedure, its own approval authority, and its own closure criteria. A platform that merges them either has to re-separate them later (expensive, on populated audited tables) or accept weaker controls than the regulated environment expects. The strict-separation model is the lower-risk, lower-rework choice.

## Alternatives considered

- **Single `QualityEvent` entity with a `type` field (NCR, DEVIATION, CAPA, etc.).** Rejected. The PRD and GLM §9 give the different record types different state machines; a single typed table would have to encode all those state machines as a union, which weakens the controlled-workflow guarantees for each type. The owner explicitly forbade a generic QualityIssue entity. The 1-table approach also forces sparse nullable fields (an NCR has `disposition`; a Deviation has `justification`; a CAPA has `effectivenessVerification`; a Change Control has `implementationPlan`) onto every row, which is exactly the sparse-schema anti-pattern the polymorphic-linkage decision (ADR-0011) is meant to avoid at the linkage level.
- **Investigation as a state inside CAPA (the GLM §9 surface reading).** Rejected. The owner explicitly directed "Investigation ≠ CAPA." Beyond the owner constraint, embedding investigation as a CAPA state duplicates investigation logic across NCR and CAPA (both would need an investigation step), prevents one investigation from feeding multiple CAPAs (corrective + preventive), and conflates "find the cause" with "act on the cause," which is the analysis-vs-action boundary the regulatory model depends on.
- **CAPA hard-FK to Investigation (the original D2 proposal).** Rejected per the owner's D2 modification. A non-nullable `CAPA.investigationId` foreign key would require every CAPA to have a preceding Investigation, including CAPAs from audits, complaints, trends, and other sources that do not have an investigation. This would either force fabrication of placeholder investigations (corrupting the Investigation record) or refuse to record those CAPAs (losing controlled-record coverage). The polymorphic-source design with an optional `investigationId` is the standard pattern and is what the owner confirmed.
- **Separate CAPA tables per source (e.g., `InvestigationCAPA`, `AuditCAPA`, `ComplaintCAPA`).** Rejected. This fragments CAPA reporting, CAPA effectiveness trending, and CAPA closure dashboards across multiple tables. It also requires a new table per source type, which is exactly the schema-redesign burden the owner wants to avoid. A single `CAPA` table with a polymorphic source is the cleaner choice.
- **Deviation as a subtype of NCR (a "planned NCR").** Rejected. The reactive/proactive boundary is real and structural, not a label. An NCR's containment and disposition steps do not apply to a pre-authorized departure; a Deviation's authorization step does not apply to a defect that has already occurred. Subtyping would inherit the wrong workflow onto each.
- **Risk Assessment as a state inside Deviation or Change Control.** Rejected. A RiskAssessment is a record (hazard, severity, probability, mitigations, residual risk), not a workflow state. It can be referenced by multiple Deviations and multiple Change Controls over time. Embedding it as a state would prevent reuse and would lose the standalone risk register that periodic quality review needs.

## Consequences

- **Positive (clean separation matches the regulatory record model).** Each quality record type has its own table, its own state machine, its own permission set, and its own audit event namespace. Each is independently reportable, independently auditable, and independently closable. There is no risk that a change to one type's workflow silently affects another.
- **Positive (CAPA is extensible to future sources without a schema migration).** Adding a new CAPA source type (e.g., `MANAGEMENT_REVIEW`) is a service-layer change: extend the allowed `sourceType` enum, add a service-layer validation rule, add the corresponding audit event. No schema migration, no new table, no nullable-FK sprawl.
- **Positive (one Investigation can feed multiple CAPAs).** The corrective + preventive pattern (one root cause, two actions) is structurally supported: one Investigation, N CAPAs each referencing it via `investigationId`. The single-investigation-multiple-actions pattern is the regulatory norm, not the exception.
- **Positive (AI governance is enforced structurally).** CAPA closure, Deviation approval, and Change Control approval each require a human actor. The service layer rejects AI service principals on these transitions even if a permission were mis-issued. This is defense in depth for PRD §9.
- **Negative / cost (five tables where one might seem to suffice).** The strict-separation model has more tables, more permission grants, more audit event namespaces, and more service modules than a single-table model. This is an intentional cost: the regulatory and workflow benefits outweigh the schema cost, and the alternative (merging) is owner-forbidden.
- **Negative / cost (service-layer validation is the authority for source-specific rules).** Because the CAPA source is polymorphic, the database cannot enforce "a CAPA from an NCR should link to that NCR's Investigation." That rule lives in the service layer and is covered by tests. A future PostgreSQL migration (ADR-0002) may add validation triggers to harden this, but the service layer remains the primary authority.
- **Schema impact.** Five new tables (`NCR`, `Deviation`, `Investigation`, `CAPA`, `ChangeControl`) plus `RiskAssessment`. All site-owned. `CAPA.sourceType` and `CAPA.sourceId` are the polymorphic source pair; `CAPA.investigationId` is an optional nullable FK. NCR and Deviation carry polymorphic production references per ADR-0011. State-machine `status` fields are string enums constrained at the schema and validated at the service layer.
- **Risk (a future source type's rules are accidentally not enforced).** When a new `sourceType` is added (e.g., `AUDIT`), the service-layer validation rule for that source must be added in the same change. If it is not, a CAPA could be created from an audit source without the audit-specific rule being checked. Mitigated by: (a) a service-layer registry of allowed source types and their validators, (b) a test that asserts every allowed `sourceType` has a registered validator, (c) the audit trail on every CAPA creation recording the `sourceType` and `sourceId`.
- **Risk (an Investigation is created without a source).** The Investigation entity must link to either an NCR or a Deviation. The service layer rejects an Investigation with neither `sourceNcrId` nor `sourceDeviationId` set, and rejects one with both set. This is a service-layer invariant, covered by `T-INV-01`.
- **Reversibility.** Low. Once the five tables are populated with audited quality records, merging them into a single typed table is a destructive migration on controlled records. The strict-separation model is intended to be permanent.

## Compliance note

This ADR records engineering controls for quality record distinction: it keeps NCR, Deviation, Investigation, CAPA, and Change Control as separate controlled records with separate state machines, enforces human effectiveness verification on CAPA closure and human approval on Deviation and Change Control (PRD §9), and uses a polymorphic CAPA source so future quality sources can be added without a schema redesign. It is not a claim of ISO 13485 / FDA 21 CFR Part 820 / Part 11 / GxP compliance. Compliance depends on intended use, validated configuration, the eventual Document Control subsystem (Phase 7), the full Batch Review workflow (Phase 9), infrastructure, and evidence (PRD §17).
