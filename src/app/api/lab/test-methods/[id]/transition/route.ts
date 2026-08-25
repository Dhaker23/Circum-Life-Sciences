import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { MethodTransitionSchema } from "@/modules/laboratory/domain";
import * as svc from "@/modules/laboratory/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const ctx = await requirePermission("lab.testmethod.transition"); const body = parseOrThrow(MethodTransitionSchema, await req.json()); return ok(await svc.transitionTestMethod(ctx, id, body)); } catch (e) { return fail(e); }
}
