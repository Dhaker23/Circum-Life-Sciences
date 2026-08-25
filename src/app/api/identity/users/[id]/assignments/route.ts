import { NextRequest } from "next/server";
import { ok, fail, noContent, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateAssignmentSchema } from "@/lib/zod-schemas";
import * as identityService from "@/modules/identity/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = parseOrThrow(CreateAssignmentSchema, await req.json());
    if (body.userId !== id) {
      const { ValidationError } = await import("@/lib/errors");
      throw new ValidationError("userId in body must match the path");
    }
    const ctx = await requirePermission("identity.assignment.create", body.siteId ?? null);
    return ok(await identityService.createAssignment(ctx, body));
  } catch (e) {
    return fail(e);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("identity.assignment.read");
    const { db } = await import("@/lib/db");
    const assignments = await db.assignment.findMany({
      where: { userId: id },
      include: {
        role: { select: { id: true, systemKey: true, name: true } },
        site: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
      },
    });
    return ok(assignments);
  } catch (e) {
    return fail(e);
  }
}
