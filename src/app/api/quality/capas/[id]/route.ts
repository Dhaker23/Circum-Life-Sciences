import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import * as svc from "@/modules/quality/service";

// CAPA detail (used by QuickViewDrawer on the list page).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("quality.capa.read");
    return ok(await svc.getCapa(ctx, id));
  } catch (e) { return fail(e); }
}
