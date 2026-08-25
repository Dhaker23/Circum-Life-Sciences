import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { BackwardTraceSchema } from "@/modules/traceability/domain";
import * as svc from "@/modules/traceability/service";
export async function POST(req: NextRequest) {
  try { const ctx = await requirePermission("traceability.read"); const body = parseOrThrow(BackwardTraceSchema, await req.json()); return ok(await svc.backwardTrace(ctx, body)); } catch (e) { return fail(e); }
}
