// Organization service: sites + departments. Enforces RBAC + audit + multi-site scope.
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess, siteIdFilter } from "@/lib/site-scope";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";

// --- Sites ---

export async function listSites(ctx: AuthContext) {
  if (!can(ctx, "org.site.read")) throw new ForbiddenError();
  return db.site.findMany({
    where: siteIdFilter(ctx) as { status?: string; siteId?: { in: string[] } },
    orderBy: { code: "asc" },
    include: { _count: { select: { departments: true, employees: true } } },
  });
}

export async function getSite(ctx: AuthContext, id: string) {
  if (!can(ctx, "org.site.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, id);
  const site = await db.site.findUnique({ where: { id } });
  if (!site) throw new NotFoundError("Site");
  return site;
}

export async function createSite(
  ctx: AuthContext,
  input: { code: string; name: string; address?: string; timezone?: string },
) {
  if (!can(ctx, "org.site.create")) throw new ForbiddenError();
  const existing = await db.site.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("Site code already exists");
  const site = await db.site.create({
    data: { code: input.code, name: input.name, address: input.address, timezone: input.timezone ?? "Africa/Lagos", isDemo: false, status: "ACTIVE" },
  });
  await audit({
    actorUserId: ctx.user.id,
    action: "org.site.create",
    entityType: "Site",
    entityId: site.id,
    newState: { code: site.code, name: site.name },
  });
  return site;
}

export async function updateSite(
  ctx: AuthContext,
  id: string,
  input: { name?: string; address?: string; timezone?: string; status?: string },
) {
  if (!can(ctx, "org.site.update")) throw new ForbiddenError();
  assertSiteAccess(ctx, id);
  const existing = await db.site.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Site");
  const updated = await db.site.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
  });
  await audit({
    actorUserId: ctx.user.id,
    action: "org.site.update",
    entityType: "Site",
    entityId: id,
    previousState: { name: existing.name, status: existing.status },
    newState: { name: updated.name, status: updated.status },
  });
  return updated;
}

// --- Departments ---

export async function listDepartments(ctx: AuthContext, siteId?: string) {
  if (!can(ctx, "org.department.read")) throw new ForbiddenError();
  if (siteId) assertSiteAccess(ctx, siteId);
  const where = {
    ...(siteId ? { siteId } : {}),
    ...(ctx.resolvedSites !== "*" ? { siteId: { in: [...ctx.resolvedSites] } } : {}),
  };
  return db.department.findMany({
    where,
    orderBy: [{ siteId: "asc" }, { code: "asc" }],
    include: { site: { select: { code: true, name: true } } },
  });
}

export async function createDepartment(
  ctx: AuthContext,
  input: { siteId: string; code: string; name: string },
) {
  if (!can(ctx, "org.department.create", input.siteId)) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);
  const site = await db.site.findUnique({ where: { id: input.siteId } });
  if (!site) throw new NotFoundError("Site");
  try {
    const dept = await db.department.create({
      data: { siteId: input.siteId, code: input.code, name: input.name, isDemo: false, status: "ACTIVE" },
    });
    await audit({
      actorUserId: ctx.user.id,
      action: "org.department.create",
      entityType: "Department",
      entityId: dept.id,
      newState: { siteId: input.siteId, code: dept.code, name: dept.name },
    });
    return dept;
  } catch {
    throw new ConflictError("Department code already exists for this site");
  }
}
