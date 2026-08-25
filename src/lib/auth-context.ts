// Build the AuthContext for the current request from the next-auth session.
// This is the server-side entry point used by API routes + middleware to enforce RBAC.
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { db } from "./db";
import { buildAuthContext, type AuthContext } from "./rbac";
import { UnauthorizedError } from "./errors";
import { audit } from "./audit";

// Get the AuthContext for the current request, or null if not authenticated.
export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user?.email || !userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, preferredLocale: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;

  const assignments = await db.assignment.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      role: {
        include: {
          permissions: { include: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  // Normalize to the AuthContext shape: role.permissions = [{ key }] (from the join's permission).
  const normalized = assignments.map((a) => ({
    id: a.id,
    siteId: a.siteId,
    departmentId: a.departmentId,
    moduleScope: a.moduleScope,
    status: a.status,
    validFrom: a.validFrom,
    validUntil: a.validUntil,
    role: {
      id: a.role.id,
      systemKey: a.role.systemKey,
      permissions: a.role.permissions.map((rp) => ({ key: rp.permission.key })),
    },
  }));

  return buildAuthContext(user, normalized as unknown as AuthContext["assignments"]);
}

// Require an authenticated AuthContext; throws UnauthorizedError otherwise.
export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

// Require a permission (optionally scoped to a target site). Throws ForbiddenError + audits denial.
export async function requirePermission(
  permission: string,
  targetSiteId?: string | null,
): Promise<AuthContext> {
  const ctx = await requireAuthContext();
  const { can } = await import("./rbac");
  if (!can(ctx, permission, targetSiteId)) {
    await audit({
      actorUserId: ctx.user.id,
      action: "authorization.denied",
      entityType: "Permission",
      entityId: permission,
      outcome: "DENIED",
      reason: `Denied ${permission}${targetSiteId ? ` on site ${targetSiteId}` : ""}`,
    });
    const { ForbiddenError } = await import("./errors");
    throw new ForbiddenError();
  }
  return ctx;
}
