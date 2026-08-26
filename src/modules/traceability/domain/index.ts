// Phase 6 traceability domain: TraceabilityGraph contract + types + zod.
// D1: Pure query layer. D4: Impact analysis is informational only (no auto-action).
// D6: Site-scoped with boundary markers (no leaking hidden data).
// D7: TraceabilityQueryLog (append-only audit, no full result duplication).
// PRD section 10: Traceability errors are critical defects.
import { z } from "zod";

// ---- TraceabilityGraph contract (owner mandatory requirement) ----
// All traceability APIs return this stable, normalized structure.
export interface TraceabilityNode {
  id: string;
  entityType: string;
  entityId: string;
  code: string;
  name: string;
  status?: string;
  siteId?: string;
  siteCode?: string;
}

export interface TraceabilityEdge {
  fromId: string;
  toId: string;
  relationshipType: string; // e.g., "PRODUCED_FROM", "CONSUMED", "TESTED", "INSPECTED", "RAISED_AGAINST"
}

export interface BoundaryMarker {
  nodeId: string;
  entityType: string;
  message: string; // "Additional related records exist outside your authorized scope" (D6: no leaking)
}

export interface TraceabilityGraph {
  root: TraceabilityNode;
  nodes: TraceabilityNode[];
  edges: TraceabilityEdge[];
  boundaryMarkers: BoundaryMarker[];
  summary: {
    totalNodes: number;
    nodesByType: Record<string, number>;
    affectedBatches: number;
    affectedDeviceLots: number;
    affectedTestResults: number;
    affectedInspections: number;
    affectedNCRs: number;
    affectedScraps: number;
    affectedReworks: number;
  };
  authorizationLimited: boolean; // true if any boundary markers exist (D6)
  truncated: boolean; // true if maxDepth was reached
}

// ---- Query types ----
export const ENTITY_TYPES = [
  "MATERIAL_LOT", "BATCH", "DEVICE_LOT", "WORK_ORDER",
  "PRODUCT", "PRODUCT_REVISION", "MATERIAL",
  "TEST_RESULT", "INSPECTION", "NCR",
] as const;

export const QUERY_TYPES = ["FORWARD_TRACE", "BACKWARD_TRACE", "IMPACT_ANALYSIS", "GENEALOGY_TREE"] as const;
export const SCENARIOS = ["RECALL", "QUARANTINE", "DEVIATION", "AUDIT"] as const;

// ---- Zod schemas ----
export const ForwardTraceSchema = z.object({
  startEntityType: z.enum(ENTITY_TYPES),
  startEntityId: z.string().cuid(),
  maxDepth: z.number().int().min(1).max(10).optional(),
});

export const BackwardTraceSchema = z.object({
  startEntityType: z.enum(ENTITY_TYPES),
  startEntityId: z.string().cuid(),
  maxDepth: z.number().int().min(1).max(10).optional(),
});

export const ImpactAnalysisSchema = z.object({
  startEntityType: z.enum(ENTITY_TYPES),
  startEntityId: z.string().cuid(),
  scenario: z.enum(SCENARIOS),
  maxDepth: z.number().int().min(1).max(10).optional(),
});

export const GenealogyTreeSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.string().cuid(),
});

// ---- Helper: build an empty graph ----
export function emptyGraph(root: TraceabilityNode): TraceabilityGraph {
  return {
    root,
    nodes: [root],
    edges: [],
    boundaryMarkers: [],
    summary: {
      totalNodes: 1,
      nodesByType: { [root.entityType]: 1 },
      affectedBatches: 0,
      affectedDeviceLots: 0,
      affectedTestResults: 0,
      affectedInspections: 0,
      affectedNCRs: 0,
      affectedScraps: 0,
      affectedReworks: 0,
    },
    authorizationLimited: false,
    truncated: false,
  };
}

// ---- Helper: compute summary from nodes ----
export function computeSummary(nodes: TraceabilityNode[], _truncated: boolean, _authorizationLimited: boolean): TraceabilityGraph["summary"] {
  const nodesByType: Record<string, number> = {};
  for (const n of nodes) {
    nodesByType[n.entityType] = (nodesByType[n.entityType] ?? 0) + 1;
  }
  return {
    totalNodes: nodes.length,
    nodesByType,
    affectedBatches: nodesByType["BATCH"] ?? 0,
    affectedDeviceLots: nodesByType["DEVICE_LOT"] ?? 0,
    affectedTestResults: nodesByType["TEST_RESULT"] ?? 0,
    affectedInspections: nodesByType["INSPECTION"] ?? 0,
    affectedNCRs: nodesByType["NCR"] ?? 0,
    affectedScraps: 0, // counted separately if needed
    affectedReworks: 0,
  };
}
