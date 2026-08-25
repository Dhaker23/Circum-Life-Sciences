// Circum RBAC core (ADR-0004). Least-privilege, 3-layer enforcement.
// can() is the AUTHORITATIVE check (service/domain layer). Middleware is convenience + early reject.
// UI hiding is NOT authorization.

import type { Assignment, Permission, Role, User } from "@prisma/client";
import { z } from "zod";

// Permission key format: <module>.<resource>.<action>
export const PermissionKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_-]*$/, "Invalid permission key format");
export type PermissionKey = z.infer<typeof PermissionKeySchema>;

// A scope boundary for an Assignment.
export interface Scope {
  siteId: string | null; // null = all sites (Super Admin only)
  departmentId: string | null; // null = whole site
  moduleScope: string | null; // optional module restriction
}

// The resolved authorization context for a request. Built once per request from the session.
export interface AuthContext {
  user: Pick<User, "id" | "email" | "name" | "preferredLocale" | "status">;
  assignments: Array<
    Pick<Assignment, "id" | "siteId" | "departmentId" | "moduleScope" | "status" | "validFrom" | "validUntil"> & {
      role: Pick<Role, "id" | "systemKey"> & { permissions: Pick<Permission, "key">[] };
    }
  >;
  // Derived: the set of permission keys the user holds.
  resolvedPermissions: Set<string>;
  // Derived: the set of site IDs the user may act within. "*" means all (super_admin).
  resolvedSites: Set<string> | "*";
}

// Build an AuthContext from a user + their active assignments (with role+permissions eagerly loaded).
// "active" = status ACTIVE and within validFrom/validUntil window.
export function buildAuthContext(
  user: AuthContext["user"],
  assignments: AuthContext["assignments"],
): AuthContext {
  const now = new Date();
  const active = assignments.filter((a) => {
    if (a.status !== "ACTIVE") return false;
    if (a.validFrom && a.validFrom > now) return false;
    if (a.validUntil && a.validUntil < now) return false;
    return true;
  });

  const resolvedPermissions = new Set<string>();
  let globalScope = false;
  const siteSet = new Set<string>();
  for (const a of active) {
    for (const p of a.role.permissions) {
      // honor moduleScope restriction: if set, only permissions in that module apply.
      if (a.moduleScope && !p.key.startsWith(a.moduleScope + ".")) continue;
      resolvedPermissions.add(p.key);
    }
    if (a.siteId === null) {
      globalScope = true;
    } else {
      siteSet.add(a.siteId);
    }
  }

  return {
    user,
    assignments: active,
    resolvedPermissions,
    resolvedSites: globalScope ? "*" : siteSet,
  };
}

// Does the context grant a permission (optionally within a site scope)?
// If `targetSiteId` is provided, the user's assignment scope must cover it
// (global "*" or an explicit matching siteId).
export function can(
  ctx: AuthContext,
  permission: string,
  targetSiteId?: string | null,
): boolean {
  if (!ctx.resolvedPermissions.has(permission)) return false;
  if (targetSiteId === undefined || targetSiteId === null) {
    // No specific target site: permission check only (e.g., create-site, read catalog).
    return true;
  }
  if (ctx.resolvedSites === "*") return true;
  return ctx.resolvedSites.has(targetSiteId);
}

// Assert helper for services: throws ForbiddenError if not allowed.
import { ForbiddenError } from "./errors";
export function authorize(
  ctx: AuthContext,
  permission: string,
  targetSiteId?: string | null,
): void {
  if (!can(ctx, permission, targetSiteId)) {
    throw new ForbiddenError();
  }
}
