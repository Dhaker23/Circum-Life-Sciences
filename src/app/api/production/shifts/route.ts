import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateShiftSchema } from "@/modules/production/domain";
import * as svc from "@/modules/production/service";

export async function GET(_req: NextRequest) {
  try {
    const ctx = await requirePermission("production.shift.read");
    return ok(await svc.listShifts(ctx));
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("production.shift.create");
    const body = parseOrThrow(CreateShiftSchema, await req.json());
    return ok(await svc.createShift(ctx, body));
  } catch (e) { return fail(e); }
}
