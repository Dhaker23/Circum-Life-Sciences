import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import * as svc from "@/modules/integration/service";
export async function GET() {
  try { const ctx = await requirePermission("integration.read"); return ok(await svc.getIntegrationHealth(ctx)); } catch (e) { return fail(e); }
}
