import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CorporateQuerySchema } from "@/modules/analytics/domain";
import * as svc from "@/modules/analytics/service";
export async function POST(req: NextRequest) {
  try { const ctx = await requirePermission("analytics.corporate.read"); const body = parseOrThrow(CorporateQuerySchema, await req.json()); return ok(await svc.getCorporateSummary(ctx, body)); } catch (e) { return fail(e); }
}
