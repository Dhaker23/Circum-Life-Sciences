import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { BatchTransitionSchema } from "@/modules/production/domain";
import * as svc from "@/modules/production/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("production.batch.read");
    return ok(await svc.getBatch(ctx, id));
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("production.batch.transition");
    const body = parseOrThrow(BatchTransitionSchema, await req.json());
    return ok(await svc.transitionBatch(ctx, id, body));
  } catch (e) { return fail(e); }
}
