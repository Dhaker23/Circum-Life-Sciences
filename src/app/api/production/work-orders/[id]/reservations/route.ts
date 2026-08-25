import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateReservationSchema } from "@/modules/production/domain";
import * as svc from "@/modules/production/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("production.reservation.create");
    const body = parseOrThrow(CreateReservationSchema, await req.json());
    return ok(await svc.createReservation(ctx, id, body));
  } catch (e) { return fail(e); }
}
