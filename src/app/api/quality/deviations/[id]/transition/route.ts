import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { DeviationTransitionSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = parseOrThrow(DeviationTransitionSchema, await req.json());
    const ctx = await requirePermission("quality.deviation.transition");
    return ok(await svc.transitionDeviation(ctx, id, body));
  } catch (e) { return fail(e); }
}
