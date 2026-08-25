# ADR-0007: Multi-Site Ownership Model for Phase 2 (Global Catalog, Site-Owned MaterialLot)

- **Status:** Accepted (Phase 2, owner-confirmed decision D4)
- **Date:** Phase 2
- **Deciders:** Circum project owner
- **Supersedes:** (none)
- **Related:** ADR-0002 (SQLite to PostgreSQL migration, RLS hardening), ADR-0004 (RBAC assignment scoping), `docs/PRD/PHASE-2-IMPLEMENTATION-PLAN.md` §3.4 and §8, `CONTEXT.md` (Phase 2 proposed terms, Site ownership)

## Context

Circum is a vertically integrated multi-site CDMO with sites in CH, FR, and TN (PRD §2). Phase 1 established site-scoped RBAC (ADR-0004): every Assignment binds a User to a Role within a Scope (`siteId?`, `departmentId?`, `moduleScope?`), and the repository layer applies a `SiteScope` filter plus `assertSiteAccess` guard so that a user scoped to Site A cannot read or write Site B's data. Cross-site data leakage is a critical defect under the owner's constraints.

Phase 2 introduces manufacturing master data: Product, ProductRevision, BOM, BOMLine, Material, MaterialSupplier, MaterialLot, Supplier. The Phase 2 domain-modeling pass surfaced an ambiguity the PRD does not resolve explicitly: **which of these entities are global (a shared catalog) and which are site-owned (physical, isolated per site)?**

The wrong split has real costs. Making Products site-owned fragments the catalog (the same device design exists three times, once per site, and "make this product at site TN" becomes a copy operation). Making MaterialLots global breaks physical isolation (a lot cannot physically be in two warehouses at once; goods-in, quarantine, and storage are physical per-site states).

The Phase 2 Implementation Plan (§3.4) recorded this as decision D4 (proposed). The owner has confirmed D4 as proposed, with the additional explicit constraint that cross-site MaterialLot leakage is a **CRITICAL** defect. This ADR records that confirmation.

## Decision

### Global entities (shared catalog, no `siteId`)

The following entities are **global**. They have no `siteId` field. They represent design, catalog, and procurement data that is identical whether the device is manufactured in CH, FR, or TN.

- **Product** (the manufactured item type / device design)
- **ProductRevision** (a controlled version of a Product's design)
- **BOM** (the material list for one ProductRevision, 1:1 per ADR-0006)
- **BOMLine** (one line of a BOM)
- **Material** (a physical input substance/component definition)
- **MaterialSupplier** (the Material-to-Supplier sourcing relationship)
- **Supplier** (an external source of Materials)

Global entities are readable by any authenticated user holding the relevant `manufacturing.*.read` permission (per the Phase 1 RBAC model, ADR-0004). No `SiteScope` filter is applied on reads of global entities. Writes (create / update / transition) on global entities are governed by the relevant `manufacturing.*.write` / `manufacturing.*.transition` permission, again with no site constraint.

### Site-owned entity (physical inventory, `siteId` required)

- **MaterialLot** is **site-owned**. `MaterialLot.siteId` is required (non-nullable). A material lot physically exists at one site: goods-in, quarantine, storage, and consumption are physical per-site events.

Enforcement for MaterialLot reuses the Phase 1 multi-site isolation infrastructure exactly:

- All MaterialLot repository queries accept a `SiteScope` and apply it as a filter (a user scoped to Site A sees only Site A's lots; a super-admin with a global scope sees all lots).
- MaterialLot create / transition service methods call `assertSiteAccess(authContext, siteId)` before mutating. A user without access to the target `siteId` is rejected with `AuthorizationError` (Phase 1 pattern).
- The authorization failure is audited as `manufacturing.materiallot.denied` with `outcome = DENIED`, per ADR-0005.

### Transfer between sites is out of scope for Phase 2

Transferring a MaterialLot from one site to another is a **future Phase 13 logistics feature** (inter-site transfer, shipping, receipt-at-destination, re-quarantine). Phase 2 does not model transfer. A MaterialLot's `siteId` is fixed at creation; there is no transfer endpoint in Phase 2.

### Cross-site MaterialLot leakage is a CRITICAL defect

This is an owner-stated constraint, not a preference. Any code path, query, or job that returns a MaterialLot from a site the caller is not authorized for is a critical defect that blocks Phase 2 acceptance. Test **T-ISOL-02** asserts that a user scoped to Site A receives zero MaterialLots from Site B on every MaterialLot list / get / count path. The test is part of the Phase 2 critical-test suite.

## Rationale

- **Matches the CDMO model.** The same Product is made at multiple sites; the same Supplier supplies multiple sites; the same Material definition is consumed at multiple sites. Modeling these as global avoids the cost and confusion of per-site duplication.
- **Keeps the sensitive scoped entity isolated.** The only Phase 2 entity whose isolation has safety, quality, and regulatory consequences is MaterialLot (physical inventory: a quarantined lot at Site A must not be consumable at Site B). Concentrating the isolation boundary on one entity keeps the enforcement surface small and auditable.
- **Reuses Phase 1 infrastructure.** `SiteScope`, `assertSiteAccess`, and the repository-layer filter pattern (ADR-0004) are applied unchanged to MaterialLot. No new isolation mechanism is introduced in Phase 2.

## PostgreSQL hardening (when PG lands, ADR-0002)

When PostgreSQL becomes available (per ADR-0002), add **Row-Level Security (RLS)** policies on the `MaterialLot` table keyed on `current_setting('app.site_scope')`, set per request from `AuthContext` (owner carry-forward item #4 from the Phase 1 closure). RLS becomes the DB-level backstop: even a query that bypasses the repository filter (a raw SQL query, a mis-joined include, a future reporting tool) cannot leak a MaterialLot row from a site the caller is not authorized for.

The repository-layer `SiteScope` filter remains in place as **defense-in-depth**. RLS is not a replacement for the application-layer filter; the two layers protect against different failure modes (application filter protects against logic bugs in the repository; RLS protects against direct DB access and any path that bypasses the repository).

Global entities (Product, ProductRevision, BOM, BOMLine, Material, MaterialSupplier, Supplier) do **not** get an RLS policy keyed on `app.site_scope` because they are intentionally readable across sites. They may still be subject to a separate RLS policy enforcing the RBAC permission catalog (a read permission check at the DB level), which is a future hardening item, not a Phase 2 requirement.

## Alternatives considered

- **Product site-owned** (`Product.siteId` required, each site defines its own products): rejected. Fragments the catalog: the same device design exists N times (once per site), "make this product at site TN" becomes a copy operation, and cross-site reporting (e.g., total units of Product X produced across the CDMO) requires deduplication by some natural key. Complicates the common case ("same product, multiple sites") to handle the rare case ("product only ever made at one site"). The rare case is supported by simply not creating cross-site MaterialLots; it does not require Product to be site-owned.
- **MaterialLot global** (`MaterialLot.siteId` optional or absent, a lot can exist at multiple sites): rejected. A material lot is a physical object. It cannot be in two warehouses at once. Goods-in, quarantine, and storage are physical per-site states. Making MaterialLot global breaks the Phase 1 isolation model (there is nothing to scope) and removes the safety property that a quarantined lot at Site A cannot be consumed at Site B.
- **Material site-owned** (`Material.siteId` required): rejected. Material is a definition (a substance/component with a code, name, default unit), not a physical instance. The same Material definition is consumed at multiple sites. Site-owning Material would fragment the catalog and break BOM portability (a BOM references Materials; if Materials are site-owned, the same BOM cannot be used at multiple sites without per-site Material copies). MaterialLots already carry the site binding.
- **Supplier site-owned**: rejected. A Supplier is an external entity that supplies the CDMO, not a single site. Site-owning Supplier would prevent a single supplier-qualification record from applying across the CDMO and would duplicate supplier quality data (Phase 7).

## Consequences

- **Positive (clean separation of concerns).** Design and catalog data is global and shared; physical inventory data is site-owned and isolated. The boundary is unambiguous and maps to a single entity (MaterialLot).
- **Positive (small enforcement surface).** Only MaterialLot carries the site-isolation burden in Phase 2. The Phase 1 `SiteScope` / `assertSiteAccess` infrastructure is reused without modification.
- **Positive (forward-compatible with Phase 13 transfer).** When inter-site transfer is implemented in Phase 13, the model extends naturally: a transfer creates a new MaterialLot at the destination site (with a reference to the source lot), and the source lot transitions to a transferred / exhausted state. The site-owned model is preserved; no global-lot concept is needed.
- **Negative / cost (global entities are not site-filtered on read).** A user scoped to Site A can read the global catalog (Products, Revisions, BOMs, Materials, Suppliers) even if those items are never used at Site A. This is intentional (the catalog is shared) and matches the RBAC model: read access is governed by the `manufacturing.*.read` permission, not by site. If a future requirement asks to restrict catalog visibility per site (e.g., a tenant-style CDMO where Site A should not see Site B's product designs), that would be a separate scoping mechanism layered on top, not a change to this model.
- **Schema impact.** `MaterialLot.siteId` is non-nullable, with a foreign key to `Site`. No other Phase 2 entity has a `siteId` field. `MaterialLot` queries join through `siteId`; all other Phase 2 queries omit the site dimension.
- **Risk (cross-site leakage).** The critical risk is a code path that returns MaterialLots without applying the `SiteScope` filter. Mitigated by: (a) the repository-layer filter applied on every MaterialLot read path, (b) test T-ISOL-02 covering every read path, (c) future RLS as the DB-level backstop when PG lands (ADR-0002), (d) code-review attention to any new MaterialLot query.
- **Reversibility.** Low for MaterialLot (making it global later would require a data migration to assign each lot to a site, which is already done, and would break the isolation guarantee). Medium for the global entities (a future per-site catalog split would require a data migration and a `siteId` column addition, but is structurally possible). Not planned.

## Compliance note

This ADR records an engineering control that supports multi-site data isolation. It is not a claim of ISO 13485 / FDA 21 CFR Part 11 / GxP compliance. Multi-site data isolation is enforced at the application layer in Phase 2 (repository `SiteScope` filter and `assertSiteAccess` guard, ADR-0004) and will be hardened at the DB layer when PostgreSQL is available (RLS policies, ADR-0002). Compliance depends on intended use, validated configuration, infrastructure, and evidence (PRD §17).
