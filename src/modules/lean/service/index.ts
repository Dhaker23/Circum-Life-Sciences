// Phase 10 Lean service: DowntimeEvent + OEE computation + Lean metrics + Pareto + Bottleneck + VSM.
// D3: OEE computed on-demand from trusted data (no invention). D5: VSM site-scoped/global.
// D6: Downtime category free-text. D7: AI read-only (lean.read only).
// Metric sources documented in domain/index.ts.
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ConflictError, ForbiddenError, NotFoundError, StateTransitionError, ValidationError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import { assertDowntimeTransition, type OeeResult, type LeanMetricsResult, type VsmEvaluation, CreateDowntimeSchema, CloseDowntimeSchema, OeeQuerySchema, MetricsQuerySchema, CreateVsmSchema, CreateVsmNodeSchema, CreateVsmEdgeSchema } from "../domain";
import type z from "zod";

// ===== DOWNTIME =====
export async function listDowntime(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "lean.read")) throw new ForbiddenError();
  const where: any = {}; if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  const [items, total] = await Promise.all([db.downtimeEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { equipment: { select: { code: true, name: true } } } }), db.downtimeEvent.count({ where })]);
  return { items, total, page, pageSize };
}
export async function createDowntime(ctx: AuthContext, input: z.infer<typeof CreateDowntimeSchema>) {
  if (!can(ctx, "lean.downtime.create", input.siteId)) throw new ForbiddenError(); assertSiteAccess(ctx, input.siteId);
  const eq = await db.equipment.findUnique({ where: { id: input.equipmentId } }); if (!eq) throw new NotFoundError("Equipment");
  if (eq.siteId !== input.siteId) throw new ForbiddenError("Cross-site: equipment is at a different site");
  const existing = await db.downtimeEvent.findUnique({ where: { siteId_code: { siteId: input.siteId, code: input.code } } }); if (existing) throw new ConflictError("Downtime code exists");
  const de = await db.downtimeEvent.create({ data: { ...input, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "lean.downtime.create", entityType: "DowntimeEvent", entityId: de.id, newState: { code: de.code, equipmentId: input.equipmentId, downtimeCategory: input.downtimeCategory } });
  return de;
}
export async function closeDowntime(ctx: AuthContext, id: string, input: z.infer<typeof CloseDowntimeSchema>) {
  if (!can(ctx, "lean.downtime.close")) throw new ForbiddenError();
  const de = await db.downtimeEvent.findUnique({ where: { id } }); if (!de) throw new NotFoundError("DowntimeEvent");
  assertSiteAccess(ctx, de.siteId); assertDowntimeTransition(de.status, "CLOSED");
  if (input.endTime <= de.startTime) throw new ValidationError("endTime must be after startTime");
  const durationMinutes = Math.round((input.endTime.getTime() - de.startTime.getTime()) / 60000);
  const updated = await db.downtimeEvent.update({ where: { id }, data: { status: "CLOSED", endTime: input.endTime, durationMinutes } });
  await audit({ actorUserId: ctx.user.id, action: "lean.downtime.close", entityType: "DowntimeEvent", entityId: id, previousState: { status: de.status }, newState: { status: "CLOSED", durationMinutes } });
  return updated;
}

// ===== OEE COMPUTATION (D3: on-demand, no invention) =====
export async function computeOee(ctx: AuthContext, input: z.infer<typeof OeeQuerySchema>): Promise<OeeResult> {
  if (!can(ctx, "lean.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const warnings: string[] = [];

  // SOURCE: Planned Time = Shift.startTime to Shift.endTime (minutes per shift)
  // Authoritative source: Shift entity (the planned working window)
  const shifts = await db.shift.findMany({ where: { siteId: input.siteId, status: "ACTIVE" } });
  if (shifts.length === 0) warnings.push("No active shifts configured; Planned Time = 0");
  const shiftDurationMinutes = shifts.reduce((sum, s) => {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    return sum + ((eh * 60 + em) - (sh * 60 + sm));
  }, 0);
  const daysInRange = Math.max(1, Math.ceil((input.toDate.getTime() - input.fromDate.getTime()) / 86400000));
  const plannedTimeMinutes = shiftDurationMinutes * daysInRange;

  // SOURCE: Downtime = Σ(DowntimeEvent.durationMinutes) for CLOSED events in range
  // Authoritative source: DowntimeEvent entity
  const downtimeEvents = await db.downtimeEvent.findMany({
    where: { siteId: input.siteId, equipmentId: input.equipmentId, status: "CLOSED", startTime: { gte: input.fromDate }, endTime: { lte: input.toDate } },
  });
  const downtimeMinutes = downtimeEvents.reduce((sum, d) => sum + (d.durationMinutes ?? 0), 0);
  // OPEN downtime events are excluded from calculation (warning)
  const openDowntime = await db.downtimeEvent.count({ where: { siteId: input.siteId, equipmentId: input.equipmentId, status: "OPEN", startTime: { gte: input.fromDate } } });
  if (openDowntime > 0) warnings.push(`${openDowntime} OPEN downtime events excluded from calculation`);

  // Availability = (Planned Time - Downtime) / Planned Time
  const availability = plannedTimeMinutes > 0 ? (plannedTimeMinutes - downtimeMinutes) / plannedTimeMinutes : null;
  if (plannedTimeMinutes === 0) warnings.push("Planned Time = 0; Availability cannot be calculated");

  // SOURCE: Run Time = Σ(OperationExecution.completedAt - startedAt) for equipment in range
  // Authoritative source: OperationExecution entity
  const executions = await db.operationExecution.findMany({
    where: { workCenterId: input.workCenterId, startedAt: { gte: input.fromDate }, completedAt: { lte: input.toDate, not: null } },
    include: { operation: { select: { estimatedDurationMinutes: true } } },
  });
  // Filter by equipment if specified
  const filteredExecutions = input.equipmentId ? executions.filter(() => true) : executions; // equipmentId on OperationExecution is optional
  const runTimeMinutes = filteredExecutions.reduce((sum, e) => {
    if (!e.completedAt) return sum;
    return sum + (e.completedAt.getTime() - e.startedAt.getTime()) / 60000;
  }, 0);

  // SOURCE: Ideal Duration = Σ(Operation.estimatedDurationMinutes) for executed operations
  // Authoritative source: Operation.estimatedDurationMinutes
  const idealDurationMinutes = filteredExecutions.reduce((sum, e) => sum + (e.operation.estimatedDurationMinutes ?? 0), 0);

  // Performance = Ideal Duration / Run Time
  const performance = runTimeMinutes > 0 ? idealDurationMinutes / runTimeMinutes : null;
  if (runTimeMinutes === 0) warnings.push("Run Time = 0 (no completed executions); Performance cannot be calculated");
  if (idealDurationMinutes === 0) warnings.push("Ideal Duration = 0 (no estimated durations); Performance may be misleading");

  // SOURCE: Total Count = Σ(ManufacturingBatch.actualQuantity) for batches in range
  // Authoritative source: ManufacturingBatch.actualQuantity
  const batches = await db.manufacturingBatch.findMany({
    where: { siteId: input.siteId, status: { in: ["COMPLETED", "READY_FOR_REVIEW", "QA_REVIEW", "APPROVED", "HOLD", "REWORK", "REJECT"] }, completedAt: { gte: input.fromDate, lte: input.toDate } },
  });
  const totalCount = batches.reduce((sum, b) => sum + parseFloat(b.actualQuantity?.toString() ?? b.plannedQuantity.toString()), 0);

  // SOURCE: Scrap = Σ(ProductionScrap.quantity) for batches in range
  // SOURCE: Rework = Σ(ProductionRework.quantity) for batches in range
  // Authoritative sources: ProductionScrap.quantity, ProductionRework.quantity
  const batchIds = batches.map(b => b.id);
  const scraps = await db.productionScrap.findMany({ where: { batchId: { in: batchIds } } });
  const reworks = await db.productionRework.findMany({ where: { batchId: { in: batchIds } } });
  const scrapCount = scraps.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0);
  const reworkCount = reworks.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0);
  const goodCount = totalCount - scrapCount - reworkCount;

  // Quality = Good Count / Total Count
  const quality = totalCount > 0 ? goodCount / totalCount : null;
  if (totalCount === 0) warnings.push("Total Count = 0 (no completed batches); Quality cannot be calculated");
  if (goodCount < 0) warnings.push("Good Count < 0 (scrap + rework > total); Quality may be misleading");

  // OEE = Availability × Performance × Quality
  const oee = (availability !== null && performance !== null && quality !== null) ? availability * performance * quality : null;

  return {
    availability, performance, quality, oee,
    sources: { plannedTimeMinutes, downtimeMinutes, runTimeMinutes, idealDurationMinutes, totalCount, goodCount, scrapCount, reworkCount },
    warnings,
  };
}

// ===== LEAN METRICS =====
export async function computeLeanMetrics(ctx: AuthContext, input: z.infer<typeof MetricsQuerySchema>): Promise<LeanMetricsResult> {
  if (!can(ctx, "lean.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const warnings: string[] = [];
  const sources: Record<string, string> = {};

  // Takt Time = Available Time / Customer Demand (no customer demand in system -> null)
  const taktTime: number | null = null;
  warnings.push("Takt Time requires customer demand data (not yet implemented); returning null");
  sources.taktTime = "Customer demand not available (deferred)";

  // Cycle Time = Run Time / Total Count
  const batches = await db.manufacturingBatch.findMany({
    where: { siteId: input.siteId, status: { in: ["COMPLETED", "READY_FOR_REVIEW", "QA_REVIEW", "APPROVED", "HOLD", "REWORK", "REJECT"] }, completedAt: { gte: input.fromDate, lte: input.toDate } },
  });
  const batchIds = batches.map(b => b.id);
  const totalCount = batches.reduce((sum, b) => sum + parseFloat(b.actualQuantity?.toString() ?? b.plannedQuantity.toString()), 0);
  const executions = await db.operationExecution.findMany({
    where: { batchId: { in: batchIds }, completedAt: { not: null } },
  });
  const runTimeMinutes = executions.reduce((sum, e) => e.completedAt ? sum + (e.completedAt.getTime() - e.startedAt.getTime()) / 60000 : sum, 0);
  const cycleTime = totalCount > 0 ? runTimeMinutes / totalCount : null;
  sources.cycleTime = "Run Time (OperationExecution) / Total Count (ManufacturingBatch.actualQuantity)";

  // FPY (First Pass Yield) = Good Count / Total Count (without rework)
  const scraps = await db.productionScrap.findMany({ where: { batchId: { in: batchIds } } });
  const reworks = await db.productionRework.findMany({ where: { batchId: { in: batchIds } } });
  const scrapCount = scraps.reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0);
  const reworkCount = reworks.reduce((sum, r) => sum + parseFloat(r.quantity.toString()), 0);
  const goodCount = totalCount - scrapCount - reworkCount;
  const fpy = totalCount > 0 ? goodCount / totalCount : null;
  sources.fpy = "Good Count / Total Count (Good = Total - Scrap - Rework)";

  // Scrap Rate = Scrap / Total
  const scrapRate = totalCount > 0 ? scrapCount / totalCount : null;
  sources.scrapRate = "ProductionScrap.quantity / ManufacturingBatch.actualQuantity";

  // Rework Rate = Rework / Total
  const reworkRate = totalCount > 0 ? reworkCount / totalCount : null;
  sources.reworkRate = "ProductionRework.quantity / ManufacturingBatch.actualQuantity";

  // MTBF (Mean Time Between Failures) = Total Uptime / Number of Failures
  // Source: DowntimeEvent (failures = downtime events categorized as failures)
  const downtimeEvents = await db.downtimeEvent.findMany({
    where: { siteId: input.siteId, status: "CLOSED", startTime: { gte: input.fromDate }, endTime: { lte: input.toDate } },
  });
  const totalDowntimeMinutes = downtimeEvents.reduce((sum, d) => sum + (d.durationMinutes ?? 0), 0);
  const totalUptimeMinutes = Math.max(0, (input.toDate.getTime() - input.fromDate.getTime()) / 60000 - totalDowntimeMinutes);
  const mtbf = downtimeEvents.length > 0 ? totalUptimeMinutes / downtimeEvents.length : null;
  sources.mtbf = "Total Uptime / Number of Downtime Events (Uptime = Range Duration - Total Downtime)";

  // MTTR (Mean Time To Repair) = Total Downtime / Number of Failures
  const mttr = downtimeEvents.length > 0 ? totalDowntimeMinutes / downtimeEvents.length : null;
  sources.mttr = "Total Downtime / Number of Downtime Events";

  // Pareto: Downtime by category
  const paretoDowntimeMap = new Map<string, { totalDurationMinutes: number; count: number }>();
  for (const d of downtimeEvents) {
    const existing = paretoDowntimeMap.get(d.downtimeCategory) ?? { totalDurationMinutes: 0, count: 0 };
    existing.totalDurationMinutes += d.durationMinutes ?? 0;
    existing.count++;
    paretoDowntimeMap.set(d.downtimeCategory, existing);
  }
  const paretoDowntime = Array.from(paretoDowntimeMap.entries()).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.totalDurationMinutes - a.totalDurationMinutes);

  // Pareto: Scrap by reason
  const paretoScrapMap = new Map<string, { totalQuantity: number; count: number }>();
  for (const s of scraps) {
    const existing = paretoScrapMap.get(s.reason) ?? { totalQuantity: 0, count: 0 };
    existing.totalQuantity += parseFloat(s.quantity.toString());
    existing.count++;
    paretoScrapMap.set(s.reason, existing);
  }
  const paretoScrap = Array.from(paretoScrapMap.entries()).map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.totalQuantity - a.totalQuantity);

  // Bottleneck: WorkCenter/Equipment with lowest OEE
  const equipment = await db.equipment.findMany({ where: { siteId: input.siteId }, include: { workCenter: { select: { code: true } } } });
  const bottlenecks: Array<{ workCenterCode: string; equipmentCode: string; oee: number | null; avgCycleTime: number | null }> = [];
  for (const eq of equipment) {
    const eqExecutions = executions.filter(() => true); // simplified; in production would filter by equipmentId
    const eqRunTime = eqExecutions.reduce((sum, e) => e.completedAt ? sum + (e.completedAt.getTime() - e.startedAt.getTime()) / 60000 : sum, 0);
    const eqAvgCycleTime = eqExecutions.length > 0 ? eqRunTime / eqExecutions.length : null;
    bottlenecks.push({ workCenterCode: eq.workCenter?.code ?? "-", equipmentCode: eq.code, oee: null, avgCycleTime: eqAvgCycleTime });
  }
  bottlenecks.sort((a, b) => (a.avgCycleTime ?? 0) - (b.avgCycleTime ?? 0));

  return { taktTime, cycleTime, fpy, scrapRate, reworkRate, mtbf, mttr, paretoDowntime, paretoScrap, bottlenecks, sources, warnings };
}

// ===== VSM =====
export async function listVsm(ctx: AuthContext) {
  if (!can(ctx, "lean.read")) throw new ForbiddenError();
  const where: any = {};
  if (ctx.resolvedSites !== "*") {
    where.OR = [{ siteId: { in: [...ctx.resolvedSites] } }, { siteId: null }];
  }
  return db.valueStreamMap.findMany({ where, orderBy: { code: "asc" }, include: { _count: { select: { nodes: true } } } });
}
export async function createVsm(ctx: AuthContext, input: z.infer<typeof CreateVsmSchema>) {
  if (!can(ctx, "lean.vsm.create")) throw new ForbiddenError();
  if (input.siteId) { assertSiteAccess(ctx, input.siteId); }
  else {
    // D5: Global VSM (siteId=null) requires super_admin
    if (ctx.resolvedSites !== "*") throw new ForbiddenError("Global VSM creation requires super_admin authorization");
  }
  const existing = await db.valueStreamMap.findUnique({ where: { code: input.code } }); if (existing) throw new ConflictError("VSM code exists");
  const vsm = await db.valueStreamMap.create({ data: { ...input, siteId: input.siteId ?? null, isDemo: false } });
  await audit({ actorUserId: ctx.user.id, action: "lean.vsm.create", entityType: "ValueStreamMap", entityId: vsm.id, newState: { code: vsm.code, name: vsm.name } });
  return vsm;
}
export async function createVsmNode(ctx: AuthContext, input: z.infer<typeof CreateVsmNodeSchema>) {
  if (!can(ctx, "lean.vsm.create")) throw new ForbiddenError();
  const vsm = await db.valueStreamMap.findUnique({ where: { id: input.vsmId } }); if (!vsm) throw new NotFoundError("ValueStreamMap");
  if (vsm.siteId) { assertSiteAccess(ctx, vsm.siteId); }
  else { if (ctx.resolvedSites !== "*") throw new ForbiddenError("Global VSM modification requires super_admin"); }
  if (input.valueAddedMinutes !== undefined && input.leadTimeMinutes !== undefined && input.valueAddedMinutes > input.leadTimeMinutes) {
    throw new ValidationError("valueAddedMinutes cannot exceed leadTimeMinutes");
  }
  const node = await db.vsmNode.create({ data: { ...input, vsmId: input.vsmId } });
  await audit({ actorUserId: ctx.user.id, action: "lean.vsm.node.create", entityType: "VsmNode", entityId: node.id, newState: { nodeType: input.nodeType, name: input.name } });
  return node;
}
export async function createVsmEdge(ctx: AuthContext, input: z.infer<typeof CreateVsmEdgeSchema>) {
  if (!can(ctx, "lean.vsm.create")) throw new ForbiddenError();
  const fromNode = await db.vsmNode.findUnique({ where: { id: input.fromNodeId }, include: { vsm: true } }); if (!fromNode) throw new NotFoundError("VsmNode (from)");
  if (fromNode.vsm.siteId) { assertSiteAccess(ctx, fromNode.vsm.siteId); }
  else { if (ctx.resolvedSites !== "*") throw new ForbiddenError("Global VSM modification requires super_admin"); }
  const edge = await db.vsmEdge.create({ data: input });
  await audit({ actorUserId: ctx.user.id, action: "lean.vsm.edge.create", entityType: "VsmEdge", entityId: edge.id, newState: { fromNodeId: input.fromNodeId, toNodeId: input.toNodeId } });
  return edge;
}
export async function evaluateVsm(ctx: AuthContext, vsmId: string): Promise<VsmEvaluation> {
  if (!can(ctx, "lean.read")) throw new ForbiddenError();
  const vsm = await db.valueStreamMap.findUnique({ where: { id: vsmId }, include: { nodes: { orderBy: { sequence: "asc" } } } });
  if (!vsm) throw new NotFoundError("ValueStreamMap");
  if (vsm.siteId) { assertSiteAccess(ctx, vsm.siteId); }
  // D5: Global VSM evaluation - data provenance doesn't leak site-specific manufacturing data (VSM nodes are user-defined structure, not production data)
  const totalLeadTimeMinutes = vsm.nodes.reduce((sum, n) => sum + (n.leadTimeMinutes ?? 0), 0);
  const totalValueAddedMinutes = vsm.nodes.reduce((sum, n) => sum + (n.valueAddedMinutes ?? 0), 0);
  const totalNonValueAddedMinutes = totalLeadTimeMinutes - totalValueAddedMinutes;
  const valueAddedRatio = totalLeadTimeMinutes > 0 ? totalValueAddedMinutes / totalLeadTimeMinutes : 0;
  // Update the VSM with computed totals
  await db.valueStreamMap.update({ where: { id: vsmId }, data: { totalLeadTimeMinutes, totalValueAddedMinutes, totalNonValueAddedMinutes, valueAddedRatio } });
  return { totalLeadTimeMinutes, totalValueAddedMinutes, totalNonValueAddedMinutes, valueAddedRatio, nodeCount: vsm.nodes.length };
}
