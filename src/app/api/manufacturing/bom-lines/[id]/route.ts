import { NextRequest } from "next/server";
import { ok, fail, noContent, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateBOMLineSchema } from "@/modules/manufacturing/domain";
import * as svc from "@/modules/manufacturing/service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.bom.update");
    const body = parseOrThrow(UpdateBOMLineSchema, await req.json());
    return ok(await svc.updateBomLine(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.bom.update");
    await svc.deleteBomLine(ctx, id);
    return noContent();
  } catch (e) {
    return fail(e);
  }
}
