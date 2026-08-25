# Phase 3 — Tickets (tracer-bullet decomposition)

## T01 — ADRs 0008-0009 + spec/tickets
- Done (slice 0-1).

## T02 — Prisma schema + migration (phase3_production)
- 12 new models: Routing, Operation, WorkCenter, WorkOrder, ManufacturingBatch, DeviceLot, OperationExecution, MaterialConsumption, MaterialReservation, ProductionScrap, ProductionRework, Shift. Relations to ProductRevision/MaterialLot(quantityReserved)/Employee/User/Site. PG-portable.
- Blocked by: T01. Status: ready-for-agent.

## T03 — permissions.ts: production.* catalog + least-privilege grants + RBAC matrix
- Blocked by: T02. Status: ready-for-agent.

## T04 — Domain layer: state machines (WO/Batch/DeviceLot) + routing immutability + quantity invariants + consumption transactionality + zod
- Blocked by: T02. Status: ready-for-agent.

## T05 — Service layer: production module (routings, work-centers, work-orders, batches, device-lots, executions, consumptions, reservations, scraps, reworks, shifts) with can()+audit()+SiteScope
- Blocked by: T03, T04. Status: ready-for-agent.

## T06 — API routes: /api/production/** with /transition, transactional consumption, envelope, RBAC
- Blocked by: T05. Status: ready-for-agent.

## T07 — UI: production pages + sidebar nav + i18n (FR/EN/AR)
- Blocked by: T06. Status: ready-for-agent.

## T08 — DEMO seed (work centers, shifts, routings+operations, work orders, batches, device lots, consumptions, executions, scrap/rework)
- Blocked by: T03. Status: ready-for-agent.

## T09 — Tests: 9 critical + genealogy + regression (Phase 1+2)
- Blocked by: T05, T08. Status: ready-for-agent.

## T10 — Phase Gate (21 checks) + Validation Report + STOP
- Blocked by: T09. Status: ready-for-agent.
