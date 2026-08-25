# CIRCUM — PHASE 2 VALIDATION REPORT

> **Phase:** 2 — Product / Product Revision / BOM / BOMLine / Material / MaterialSupplier / Material Lot / Supplier
> **Status:** CONDITIONAL PASS
> **Date:** Phase 2 completion
> **Method:** `to-spec → to-tickets → domain-modeling → codebase-design → tdd/implement → code-review (self) → regression → validation` per PRD §19/§23.
> **Predecessor:** Phase 1 (approved/closed). Domain decisions D1-D8 owner-confirmed.

---

## 1. Requirements implemented

All Phase 2 requirements from the approved plan (§2, R1-R14) + owner constraints:

- R1 Product/Device master (catalog) ✅ — Product entity; Device = conceptual (D1), no separate table
- R2 Product Revision (controlled version) ✅ — ProductRevision + state machine (D2)
- R3 BOM/Materials/MaterialLots/Suppliers ✅ — BOM, BOMLine, Material, MaterialSupplier, MaterialLot, Supplier
- R4 Traceability genealogy prefix (Product→Revision→BOM→MaterialLot) ✅ — relationships wired
- R5 Configurable + DEMO labelled ✅ — all demo rows `isDemo: true`
- R6 Controlled-record fields (unique ID, status, audit) ✅
- R7 DB constraints (FKs, uniques, quantity>0, state machines) ✅
- R8 Audit immutable (Phase 1 triggers) ✅ — regression-tested
- R9 Layered architecture ✅ — modules/manufacturing/{domain,service}
- R10 Local-first ✅
- R11 FR/EN/AR + RTL ✅ — catalogs extended with manufacturing.*
- R12 Industrial UI ✅ — 4 manufacturing pages
- R13 Phase Gate ✅ — executed
- R14 PG-portable ✅ — Decimal, no SQLite-only types

Owner constraints: D1-D8 all implemented exactly as confirmed ✅. No invented entities ✅. No Phase 3 functionality ✅. Least-privilege RBAC ✅. MaterialLot site-scoped + cross-site leakage critical ✅. BOM frozen when Effective ✅. MaterialLot lifecycle explicit/validated/audited ✅. DISQUALIFIED supplier enforced ✅.

## 2. Domain decisions implemented

- **D1 Product vs Device:** Device = conceptual (not a table). `Product.deviceClass` field (I/IIa/IIb/III). ✅
- **D2 BOM revision/effectivity:** BOM 1:1 with ProductRevision (`productRevisionId @unique`). Frozen when revision APPROVED/EFFECTIVE/SUPERSEDED/OBSOLETE. `assertBomEditable()` guard in service throws `StateTransitionError`. Edits allowed only in DRAFT/IN_REVIEW. Tested T-BOM-01. ✅
- **D3 MaterialLot lifecycle:** RECEIVED→QUARANTINE→APPROVED→IN_USE→EXHAUSTED, +QUARANTINE→REJECTED (terminal), +APPROVED→QUARANTINE (return on issue). `assertLotTransition()` enforces. quantityReceived/quantityAvailable tracked; `assertQuantityInvariant()` enforces available ≤ received, >0. Tested T-LOT-01, T-QUANT-01. ✅
- **D4 Multi-site ownership:** Product/Revision/BOM/BOMLine/Material/MaterialSupplier/Supplier GLOBAL (no siteId). MaterialLot SITE-OWNED (`siteId` required, `SiteScope` filter + `assertSiteAccess`). Cross-site leakage = critical defect. Tested T-ISOL-02 (browser + unit). ✅
- **D5 Supplier-Material:** Material M:N Supplier via MaterialSupplier (isPreferred, supplierPartCode). MaterialLot 1:1 Supplier. `assertSupplierQualified()` rejects DISQUALIFIED on MaterialLot create. Tested T-SUP-01. ✅
- **D6 deviceClass:** controlled enum (I/IIa/IIb/III). ✅
- **D7 CoA:** string ref field only; full doc control deferred. ✅
- **D8 Customer/Project:** out of scope. ✅

## 3. Files changed

**New:** `src/modules/manufacturing/{domain,service}/index.ts`, `src/app/api/manufacturing/**` (14 route files), `src/app/[locale]/(app)/manufacturing/{products,materials,material-lots,suppliers}/page.tsx`, `docs/adr/0006-bom-revision-effectivity.md`, `docs/adr/0007-multi-site-ownership-model.md`, `docs/validation/phase2-cross-site-isolation.png`, `.scratch/phase-2/{spec.md,tickets.md}`, `tests/integration/phase2-critical-tests.test.ts`, `prisma/migrations/20260825005350_phase2_manufacturing/migration.sql`.

**Modified:** `prisma/schema.prisma` (8 new models + Site relation), `prisma/seed.ts` (Phase 2 demo data + manufacturing perms), `src/lib/permissions.ts` (20 manufacturing.* permissions + grants), `src/components/app/app-sidebar.tsx` (Manufacturing nav group), `src/messages/{en,fr,ar}.json` (manufacturing.* keys), `CONTEXT.md` (Phase 2 terms confirmed).

## 4. Schema changes

8 new models (additive migration `20260825005350_phase2_manufacturing`): Product, ProductRevision (with supersession self-ref), BOM (1:1 with revision), BOMLine (with substitute self-ref), Material, MaterialSupplier (M:N join), MaterialLot (site-owned), Supplier. All PG-portable (Decimal for quantities). No changes to Phase 1 tables except adding `materialLots MaterialLot[]` relation to Site.

## 5. API changes

14 new route handlers under `/api/manufacturing/`: products (list/get/create/update), products/[id]/revisions (list/create), revisions/[id] (get/transition), revisions/[id]/bom (get), revisions/[id]/bom/lines (add), bom-lines/[id] (update/delete), materials (list/get/create/update + link supplier), material-lots (list/get/create/update/transition), suppliers (list/get/create/update). All zod-validated, envelope-wrapped, RBAC-guarded. Explicit `/transition` endpoints for state machines (D2/D3), audited.

## 6. UI changes

4 new pages under `[locale]/(app)/manufacturing/`: products (table with type/deviceClass/revisions), materials (table with type/unit/lots), material-lots (table with site-scoped notice, status badges, available/received quantity), suppliers (table with qualification badges). Sidebar "Manufacturing" nav group (4 items, permission-gated). i18n FR/EN/AR + RTL.

## 7. Tests/results

**Vitest: 51 tests, all PASS** (4.8s).
- Phase 1 regression (17): audit immutability, RBAC denial, cross-site, lockout, pepper, session, RTL — all still pass.
- Phase 2 (34): T-REV-01 (revision state machine, 5 tests), T-BOM-01 (BOM immutability, 6), T-LOT-01 (lot state machine, 9), T-QUANT-01 (quantity invariants, 6), T-ISOL-02 (cross-site MaterialLot isolation, 2), T-SUP-01 (DISQUALIFIED enforcement, 3), regression (audit immutability on test DB, 3).

**Browser verification (agent-browser):**
- Sign-in (admin) → Products page: 3 demo products (Catheter IIa, Surgical Kit IIb, Handle Component) ✅
- Material Lots page (admin/global): all 8 lots across CH/FR/TN, site-scoped notice shown ✅
- Suppliers page: 3 suppliers with APPROVED/CONDITIONAL/DISQUALIFIED badges ✅
- **Cross-site isolation (T-ISOL-02 browser):** signed in as Quality Manager (CH-scoped) → Material Lots page shows ONLY 3 CH lots (LOT-CH-001/002/003); TN/FR lots NOT visible ✅
- Screenshot saved: `docs/validation/phase2-cross-site-isolation.png`

## 8. Defects found/fixed

- `isBomEditable` used in test but not imported → added to import list.
- No other defects. Domain state machines + invariants + isolation all verified on first browser pass.

## 9. Security review

- RBAC: 20 new `manufacturing.*` permissions, least-privilege grants (super_admin full; operator read-only; QA transitions; warehouse creates lots; auditor read-only). 3-layer enforced (UI/middleware/service). ✅
- BOM immutability (D2): service guard rejects edits when revision not DRAFT/IN_REVIEW; audited. ✅
- MaterialLot isolation (D4): SiteScope + assertSiteAccess on every read/create/update/transition; cross-site leakage = ForbiddenError. ✅
- DISQUALIFIED supplier (D5): rejected on MaterialLot create. ✅
- All transitions explicit + audited with previousState/newState + reason. ✅
- Denied attempts audited (Phase 1 infrastructure). ✅

## 10. Data-integrity review

- FKs + cascades: Restrict for controlled records (Product→Revision, Material→Lot, Supplier→Lot, Site→Lot); Cascade for children (BOMLine under BOM). ✅
- Uniques: Product.code, ProductRevision(productId, revisionCode), BOM.productRevisionId (1:1), BOMLine(bomId, materialId), MaterialLot(siteId, lotCode), MaterialSupplier(materialId, supplierId), Supplier.code, Material.code. ✅
- State machines: ProductRevision (6 states, enforced), MaterialLot (6 states, enforced). ✅
- Quantity invariants: available ≤ received, >0 (service-enforced; PG migration will add CHECK constraints). ✅
- Supersession: only one EFFECTIVE revision per product (enforced in transitionRevision transaction). ✅

## 11. Audit review

- Every create/update/transition emits AuditEvent (manufacturing.product.create/update, manufacturing.revision.create/transition, manufacturing.bom.line.add/update/delete, manufacturing.material.create/update, manufacturing.materiallot.create/update/transition, manufacturing.supplier.create/update, manufacturing.materialsupplier.link). ✅
- previousState/newState captured. ✅
- reason required for transitions. ✅
- Audit append-only (Phase 1 triggers; regression-tested in Phase 2 suite). ✅

## 12. Known limitations

1. **Audit site-scoping for MaterialLot non-global users** is best-effort (filters by actor scope at the query level; full entity-site RLS when PG lands, owner carry-forward #4).
2. **Quantity CHECK constraints** not in SQLite (service-enforced); PG migration will add `CHECK (quantity_available <= quantity_received)`.
3. **BOM immutability** is service-enforced (not DB-trigger-enforced like audit). ADB trigger is possible but the service guard produces cleaner StateTransitionError; acceptable for Phase 2 (Phase 13 may add a DB guard).
4. **Playwright E2E** for manufacturing flows added to backlog (owner carry-forward #2); manual browser verification done.
5. **No MaterialLot inter-site transfer** (Phase 13 logistics).
6. **No Customer/Project linkage** (D8, out of scope).

## 13. Technical debt

- 44 ESLint warnings (mostly pre-existing shadcn `any` + 1 unused var in test).
- BOM editor UI is read-only list (no inline add/edit dialog); API supports it, UI deferred.
- Revision transition UI (buttons) not yet added; API supports it.
- `middleware.ts` → `proxy.ts` rename (Next 16 deprecation, carried from Phase 1).

## 14. Production blockers

- **PostgreSQL migration (ADR-0002)** required before production: SQLite is temporary; schema is PG-portable; migration script + RLS policies needed. Owner carry-forward #1.
- No other production blockers for Phase 2 scope.

## 15. Final acceptance status

**CONDITIONAL PASS.**

Phase 2 is functionally complete, secure, tested (51/51 tests green incl. all 5 critical Phase 2 tests), and browser-verified (including cross-site isolation with a scoped user). Conditions are the known limitations above (none block Phase 3; all are Phase 13 hardening except the PostgreSQL migration which is required before production).

```
PHASE 2 STATUS: READY FOR OWNER REVIEW
```

**STOP.** Not starting Phase 3. Awaiting owner explicit approval.
