# ADR-0011: Polymorphic Quality-to-Production Linkage and Polymorphic CAPA Source

- **Status:** Accepted (Phase 4, owner-confirmed decision D8 + D2 modification)
- **Date:** Phase 4
- **Deciders:** Circum project owner
- **Supersedes:** (none)
- **Related:** `docs/PRD/PHASE-4-IMPLEMENTATION-PLAN.md` §3.8 (D8 polymorphic linkage), §3.2 (D2 modification: polymorphic CAPA source), §4 (proposed schema with `concernsEntityType`/`concernsEntityId` on NCR and `appliesToEntityType`/`appliesToEntityId` on Deviation), `docs/PRD/CIRCUM_MASTER_PRD_FINAL.md` §10 (Traceability genealogy includes NCR/Deviation/CAPA referencing production entities), §6 (Batch Review aggregates deviations, NCR, CAPA against a batch), §17 (Validation-minded), `CONTEXT.md` (Phase 4 proposed terms: Polymorphic Quality Linkage), ADR-0002 (SQLite to PostgreSQL migration, future validation triggers), ADR-0005 (audit immutability), ADR-0007 (multi-site ownership model: quality records and production entities are site-owned), ADR-0008 (Batch 1:N DeviceLot, production entities in the genealogy), ADR-0010 (NCR vs Deviation vs CAPA vs Investigation strict separation, including the D2 modification that CAPA source is polymorphic)

## Context

Circum Master PRD §10 places Quality records (NCR, Deviation, CAPA) in the traceability genealogy alongside production entities (WorkOrder, ManufacturingBatch, DeviceLot, OperationExecution, MaterialConsumption, MaterialLot). PRD §6 specifies that Batch Review (Phase 9) aggregates "deviations, NCR, CAPA" against a batch. This means a Quality record must be able to reference any of several production entity types: an NCR may concern a Batch, a DeviceLot, a MaterialLot, a WorkOrder, an OperationExecution, a ProductRevision, a Material, or a Supplier; a Deviation may apply to a Routing, an Operation, a BOM, a BOMLine, a Batch, or a ProductRevision.

The straightforward relational approach is to add a nullable foreign key to each production entity type on the Quality table. For an NCR this would mean up to eight nullable FK columns (`batchId`, `deviceLotId`, `materialLotId`, `workOrderId`, `operationExecutionId`, `productRevisionId`, `materialId`, `supplierId`), of which exactly one is populated per row. This has three costs: the table becomes sparse (many nullable columns, most null on any given row), it becomes hard to extend (adding a new production entity type, for example a future Packaging Lot or Sterilization Load, requires a new nullable FK column and a schema migration on a populated audited table), and it cannot represent the "this NCR concerns two production entities" case (which is rare but real: an NCR may concern both a Batch and a MaterialLot).

The same question arises for the CAPA source, with the D2 modification recorded in ADR-0010. A CAPA may be sourced from an NCR, an Investigation, an audit, a complaint, a trend, or another approved quality source. Hard foreign keys to each source type would create the same sparse-FK and hard-to-extend problems.

The Phase 4 Implementation Plan §3.8 (D8) proposed a polymorphic reference pattern: store the referenced entity as a type string plus an id string, and validate in the service layer that the referenced entity exists and is at the same site. The owner confirmed D8 as proposed, with strict requirements on service-layer validation. The owner's D2 modification (ADR-0010) extends the same polymorphic pattern to the CAPA source.

This ADR records both confirmations: the polymorphic quality-to-production linkage (D8) and the polymorphic CAPA source (D2 modification).

## Decision

### 1. Quality records reference production entities via a polymorphic reference pair

An NCR, Deviation, or other Quality record that needs to reference a production entity stores the reference as two columns:

- `entityType` (string enum, e.g., `BATCH`, `DEVICE_LOT`, `MATERIAL_LOT`, `WORK_ORDER`, `OPERATION_EXECUTION`, `PRODUCT_REVISION`, `MATERIAL`, `SUPPLIER`).
- `entityId` (string, the referenced entity's cuid).

The column names are domain-specific on each table: `concernsEntityType` + `concernsEntityId` on NCR (the entity the nonconformity concerns), `appliesToEntityType` + `appliesToEntityId` on Deviation (the entity the departure applies to).

### 2. CAPA source is also polymorphic (D2 modification)

Per ADR-0010's D2 modification, a CAPA references its source via:

- `sourceType` (string enum: `NCR`, `INVESTIGATION`, `AUDIT`, `TREND`, `COMPLAINT`, `OTHER`).
- `sourceId` (string, the source record's cuid).
- An optional `investigationId` foreign key to `Investigation` for the common case where an Investigation precedes the CAPA (the typical NCR → Investigation → CAPA chain). This FK is nullable and is a convenience for the common case; it is not the only way to link a CAPA to an Investigation.

Adding a new CAPA source type (e.g., `MANAGEMENT_REVIEW`) is a service-layer change, not a schema migration. The schema remains stable as new approved quality sources are added over time.

### 3. Strict service-layer validation (owner requirement)

The owner confirmed D8 with strict requirements on service-layer validation. The database cannot portably enforce a foreign key to a polymorphic target (the target table depends on the `entityType` or `sourceType` value), so the service layer is the validation authority. Every quality linkage (NCR concerns entity, Deviation applies to entity, CAPA source) must validate, at create and at any update that changes the linkage:

1. **Allowed type.** The `entityType` (or `sourceType`) is in the allowed enum for that table. An unknown type is rejected with `ValidationError`.
2. **Referenced entity exists.** The service layer looks up the referenced entity in the target table. A non-existent or soft-deleted entity is rejected with `NotFoundError`.
3. **Site ownership matches.** The referenced entity's `siteId` must equal the Quality record's `siteId`. A cross-site reference (Quality record at Site A pointing to a production entity at Site B, or a CAPA at Site A sourced from an NCR at Site B) is rejected with `ForbiddenError`. This is the multi-site isolation invariant from ADR-0007, applied to polymorphic references.
4. **User authorization.** The acting user must have read access to the referenced entity (otherwise a user could link a Quality record to a production entity they are not authorized to see, leaking its existence through the linkage). Rejected with `ForbiddenError`.
5. **Record accessibility.** The referenced entity must be in a state that allows linkage (for example, linking an NCR to a Batch that has been soft-deleted is rejected; linking a CAPA to an Investigation that is not yet `CONCLUDED` may be allowed but flagged, depending on source-specific rules).
6. **Auditability.** The linkage create and any linkage update emit an `AuditEvent` recording the `entityType`/`entityId` (or `sourceType`/`sourceId`) pair, the actor, the timestamp, and the reason. Invalid linkage attempts (rejected in steps 1 through 5) are audited as `quality.*.denied` with the rejection reason.

### 4. Invalid references are rejected and audited

- Invalid polymorphic references (unknown type, non-existent entity, soft-deleted entity) are rejected with `NotFoundError` (when the entity cannot be found) or `ValidationError` (when the type is not allowed). Both are audited as `quality.*.denied` (ADR-0005 pattern).
- Cross-site polymorphic references are rejected with `ForbiddenError` and audited as `quality.*.denied`. This is the explicit cross-site leakage prevention for polymorphic linkage.

### 5. Indexes

- `@@index([concernsEntityType, concernsEntityId])` on `NCR`, for the query "find all NCRs concerning this Batch/DeviceLot/MaterialLot."
- `@@index([appliesToEntityType, appliesToEntityId])` on `Deviation`, for the query "find all Deviations applying to this Routing/Operation/BOM/Batch."
- `@@index([sourceType])` on `CAPA`, for the query "find all CAPAs sourced from NCRs / audits / complaints / trends."
- `@@index([investigationId])` on `CAPA` is provided by Prisma automatically via the relation, for the query "find all CAPAs produced by this Investigation."

These indexes support the Phase 9 Batch Review queries (PRD §6: "find all deviations, NCR, CAPA against a batch") without a full table scan.

### 6. Tested

The polymorphic linkage is covered by two tests in the Phase 4 critical-test suite:

- `T-LINK-01` (invalid polymorphic references): asserts that an NCR cannot be created with an unknown `concernsEntityType`, with a non-existent `concernsEntityId`, or with a soft-deleted production entity. Each case is rejected and audited.
- `T-ISOL-04` (cross-site polymorphic references): asserts that an NCR at Site A cannot link to a production entity at Site B, and that a CAPA at Site A cannot source from an NCR at Site B. Both are rejected with `ForbiddenError` and audited. This test extends the cross-site isolation pattern established by `T-ISOL-03` (Phase 3 cross-site production isolation) to the Quality-to-Production linkage.
- The CAPA polymorphic source is additionally covered by `T-CAPA-01` (extended), which asserts that a CAPA can be created from a non-investigation source (e.g., `sourceType = AUDIT`) without an `investigationId`, and that a CAPA created from `sourceType = INVESTIGATION` populates `investigationId` as a convenience FK.

## Rationale

- **Polymorphic linkage is extensible.** Adding a new production entity type (e.g., a future Packaging Lot in Phase 11, or a Sterilization Load) does not require a schema migration on the NCR or Deviation table. The new entity type is added to the allowed `entityType` enum in the service layer, and existing Quality records continue to work unchanged. The same is true for adding a new CAPA source type.
- **Polymorphic linkage avoids sparse FKs.** The alternative (a nullable FK column per production entity type) produces a table where most columns are null on any given row, which is harder to query, harder to validate, and harder to reason about. The polymorphic pair (`entityType` + `entityId`) is one dense column pair that represents the same information.
- **The database cannot portably enforce polymorphic FKs.** A foreign key in SQLite, PostgreSQL, or any standard RDBMS targets a single table. A polymorphic reference targets one of several tables depending on the type value, which cannot be expressed as a standard FK constraint. The service layer is the only portable validation authority. A future PostgreSQL migration (ADR-0002) may add validation triggers (e.g., a trigger that looks up the referenced entity in the right table based on the type value), but the service layer remains the primary authority.
- **Service-layer validation is the right place for cross-cutting invariants.** Site ownership matching, user authorization, and record accessibility are cross-cutting concerns that depend on the acting user and the current state of the referenced entity. These cannot be expressed as static schema constraints. The service layer already enforces them for non-polymorphic references (per ADR-0007's `SiteScope` and `assertSiteAccess`), so extending them to polymorphic references is consistent.
- **The CAPA polymorphic source is required by the D2 modification.** The owner's D2 modification (ADR-0010) explicitly requires that the architecture allow future approved CAPA sources (NCR, audit, trend, complaint, investigation, other) without a database redesign. The polymorphic source pair (`sourceType` + `sourceId`) is the standard pattern for this. The optional `investigationId` FK is a convenience for the common NCR → Investigation → CAPA chain, not a structural requirement.
- **Indexing supports Phase 9 Batch Review.** PRD §6 requires Batch Review to aggregate "deviations, NCR, CAPA" against a batch. The composite index on `(entityType, entityId)` makes the "all NCRs concerning this Batch" query efficient. Without it, Batch Review would scan the entire NCR table per batch.

## Alternatives considered

- **Hard foreign keys to every production entity (many nullable columns).** Rejected. For an NCR, this would mean up to eight nullable FK columns (`batchId`, `deviceLotId`, `materialLotId`, `workOrderId`, `operationExecutionId`, `productRevisionId`, `materialId`, `supplierId`), of which exactly one is populated per row. This is sparse, hard to extend (a new production entity type requires a schema migration), and cannot represent the rare multi-entity case (an NCR concerning both a Batch and a MaterialLot). The polymorphic pair is denser, more extensible, and can represent multi-entity cases by storing multiple linkage rows if needed (though Phase 4 does not require multi-entity linkage on a single NCR).
- **A join table (e.g., `QualityRecordProductionLink` with `qualityRecordId`, `entityType`, `entityId`).** Rejected for Phase 4 as over-engineered. A join table is the right pattern when a Quality record needs to link to *multiple* production entities (M:N), which is rare in Phase 4. The single polymorphic pair on the Quality record itself covers the common 1:1 case (one NCR concerns one production entity). If multi-entity linkage becomes a real requirement later, a join table can be added as an additive migration without restructuring the Quality tables.
- **No validation (store `entityType` and `entityId` as opaque strings).** Rejected. Without service-layer validation, a Quality record could link to a non-existent entity, a soft-deleted entity, an entity at a different site, or an entity the acting user is not authorized to see. This breaks traceability (PRD §10), breaks multi-site isolation (ADR-0007), and breaks auditability. The owner explicitly required strict service-layer validation as part of confirming D8.
- **Database-level polymorphic FK via CHECK constraints and per-type FK columns.** Rejected. This is the sparse-FK alternative in disguise: it still requires one FK column per type, with a CHECK constraint that exactly one is non-null. It has the same extensibility cost (a new type means a new column and a new CHECK constraint) and the same sparsity. The polymorphic pair is strictly better.
- **A `sourceRecordId` column on CAPA that is a string FK to a generic `QualityRecord` table.** Rejected. This presupposes a generic QualityRecord table, which the owner explicitly forbade (no generic QualityIssue entity, ADR-0010). The polymorphic source pair on the CAPA table itself, with the service layer validating against the actual source table, is the right pattern.
- **PostgreSQL validation triggers now.** Rejected for Phase 4 (deferred). The current environment is SQLite (ADR-0002), which does not support the kind of conditional trigger needed. A future PostgreSQL migration may add validation triggers as defense in depth, but the service layer remains the primary authority.

## Consequences

- **Positive (extensible linkage).** New production entity types (Packaging Lot, Sterilization Load, future logistics entities) and new CAPA source types (audit, complaint, trend, management review) can be added without a schema migration. The service layer's allowed-type enum is extended, and existing Quality records continue to work unchanged.
- **Positive (avoids sparse FKs).** The NCR, Deviation, and CAPA tables have one dense column pair for their polymorphic reference, not a sprawl of nullable FK columns. The schema is cleaner and easier to reason about.
- **Positive (Phase 9 Batch Review queries are efficient).** The composite index on `(entityType, entityId)` makes the "all NCRs/Deviations/CAPAs against this batch" query efficient, which is the core query PRD §6 requires Batch Review to run.
- **Positive (CAPA extensibility matches the D2 modification).** The polymorphic CAPA source is exactly what the owner's D2 modification requires: future approved CAPA sources can be added without a database redesign, and source-specific rules live in the service layer.
- **Negative / cost (service-layer validation is critical and tested).** Because the database cannot enforce polymorphic FKs portably, the service layer is the sole validation authority. A bug in the service-layer validation could allow an invalid or cross-site linkage. Mitigated by: (a) the strict validation checklist (six checks, all enforced on every create and update), (b) the test coverage (`T-LINK-01` for invalid references, `T-ISOL-04` for cross-site references), (c) the audit trail on every linkage attempt including rejected ones, (d) a future PostgreSQL migration (ADR-0002) that may add validation triggers as defense in depth.
- **Negative / cost (cross-site leakage prevention depends on the service layer).** Without database-level row security (which SQLite does not support and PostgreSQL will, per ADR-0002), cross-site polymorphic linkage is prevented by the service layer's site-ownership check. This is the same defense-in-depth posture as the rest of the multi-site model (ADR-0007): service-layer enforcement now, with database-level hardening planned for the PostgreSQL migration.
- **Schema impact.** `NCR.concernsEntityType` + `NCR.concernsEntityId` (with `@@index([concernsEntityType, concernsEntityId])`). `Deviation.appliesToEntityType` + `Deviation.appliesToEntityId` (with `@@index([appliesToEntityType, appliesToEntityId])`). `CAPA.sourceType` + `CAPA.sourceId` (with `@@index([sourceType])`), plus an optional nullable `CAPA.investigationId` FK to `Investigation` for the common NCR → Investigation → CAPA chain. All Quality records remain site-owned per ADR-0007.
- **Risk (a service-layer bug allows an invalid linkage).** Mitigated by the six-check validation checklist, the test coverage, and the audit trail. A future PostgreSQL migration may add validation triggers as defense in depth.
- **Risk (a new entity type is added to the enum without a service-layer validator).** When a new `entityType` or `sourceType` is added, the corresponding service-layer validator must be added in the same change. Mitigated by: (a) a service-layer registry of allowed types and their validators, (b) a test that asserts every allowed type has a registered validator, (c) the audit trail recording the type on every linkage.
- **Reversibility.** Medium. Switching from polymorphic linkage to hard FKs later would require a schema migration to add the FK columns and backfill them from the polymorphic pair, which is structurally possible but would lose the extensibility property. Not planned.

## Compliance note

This ADR records an architectural decision for traceability linkage: Quality records (NCR, Deviation, CAPA) reference production entities and CAPA sources via polymorphic reference pairs, validated strictly in the service layer (allowed type, existence, site ownership match, user authorization, record accessibility, auditability). It is not a claim of ISO 13485 / FDA 21 CFR Part 820 / Part 11 / GxP compliance. The polymorphic pattern supports the traceability genealogy required by PRD §10 and the Batch Review aggregation required by PRD §6, but compliance depends on intended use, validated configuration, the eventual PostgreSQL migration with validation triggers (ADR-0002), the full Batch Review workflow (Phase 9), infrastructure, and evidence (PRD §17).
