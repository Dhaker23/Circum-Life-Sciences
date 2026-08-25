# Phase 2 — Tickets (tracer-bullet decomposition)

## T01 — ADRs 0006-0007 + spec/tickets
- Done (slice 0-1).

## T02 — Prisma schema + migration (phase2_manufacturing)
- 8 new models: Product, ProductRevision, BOM, BOMLine, Material, MaterialSupplier, MaterialLot, Supplier. PG-portable (Decimal). FKs/uniques per plan. Additive.
- Blocked by: T01. Status: ready-for-agent.

## T03 — permissions.ts: manufacturing.* catalog + least-privilege grants + RBAC matrix update
- Blocked by: T02. Status: ready-for-agent.

## T04 — Domain layer: state machines (ProductRevision, MaterialLot) + invariants (quantity, BOM immutability) + zod schemas
- Blocked by: T02. Status: ready-for-agent.

## T05 — Service layer: manufacturing module (products/revisions/bom/materials/lots/suppliers) with can()+audit()+SiteScope+DISQUALIFIED enforcement
- Blocked by: T03, T04. Status: ready-for-agent.

## T06 — API routes: /api/manufacturing/** with /transition endpoints, envelope, RBAC
- Blocked by: T05. Status: ready-for-agent.

## T07 — UI: manufacturing pages + sidebar nav + i18n catalogs (FR/EN/AR)
- Blocked by: T06. Status: ready-for-agent.

## T08 — DEMO seed (products, revisions, BOMs, materials, suppliers, site-owned lots)
- Blocked by: T03. Status: ready-for-agent.

## T09 — Tests: T-ISOL-02, T-BOM-01, T-REV-01, T-LOT-01, T-QUANT-01 + unit/integration/API + regression
- Blocked by: T05, T08. Status: ready-for-agent.

## T10 — Phase Gate + Validation Report + STOP
- Blocked by: T09. Status: ready-for-agent.
