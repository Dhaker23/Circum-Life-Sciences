import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateUserSchema } from "@/lib/zod-schemas";
import * as identityService from "@/modules/identity/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("identity.user.read");
    const { id } = await params;
    return ok(await identityService.getUser(ctx, id));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requirePermission("identity.user.update");
    const { id } = await params;
    const body = parseOrThrow(UpdateUserSchema, await req.json());
    return ok(await identityService.updateUser(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // DELETE disables the user (controlled record; never hard-delete identity, PRD §10).
  try {
    const ctx = await requirePermission("identity.user.disable");
    const { id } = await params;
    return ok(await identityService.disableUser(ctx, id));
  } catch (e) {
    return fail(e);
  }
}
