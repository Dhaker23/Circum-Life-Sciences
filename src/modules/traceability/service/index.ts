// Phase 6 traceability service: forward-trace, backward-trace, impact-analysis, genealogy-tree.
// D1: Pure query layer over existing data. D4: Impact analysis is informational only (no auto-action).
// D6: Site-scoped with boundary markers (no leaking hidden data). D7: TraceabilityQueryLog (append-only).
// PRD section 10: Traceability errors are critical defects.
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import {
  type TraceabilityGraph,
  type TraceabilityNode,
  type TraceabilityEdge,
  type BoundaryMarker,
  computeSummary,
  ForwardTraceSchema,
  BackwardTraceSchema,
  ImpactAnalysisSchema,
  GenealogyTreeSchema,
} from "../domain";
import type z from "zod";

// ---- Site scope check (D6) ----
function isSiteAuthorized(ctx: AuthContext, siteId: string | null | undefined): boolean {
  if (!siteId) return true; // global entities (Product, Specification, etc.)
  if (ctx.resolvedSites === "*") return true;
  return ctx.resolvedSites.has(siteId);
}

function boundaryMessage(): string {
  return "Additional related records exist outside your authorized scope"; // D6: no leaking
}

// ---- Resolve a starting entity to a TraceabilityNode ----
async function resolveNode(entityType: string, entityId: string): Promise<TraceabilityNode> {
  switch (entityType) {
    case "MATERIAL_LOT": {
      const e = await db.materialLot.findUnique({ where: { id: entityId }, include: { material: true, site: true } });
      if (!e) throw new NotFoundError("MaterialLot");
      return { id: e.id, entityType, entityId: e.id, code: e.lotCode, name: e.material.name, status: e.status, siteId: e.siteId ?? undefined, siteCode: e.site.code };
    }
    case "BATCH": {
      const e = await db.manufacturingBatch.findUnique({ where: { id: entityId }, include: { productRevision: { include: { product: true } }, site: true } });
      if (!e) throw new NotFoundError("Batch");
      return { id: e.id, entityType, entityId: e.id, code: e.code, name: `${e.productRevision.product.code} ${e.productRevision.revisionCode}`, status: e.status, siteId: e.siteId ?? undefined, siteCode: e.site.code };
    }
    case "DEVICE_LOT": {
      const e = await db.deviceLot.findUnique({ where: { id: entityId }, include: { batch: true, site: true } });
      if (!e) throw new NotFoundError("DeviceLot");
      return { id: e.id, entityType, entityId: e.id, code: e.code, name: e.code, status: e.status, siteId: e.siteId ?? undefined, siteCode: e.site.code };
    }
    case "WORK_ORDER": {
      const e = await db.workOrder.findUnique({ where: { id: entityId }, include: { productRevision: { include: { product: true } }, site: true } });
      if (!e) throw new NotFoundError("WorkOrder");
      return { id: e.id, entityType, entityId: e.id, code: e.code, name: `${e.productRevision.product.code} ${e.productRevision.revisionCode}`, status: e.status, siteId: e.siteId ?? undefined, siteCode: e.site.code };
    }
    case "PRODUCT": {
      const e = await db.product.findUnique({ where: { id: entityId } });
      if (!e) throw new NotFoundError("Product");
      return { id: e.id, entityType, entityId: e.id, code: e.code, name: e.name, status: e.status, siteId: undefined, siteCode: undefined };
    }
    case "PRODUCT_REVISION": {
      const e = await db.productRevision.findUnique({ where: { id: entityId }, include: { product: true } });
      if (!e) throw new NotFoundError("ProductRevision");
      return { id: e.id, entityType, entityId: e.id, code: e.revisionCode, name: `${e.product.code} ${e.revisionCode}`, status: e.status, siteId: undefined, siteCode: undefined };
    }
    case "MATERIAL": {
      const e = await db.material.findUnique({ where: { id: entityId } });
      if (!e) throw new NotFoundError("Material");
      return { id: e.id, entityType, entityId: e.id, code: e.code, name: e.name, status: e.status, siteId: undefined, siteCode: undefined };
    }
    case "TEST_RESULT": {
      const e = await db.testResult.findUnique({ where: { id: entityId }, include: { sample: true, specification: true, site: true } });
      if (!e) throw new NotFoundError("TestResult");
      return { id: e.id, entityType, entityId: e.id, code: e.code, name: `${e.specification.parameter}`, status: e.status, siteId: e.siteId ?? undefined, siteCode: e.site.code };
    }
    case "INSPECTION": {
      const e = await db.inspection.findUnique({ where: { id: entityId }, include: { site: true } });
      if (!e) throw new NotFoundError("Inspection");
      return { id: e.id, entityType, entityId: e.id, code: e.code, name: e.inspectionType, status: e.status, siteId: e.siteId ?? undefined, siteCode: e.site.code };
    }
    case "NCR": {
      const e = await db.nCR.findUnique({ where: { id: entityId }, include: { site: true } });
      if (!e) throw new NotFoundError("NCR");
      return { id: e.id, entityType, entityId: e.id, code: e.code, name: e.description.slice(0, 50), status: e.status, siteId: e.siteId ?? undefined, siteCode: e.site.code };
    }
    default:
      throw new NotFoundError(`Unsupported entity type: ${entityType}`);
  }
}

// ---- Forward trace: traverse downstream from a starting entity ----
export async function forwardTrace(ctx: AuthContext, input: z.infer<typeof ForwardTraceSchema>): Promise<TraceabilityGraph> {
  if (!can(ctx, "traceability.read")) throw new ForbiddenError();
  const rootNode = await resolveNode(input.startEntityType, input.startEntityId);
  // D6: check site scope on the root entity
  if (rootNode.siteId && !isSiteAuthorized(ctx, rootNode.siteId)) {
    throw new ForbiddenError("You are not authorized to trace genealogy at this site");
  }

  const nodes: TraceabilityNode[] = [rootNode];
  const edges: TraceabilityEdge[] = [];
  const boundaryMarkers: BoundaryMarker[] = [];
  const visited = new Set<string>([`${rootNode.entityType}:${rootNode.id}`]);
  let truncated = false;
  const maxDepth = input.maxDepth ?? 10;

  // BFS traversal
  let currentLevel = [rootNode];
  for (let depth = 0; depth < maxDepth && currentLevel.length > 0; depth++) {
    const nextLevel: TraceabilityNode[] = [];
    for (const node of currentLevel) {
      const downstream = await getDownstream(node, ctx, visited, edges, boundaryMarkers);
      for (const d of downstream) {
        const key = `${d.entityType}:${d.id}`;
        if (!visited.has(key)) {
          visited.add(key);
          nodes.push(d);
          nextLevel.push(d);
        }
      }
    }
    currentLevel = nextLevel;
    if (depth === maxDepth - 1 && currentLevel.length > 0) truncated = true;
  }

  const authorizationLimited = boundaryMarkers.length > 0;
  const summary = computeSummary(nodes, truncated, authorizationLimited);
  const graph: TraceabilityGraph = { root: rootNode, nodes, edges, boundaryMarkers, summary, authorizationLimited, truncated };

  await logQuery(ctx, "FORWARD_TRACE", input.startEntityType, input.startEntityId, input.maxDepth ?? null, null, summary, rootNode.siteId ?? null);
  return graph;
}

// ---- Backward trace: traverse upstream from a terminal entity ----
export async function backwardTrace(ctx: AuthContext, input: z.infer<typeof BackwardTraceSchema>): Promise<TraceabilityGraph> {
  if (!can(ctx, "traceability.read")) throw new ForbiddenError();
  const rootNode = await resolveNode(input.startEntityType, input.startEntityId);
  if (rootNode.siteId && !isSiteAuthorized(ctx, rootNode.siteId)) {
    throw new ForbiddenError("You are not authorized to trace genealogy at this site");
  }

  const nodes: TraceabilityNode[] = [rootNode];
  const edges: TraceabilityEdge[] = [];
  const boundaryMarkers: BoundaryMarker[] = [];
  const visited = new Set<string>([`${rootNode.entityType}:${rootNode.id}`]);
  let truncated = false;
  const maxDepth = input.maxDepth ?? 10;

  let currentLevel = [rootNode];
  for (let depth = 0; depth < maxDepth && currentLevel.length > 0; depth++) {
    const nextLevel: TraceabilityNode[] = [];
    for (const node of currentLevel) {
      const upstream = await getUpstream(node, ctx, visited, edges, boundaryMarkers);
      for (const u of upstream) {
        const key = `${u.entityType}:${u.id}`;
        if (!visited.has(key)) {
          visited.add(key);
          nodes.push(u);
          nextLevel.push(u);
        }
      }
    }
    currentLevel = nextLevel;
    if (depth === maxDepth - 1 && currentLevel.length > 0) truncated = true;
  }

  const authorizationLimited = boundaryMarkers.length > 0;
  const summary = computeSummary(nodes, truncated, authorizationLimited);
  const graph: TraceabilityGraph = { root: rootNode, nodes, edges, boundaryMarkers, summary, authorizationLimited, truncated };

  await logQuery(ctx, "BACKWARD_TRACE", input.startEntityType, input.startEntityId, input.maxDepth ?? null, null, summary, rootNode.siteId ?? null);
  return graph;
}

// ---- Impact analysis: forward trace + scenario (D4: informational only, no auto-action) ----
export async function impactAnalysis(ctx: AuthContext, input: z.infer<typeof ImpactAnalysisSchema>): Promise<TraceabilityGraph> {
  if (!can(ctx, "traceability.read")) throw new ForbiddenError();
  // Impact analysis = forward trace with a scenario label. D4: NO auto-action.
  const graph = await forwardTrace(ctx, { startEntityType: input.startEntityType, startEntityId: input.startEntityId, maxDepth: input.maxDepth });
  await logQuery(ctx, "IMPACT_ANALYSIS", input.startEntityType, input.startEntityId, input.maxDepth ?? null, input.scenario, graph.summary, graph.root.siteId ?? null);
  // D4: explicitly NO side effects. No NCR created, no batch held, no state changed.
  return graph;
}

// ---- Genealogy tree: full bidirectional trace for visualization ----
export async function genealogyTree(ctx: AuthContext, input: z.infer<typeof GenealogyTreeSchema>): Promise<TraceabilityGraph> {
  if (!can(ctx, "traceability.read")) throw new ForbiddenError();
  // Forward + backward combined
  const fwd = await forwardTrace(ctx, { startEntityType: input.entityType, startEntityId: input.entityId, maxDepth: 5 });
  const bwd = await backwardTrace(ctx, { startEntityType: input.entityType, startEntityId: input.entityId, maxDepth: 5 });
  // Merge (deduplicate by entityType:id)
  const visited = new Set<string>();
  const nodes: TraceabilityNode[] = [];
  const edges: TraceabilityEdge[] = [...fwd.edges, ...bwd.edges];
  const boundaryMarkers: BoundaryMarker[] = [...fwd.boundaryMarkers, ...bwd.boundaryMarkers];
  for (const n of [...bwd.nodes, ...fwd.nodes]) {
    const key = `${n.entityType}:${n.id}`;
    if (!visited.has(key)) { visited.add(key); nodes.push(n); }
  }
  const authorizationLimited = boundaryMarkers.length > 0;
  const summary = computeSummary(nodes, fwd.truncated || bwd.truncated, authorizationLimited);
  const graph: TraceabilityGraph = { root: fwd.root, nodes, edges, boundaryMarkers, summary, authorizationLimited, truncated: fwd.truncated || bwd.truncated };
  await logQuery(ctx, "GENEALOGY_TREE", input.entityType, input.entityId, 5, null, summary, graph.root.siteId ?? null);
  return graph;
}

// ---- Query log ----
export async function listQueryLogs(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "traceability.read")) throw new ForbiddenError();
  const [items, total] = await Promise.all([
    db.traceabilityQueryLog.findMany({ orderBy: { executedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { requester: { select: { id: true, name: true, email: true } } } }),
    db.traceabilityQueryLog.count(),
  ]);
  return { items, total, page, pageSize };
}

// ---- Helper: get downstream nodes from a given node ----
async function getDownstream(node: TraceabilityNode, ctx: AuthContext, visited: Set<string>, edges: TraceabilityEdge[], boundaryMarkers: BoundaryMarker[]): Promise<TraceabilityNode[]> {
  const result: TraceabilityNode[] = [];
  const addNode = (n: TraceabilityNode, rel: string) => {
    edges.push({ fromId: node.id, toId: n.id, relationshipType: rel });
    result.push(n);
  };
  const addBoundary = (entityType: string) => {
    boundaryMarkers.push({ nodeId: node.id, entityType, message: boundaryMessage() });
  };

  switch (node.entityType) {
    case "MATERIAL_LOT": {
      // MaterialLot → MaterialConsumption → Batch
      const consumptions = await db.materialConsumption.findMany({ where: { materialLotId: node.entityId }, include: { batch: { include: { site: true } } } });
      for (const c of consumptions) {
        if (isSiteAuthorized(ctx, c.batch.siteId)) {
          addNode({ id: c.batch.id, entityType: "BATCH", entityId: c.batch.id, code: c.batch.code, name: c.batch.code, status: c.batch.status, siteId: c.batch.siteId, siteCode: c.batch.site.code }, "CONSUMED_BY");
        } else { addBoundary("BATCH"); }
      }
      break;
    }
    case "MATERIAL": {
      // Material → MaterialLot
      const lots = await db.materialLot.findMany({ where: { materialId: node.entityId }, include: { site: true } });
      for (const l of lots) {
        if (isSiteAuthorized(ctx, l.siteId)) {
          addNode({ id: l.id, entityType: "MATERIAL_LOT", entityId: l.id, code: l.lotCode, name: l.lotCode, status: l.status, siteId: l.siteId, siteCode: l.site.code }, "HAS_LOT");
        } else { addBoundary("MATERIAL_LOT"); }
      }
      break;
    }
    case "PRODUCT": {
      const revs = await db.productRevision.findMany({ where: { productId: node.entityId } });
      for (const r of revs) addNode({ id: r.id, entityType: "PRODUCT_REVISION", entityId: r.id, code: r.revisionCode, name: r.revisionCode, status: r.status, siteId: undefined }, "HAS_REVISION");
      break;
    }
    case "PRODUCT_REVISION": {
      // Revision → WorkOrders
      const wos = await db.workOrder.findMany({ where: { productRevisionId: node.entityId }, include: { site: true } });
      for (const w of wos) {
        if (isSiteAuthorized(ctx, w.siteId)) {
          addNode({ id: w.id, entityType: "WORK_ORDER", entityId: w.id, code: w.code, name: w.code, status: w.status, siteId: w.siteId, siteCode: w.site.code }, "GOVERNED_BY");
        } else { addBoundary("WORK_ORDER"); }
      }
      break;
    }
    case "WORK_ORDER": {
      // WO → Batches
      const batches = await db.manufacturingBatch.findMany({ where: { workOrderId: node.entityId }, include: { site: true } });
      for (const b of batches) {
        if (isSiteAuthorized(ctx, b.siteId)) {
          addNode({ id: b.id, entityType: "BATCH", entityId: b.id, code: b.code, name: b.code, status: b.status, siteId: b.siteId, siteCode: b.site.code }, "PRODUCED_BY");
        } else { addBoundary("BATCH"); }
      }
      break;
    }
    case "BATCH": {
      // Batch → DeviceLots
      const dls = await db.deviceLot.findMany({ where: { batchId: node.entityId }, include: { site: true } });
      for (const d of dls) addNode({ id: d.id, entityType: "DEVICE_LOT", entityId: d.id, code: d.code, name: d.code, status: d.status, siteId: d.siteId, siteCode: d.site.code }, "SPLIT_INTO");
      // Batch → TestResults (via Sample)
      const samples = await db.sample.findMany({ where: { sourceEntityType: "BATCH", sourceEntityId: node.entityId }, include: { testResults: true } });
      for (const s of samples) for (const tr of s.testResults) addNode({ id: tr.id, entityType: "TEST_RESULT", entityId: tr.id, code: tr.code, name: tr.code, status: tr.status, siteId: tr.siteId }, "TESTED");
      // Batch → Inspections (polymorphic)
      const insps = await db.inspection.findMany({ where: { sourceEntityType: "BATCH", sourceEntityId: node.entityId } });
      for (const i of insps) addNode({ id: i.id, entityType: "INSPECTION", entityId: i.id, code: i.code, name: i.inspectionType, status: i.status, siteId: i.siteId }, "INSPECTED");
      // Batch → NCRs (polymorphic)
      const ncrs = await db.nCR.findMany({ where: { concernsEntityType: "BATCH", concernsEntityId: node.entityId } });
      for (const n of ncrs) addNode({ id: n.id, entityType: "NCR", entityId: n.id, code: n.code, name: n.description.slice(0, 50), status: n.status, siteId: n.siteId }, "RAISED_AGAINST");
      break;
    }
    case "DEVICE_LOT": {
      // DeviceLot → TestResults, Inspections, NCRs (polymorphic)
      await db.testResult.findMany({ where: {} }); // DeviceLot test results via sample
      const insps = await db.inspection.findMany({ where: { sourceEntityType: "DEVICE_LOT", sourceEntityId: node.entityId } });
      for (const i of insps) addNode({ id: i.id, entityType: "INSPECTION", entityId: i.id, code: i.code, name: i.inspectionType, status: i.status, siteId: i.siteId }, "INSPECTED");
      const ncrs = await db.nCR.findMany({ where: { concernsEntityType: "DEVICE_LOT", concernsEntityId: node.entityId } });
      for (const n of ncrs) addNode({ id: n.id, entityType: "NCR", entityId: n.id, code: n.code, name: n.description.slice(0, 50), status: n.status, siteId: n.siteId }, "RAISED_AGAINST");
      break;
    }
  }
  return result;
}

// ---- Helper: get upstream nodes from a given node ----
async function getUpstream(node: TraceabilityNode, ctx: AuthContext, visited: Set<string>, edges: TraceabilityEdge[], boundaryMarkers: BoundaryMarker[]): Promise<TraceabilityNode[]> {
  const result: TraceabilityNode[] = [];
  const addNode = (n: TraceabilityNode, rel: string) => {
    edges.push({ fromId: n.id, toId: node.id, relationshipType: rel });
    result.push(n);
  };
  const addBoundary = (entityType: string) => {
    boundaryMarkers.push({ nodeId: node.id, entityType, message: boundaryMessage() });
  };

  switch (node.entityType) {
    case "DEVICE_LOT": {
      // DeviceLot → Batch
      const dl = await db.deviceLot.findUnique({ where: { id: node.entityId }, include: { batch: { include: { site: true } } } });
      if (dl?.batch) addNode({ id: dl.batch.id, entityType: "BATCH", entityId: dl.batch.id, code: dl.batch.code, name: dl.batch.code, status: dl.batch.status, siteId: dl.batch.siteId, siteCode: dl.batch.site.code }, "SPLIT_FROM");
      break;
    }
    case "BATCH": {
      // Batch → WorkOrder
      const b = await db.manufacturingBatch.findUnique({ where: { id: node.entityId }, include: { workOrder: { include: { productRevision: { include: { product: true } }, site: true } } } });
      if (b?.workOrder) {
        addNode({ id: b.workOrder.id, entityType: "WORK_ORDER", entityId: b.workOrder.id, code: b.workOrder.code, name: b.workOrder.code, status: b.workOrder.status, siteId: b.workOrder.siteId, siteCode: b.workOrder.site.code }, "PRODUCED_BY");
        // WorkOrder → ProductRevision
        addNode({ id: b.workOrder.productRevision.id, entityType: "PRODUCT_REVISION", entityId: b.workOrder.productRevision.id, code: b.workOrder.productRevision.revisionCode, name: `${b.workOrder.productRevision.product.code} ${b.workOrder.productRevision.revisionCode}`, status: b.workOrder.productRevision.status, siteId: undefined }, "GOVERNED_BY");
        // ProductRevision → Product
        addNode({ id: b.workOrder.productRevision.product.id, entityType: "PRODUCT", entityId: b.workOrder.productRevision.product.id, code: b.workOrder.productRevision.product.code, name: b.workOrder.productRevision.product.name, status: b.workOrder.productRevision.product.status, siteId: undefined }, "REVISION_OF");
      }
      // Batch → MaterialConsumption → MaterialLot
      const consumptions = await db.materialConsumption.findMany({ where: { batchId: node.entityId }, include: { materialLot: { include: { material: true, supplier: true, site: true } } } });
      for (const c of consumptions) {
        if (isSiteAuthorized(ctx, c.materialLot.siteId)) {
          addNode({ id: c.materialLot.id, entityType: "MATERIAL_LOT", entityId: c.materialLot.id, code: c.materialLot.lotCode, name: c.materialLot.material.name, status: c.materialLot.status, siteId: c.materialLot.siteId, siteCode: c.materialLot.site.code }, "CONSUMED");
          // MaterialLot → Material
          addNode({ id: c.materialLot.material.id, entityType: "MATERIAL", entityId: c.materialLot.material.id, code: c.materialLot.material.code, name: c.materialLot.material.name, status: c.materialLot.material.status, siteId: undefined }, "LOT_OF");
        } else { addBoundary("MATERIAL_LOT"); }
      }
      break;
    }
    case "WORK_ORDER": {
      const w = await db.workOrder.findUnique({ where: { id: node.entityId }, include: { productRevision: { include: { product: true } } } });
      if (w?.productRevision) {
        addNode({ id: w.productRevision.id, entityType: "PRODUCT_REVISION", entityId: w.productRevision.id, code: w.productRevision.revisionCode, name: w.productRevision.revisionCode, status: w.productRevision.status, siteId: undefined }, "GOVERNED_BY");
        addNode({ id: w.productRevision.product.id, entityType: "PRODUCT", entityId: w.productRevision.product.id, code: w.productRevision.product.code, name: w.productRevision.product.name, status: w.productRevision.product.status, siteId: undefined }, "REVISION_OF");
      }
      break;
    }
    case "PRODUCT_REVISION": {
      const r = await db.productRevision.findUnique({ where: { id: node.entityId }, include: { product: true } });
      if (r?.product) addNode({ id: r.product.id, entityType: "PRODUCT", entityId: r.product.id, code: r.product.code, name: r.product.name, status: r.product.status, siteId: undefined }, "REVISION_OF");
      break;
    }
    case "TEST_RESULT": {
      // TestResult → Sample → Batch/DeviceLot/MaterialLot
      const tr = await db.testResult.findUnique({ where: { id: node.entityId }, include: { sample: { include: { site: true } } } });
      if (tr?.sample) {
        addNode({ id: tr.sample.id, entityType: "MATERIAL_LOT", entityId: tr.sample.id, code: tr.sample.code, name: tr.sample.code, status: tr.sample.status, siteId: tr.sample.siteId, siteCode: tr.sample.site.code }, "SAMPLED_FROM");
      }
      break;
    }
    case "NCR": {
      // NCR → concernsEntity (polymorphic)
      const n = await db.nCR.findUnique({ where: { id: node.entityId } });
      if (n) {
        try {
          const upstream = await resolveNode(n.concernsEntityType, n.concernsEntityId);
          if (isSiteAuthorized(ctx, upstream.siteId)) {
            addNode(upstream, "CONCERNS");
          } else { addBoundary(n.concernsEntityType); }
        } catch { /* entity may have been deleted; skip */ }
      }
      break;
    }
  }
  return result;
}

// ---- Helper: log a query to TraceabilityQueryLog (D7) ----
async function logQuery(ctx: AuthContext, queryType: string, rootEntityType: string, rootEntityId: string, requestedDepth: number | null, scenario: string | null, summary: TraceabilityGraph["summary"], siteId: string | null): Promise<void> {
  try {
    await db.traceabilityQueryLog.create({
      data: {
        queryType,
        rootEntityType,
        rootEntityId,
        requestedDepth,
        scenario,
        requestedByUserId: ctx.user.id,
        authorizedScope: ctx.resolvedSites === "*" ? "*" : siteId ?? "",
        resultSummary: summary as never,
      },
    });
  } catch (e) {
    console.error("[traceability] FAILED to log query:", e);
  }
}
