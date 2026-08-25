import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import * as svc from "@/modules/analytics/service";
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await requirePermission("analytics.read"); const { id } = await params; return ok(await svc.getVsmView(ctx, id)); } catch (e) { return fail(e); }
}
