import { NextRequest } from "next/server";
import { ok, fail, noContent } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import * as identityService from "@/modules/identity/service";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("identity.assignment.delete");
    await identityService.deleteAssignment(ctx, id);
    return noContent();
  } catch (e) {
    return fail(e);
  }
}
