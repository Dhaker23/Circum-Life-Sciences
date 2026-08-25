import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateRiskSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("quality.risk.update");
    const body = parseOrThrow(UpdateRiskSchema, await req.json());
    return ok(await svc.updateRisk(ctx, id, body));
  } catch (e) { return fail(e); }
}
