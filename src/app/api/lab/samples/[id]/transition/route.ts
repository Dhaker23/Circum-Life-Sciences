import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { SampleTransitionSchema } from "@/modules/laboratory/domain";
import * as svc from "@/modules/laboratory/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const ctx = await requirePermission("lab.sample.transition"); const body = parseOrThrow(SampleTransitionSchema, await req.json()); return ok(await svc.transitionSample(ctx, id, body)); } catch (e) { return fail(e); }
}
