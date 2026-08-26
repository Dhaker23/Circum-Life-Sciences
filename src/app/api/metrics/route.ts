import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { getMetrics } from "@/lib/metrics";
export async function GET() {
  try { await requirePermission("audit.read"); return ok(getMetrics()); } catch (e) { return fail(e); }
}
