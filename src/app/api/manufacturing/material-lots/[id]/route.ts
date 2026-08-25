import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateMaterialLotSchema, MaterialLotTransitionSchema } from "@/modules/manufacturing/domain";
import * as svc from "@/modules/manufacturing/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.materiallot.read");
    return ok(await svc.getMaterialLot(ctx, id));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.materiallot.update");
    const body = parseOrThrow(UpdateMaterialLotSchema, await req.json());
    return ok(await svc.updateMaterialLot(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // /transition endpoint: explicit, validated, audited state change (D3).
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.materiallot.transition");
    const body = parseOrThrow(MaterialLotTransitionSchema, await req.json());
    return ok(await svc.transitionMaterialLot(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}
