import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import * as svc from "@/modules/ai/service";
export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("ai.history.read");
    const url = new URL(req.url);
    const fromDate = new Date(url.searchParams.get("fromDate") ?? new Date(Date.now() - 30 * 86400000).toISOString());
    const toDate = new Date(url.searchParams.get("toDate") ?? new Date().toISOString());
    return ok(await svc.getUsageSummary(ctx, fromDate, toDate));
  } catch (e) { return fail(e); }
}
