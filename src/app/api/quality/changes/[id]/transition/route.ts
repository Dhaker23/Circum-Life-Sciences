import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { ChangeTransitionSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("quality.change.transition");
    const body = parseOrThrow(ChangeTransitionSchema, await req.json());
    return ok(await svc.transitionChange(ctx, id, body));
  } catch (e) { return fail(e); }
}
