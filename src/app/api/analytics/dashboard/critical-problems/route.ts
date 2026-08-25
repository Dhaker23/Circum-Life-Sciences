import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CriticalQuerySchema } from "@/modules/analytics/domain";
import * as svc from "@/modules/analytics/service";
export async function POST(req: NextRequest) {
  try { const ctx = await requirePermission("analytics.read"); const body = parseOrThrow(CriticalQuerySchema, await req.json()); return ok(await svc.getCriticalProblemsDashboard(ctx, body)); } catch (e) { return fail(e); }
}
