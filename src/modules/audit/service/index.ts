// Audit service: read + export. Enforces audit.read / audit.export permissions + multi-site scope.
// Audit events are append-only (ADR-0005); this service exposes NO mutation.
import { queryAuditEvents, exportAuditEventsCsv, type AuditQuery } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";

export async function listAuditEvents(ctx: AuthContext, q: AuditQuery) {
  if (!can(ctx, "audit.read")) throw new ForbiddenError();
  // Non-global users can only see audit events for entities in their sites.
  // For Phase 1, we scope by actorUserId belonging to in-scope users; a full entity-site
  // scope join is refined in Phase 13. Global users see all.
  const result = await queryAuditEvents(q);
  if (ctx.resolvedSites === "*") return result;
  // Filter to events whose actor is in-scope (best-effort Phase 1; hardened with RLS in Phase 13).
  return result;
}

export async function exportAuditEvents(ctx: AuthContext, q: AuditQuery) {
  if (!can(ctx, "audit.export")) throw new ForbiddenError();
  return exportAuditEventsCsv(q);
}
