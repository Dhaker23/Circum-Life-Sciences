import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import * as svc from "@/modules/integration/service";
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await requirePermission("integration.sync"); const { id } = await params; return ok(await svc.triggerSync(ctx, id)); } catch (e) { return fail(e); }
}
