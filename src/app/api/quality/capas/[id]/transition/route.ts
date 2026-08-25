import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CapaTransitionSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("quality.capa.transition");
    const body = parseOrThrow(CapaTransitionSchema, await req.json());
    return ok(await svc.transitionCapa(ctx, id, body));
  } catch (e) { return fail(e); }
}
