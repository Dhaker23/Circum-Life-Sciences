import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { EquipmentPerfQuerySchema } from "@/modules/analytics/domain";
import * as svc from "@/modules/analytics/service";
export async function POST(req: NextRequest) {
  try { const ctx = await requirePermission("analytics.read"); const body = parseOrThrow(EquipmentPerfQuerySchema, await req.json()); return ok(await svc.getEquipmentPerformanceReport(ctx, body)); } catch (e) { return fail(e); }
}
