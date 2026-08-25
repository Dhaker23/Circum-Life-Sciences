import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateDeviceLotSchema } from "@/modules/production/domain";
import * as svc from "@/modules/production/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("production.devicelot.read");
    return ok(await svc.listDeviceLots(ctx, id));
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("production.devicelot.create");
    const body = parseOrThrow(CreateDeviceLotSchema, await req.json());
    return ok(await svc.createDeviceLot(ctx, id, body));
  } catch (e) { return fail(e); }
}
