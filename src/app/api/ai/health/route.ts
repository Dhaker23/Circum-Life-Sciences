import { ok, fail } from "@/lib/api-envelope";
import * as svc from "@/modules/ai/service";
export async function GET() {
  try { return ok(await svc.checkHealth()); } catch (e) { return fail(e); }
}
