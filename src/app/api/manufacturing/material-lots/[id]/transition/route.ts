import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { MaterialLotTransitionSchema } from "@/modules/manufacturing/domain";
import * as svc from "@/modules/manufacturing/service";

// Explicit /transition endpoint for D3 lifecycle transitions (audited).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.materiallot.transition");
    const body = parseOrThrow(MaterialLotTransitionSchema, await req.json());
    return ok(await svc.transitionMaterialLot(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}
