import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { DeviceLotTransitionSchema } from "@/modules/production/domain";
import * as svc from "@/modules/production/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("production.devicelot.transition");
    const body = parseOrThrow(DeviceLotTransitionSchema, await req.json());
    return ok(await svc.transitionDeviceLot(ctx, id, body));
  } catch (e) { return fail(e); }
}
