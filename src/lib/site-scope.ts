// Multi-site isolation helper (ADR-0002, ADR-0004). CRITICAL: cross-site leakage is a critical defect.
// SQLite has no RLS; isolation is enforced at the repository layer. PostgreSQL will add RLS policies.
//
// Every site-scoped repository query MUST pass a SiteScope derived from AuthContext.resolvedSites.
// A lint/test convention asserts every site-scoped repo call passes a scope.

import type { Prisma } from "@prisma/client";
import { ForbiddenError } from "./errors";
import type { AuthContext } from "./rbac";

export type SiteScopeFilter = { siteId: { in: string[] } } | { siteId?: undefined };

// Build a Prisma `where` site filter from the AuthContext's resolved sites.
// "*" (super_admin) returns an empty filter (no restriction). Empty set returns an impossible filter
// (siteId in []), which returns no rows (safe default: deny if no sites).
export function siteScope(ctx: AuthContext): Prisma.SiteWhereInput & { siteId?: { in: string[] } } {
  if (ctx.resolvedSites === "*") {
    return {}; // global scope
  }
  return { siteId: { in: [...ctx.resolvedSites] } };
}

// For queries that select site-scoped rows directly (e.g., User via Assignment.siteId),
// use this to constrain the siteId column.
export function siteIdFilter(ctx: AuthContext): { siteId: { in: string[] } } | Record<string, never> {
  if (ctx.resolvedSites === "*") return {};
  return { siteId: { in: [...ctx.resolvedSites] } };
}

// Assert the user may act on a specific target site. Throws ForbiddenError otherwise.
export function assertSiteAccess(ctx: AuthContext, targetSiteId: string | null | undefined): void {
  if (targetSiteId === null || targetSiteId === undefined) return; // no specific target
  if (ctx.resolvedSites === "*") return;
  if (!ctx.resolvedSites.has(targetSiteId)) {
    throw new ForbiddenError("You do not have access to this site");
  }
}
