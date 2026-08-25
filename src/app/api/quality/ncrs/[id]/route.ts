import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { NcrTransitionSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("quality.ncr.read");
    return ok(await svc.getNcr(ctx, id));
  } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("quality.ncr.transition");
    const body = parseOrThrow(NcrTransitionSchema, await req.json());
    return ok(await svc.transitionNcr(ctx, id, body));
  } catch (e) { return fail(e); }
}
