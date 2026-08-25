import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { InspectionTransitionSchema } from "@/modules/laboratory/domain";
import * as svc from "@/modules/laboratory/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const ctx = await requirePermission("inspection.transition"); const body = parseOrThrow(InspectionTransitionSchema, await req.json()); return ok(await svc.transitionInspection(ctx, id, body)); } catch (e) { return fail(e); }
}
