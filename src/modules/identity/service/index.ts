// Identity service: user + role + assignment operations. Enforces RBAC (can) + audit + multi-site scope.
// PRD §10/§11: critical logic in the service layer, not the UI.
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth.password";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess, siteIdFilter } from "@/lib/site-scope";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  StateTransitionError,
  ValidationError,
} from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";

// --- Users ---

export async function listUsers(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "identity.user.read")) throw new ForbiddenError();
  // Site-scoped: a non-global user only sees users who have an assignment in their resolved sites.
  const where =
    ctx.resolvedSites === "*"
      ? {}
      : { assignments: { some: { siteId: { in: [...ctx.resolvedSites] } } } };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        preferredLocale: true,
        lastSignInAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getUser(ctx: AuthContext, id: string) {
  if (!can(ctx, "identity.user.read")) throw new ForbiddenError();
  const user = await db.user.findUnique({
    where: { id },
    include: {
      assignments: {
        include: {
          role: { select: { id: true, systemKey: true, name: true } },
          site: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });
  if (!user) throw new NotFoundError("User");
  // Enforce scope: if user has assignments, at least one must be in the caller's sites (unless global).
  if (ctx.resolvedSites !== "*") {
    const sites = ctx.resolvedSites;
    const inScope = user.assignments.some(
      (a) => a.siteId === null || sites.has(a.siteId),
    );
    if (!inScope) throw new ForbiddenError("User is outside your site scope");
  }
  return user;
}

export async function createUser(
  ctx: AuthContext,
  input: {
    email: string;
    name: string;
    password: string;
    preferredLocale?: string;
    siteId?: string | null;
  },
) {
  if (!can(ctx, "identity.user.create", input.siteId ?? null)) throw new ForbiddenError();
  if (input.siteId) assertSiteAccess(ctx, input.siteId);

  const existing = await db.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw new ConflictError("Email already registered");

  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash,
      preferredLocale: input.preferredLocale ?? "en",
    },
    select: { id: true, email: true, name: true, status: true, preferredLocale: true, createdAt: true },
  });
  await audit({
    actorUserId: ctx.user.id,
    action: "identity.user.create",
    entityType: "User",
    entityId: user.id,
    newState: { email: user.email, name: user.name },
  });
  return user;
}

export async function updateUser(
  ctx: AuthContext,
  id: string,
  input: { name?: string; preferredLocale?: string; status?: string },
) {
  if (!can(ctx, "identity.user.update")) throw new ForbiddenError();
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("User");
  // scope check
  if (ctx.resolvedSites !== "*") {
    const sites = ctx.resolvedSites;
    const assignments = await db.assignment.findMany({ where: { userId: id }, select: { siteId: true } });
    const inScope = assignments.some((a) => a.siteId === null || sites.has(a.siteId));
    if (!inScope) throw new ForbiddenError("User is outside your site scope");
  }
  if (input.status && !["ACTIVE", "LOCKED", "DISABLED"].includes(input.status)) {
    throw new ValidationError("Invalid status");
  }
  const updated = await db.user.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.preferredLocale ? { preferredLocale: input.preferredLocale } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    select: { id: true, email: true, name: true, status: true, preferredLocale: true },
  });
  await audit({
    actorUserId: ctx.user.id,
    action: "identity.user.update",
    entityType: "User",
    entityId: id,
    previousState: { name: existing.name, status: existing.status, preferredLocale: existing.preferredLocale },
    newState: updated,
  });
  return updated;
}

export async function disableUser(ctx: AuthContext, id: string) {
  if (!can(ctx, "identity.user.disable")) throw new ForbiddenError();
  const existing = await db.user.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw new NotFoundError("User");
  if (existing.status === "DISABLED") throw new StateTransitionError("User already disabled");
  // Revoke all sessions.
  await db.session.deleteMany({ where: { userId: id } });
  const updated = await db.user.update({ where: { id }, data: { status: "DISABLED" }, select: { id: true, status: true } });
  await audit({
    actorUserId: ctx.user.id,
    action: "identity.user.disable",
    entityType: "User",
    entityId: id,
    previousState: { status: existing.status },
    newState: { status: "DISABLED" },
    reason: "User disabled",
  });
  return updated;
}

export async function resetPassword(ctx: AuthContext, id: string, newPassword: string) {
  if (!can(ctx, "identity.user.reset-password")) throw new ForbiddenError();
  if (newPassword.length < 8) throw new ValidationError("Password must be at least 8 characters");
  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id }, data: { passwordHash, failedAttempts: 0, lockedUntil: null } });
  // Revoke sessions on password reset.
  await db.session.deleteMany({ where: { userId: id } });
  await audit({
    actorUserId: ctx.user.id,
    action: "identity.user.reset-password",
    entityType: "User",
    entityId: id,
    outcome: "SUCCESS",
    reason: "Password reset by administrator",
  });
  return { id };
}

// --- Roles & permissions (read) ---

export async function listRoles(ctx: AuthContext) {
  if (!can(ctx, "identity.role.read")) throw new ForbiddenError();
  return db.role.findMany({
    where: { status: "ACTIVE" },
    include: { permissions: { include: { permission: { select: { key: true, module: true } } } } },
    orderBy: { name: "asc" },
  });
}

export async function listPermissions(ctx: AuthContext) {
  if (!can(ctx, "identity.role.read")) throw new ForbiddenError();
  return db.permission.findMany({ orderBy: { key: "asc" } });
}

// --- Assignments ---

export async function createAssignment(
  ctx: AuthContext,
  input: { userId: string; roleId: string; siteId?: string | null; departmentId?: string | null; moduleScope?: string | null },
) {
  if (!can(ctx, "identity.assignment.create", input.siteId ?? null)) throw new ForbiddenError();
  // Super-admin global-scope guard: siteId IS NULL requires super_admin role (ADR-0004).
  if (input.siteId === null || input.siteId === undefined) {
    const isSuperAdmin = ctx.assignments.some((a) => a.role.systemKey === "super_admin");
    if (!isSuperAdmin) {
      throw new ForbiddenError("Only Super Administrator may grant global-scope assignments");
    }
  }
  if (input.siteId) assertSiteAccess(ctx, input.siteId);

  const user = await db.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new NotFoundError("User");
  const role = await db.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new NotFoundError("Role");

  try {
    const assignment = await db.assignment.create({
      data: {
        userId: input.userId,
        roleId: input.roleId,
        siteId: input.siteId ?? null,
        departmentId: input.departmentId ?? null,
        moduleScope: input.moduleScope ?? null,
        status: "ACTIVE",
      },
    });
    await audit({
      actorUserId: ctx.user.id,
      action: "identity.assignment.create",
      entityType: "Assignment",
      entityId: assignment.id,
      newState: { userId: input.userId, roleId: input.roleId, siteId: input.siteId ?? null, departmentId: input.departmentId ?? null },
    });
    return assignment;
  } catch (e) {
    throw new ConflictError("Assignment already exists");
  }
}

export async function deleteAssignment(ctx: AuthContext, assignmentId: string) {
  if (!can(ctx, "identity.assignment.delete")) throw new ForbiddenError();
  const existing = await db.assignment.findUnique({ where: { id: assignmentId } });
  if (!existing) throw new NotFoundError("Assignment");
  if (existing.siteId) assertSiteAccess(ctx, existing.siteId);
  await db.assignment.delete({ where: { id: assignmentId } });
  await audit({
    actorUserId: ctx.user.id,
    action: "identity.assignment.delete",
    entityType: "Assignment",
    entityId: assignmentId,
    previousState: { userId: existing.userId, roleId: existing.roleId, siteId: existing.siteId },
  });
  return { id: assignmentId };
}
