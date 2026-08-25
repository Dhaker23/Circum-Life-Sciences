import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateWorkCenterSchema } from "@/modules/production/domain";
import * as svc from "@/modules/production/service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("production.workcenter.update");
    const body = parseOrThrow(UpdateWorkCenterSchema, await req.json());
    return ok(await svc.updateWorkCenter(ctx, id, body));
  } catch (e) { return fail(e); }
}
