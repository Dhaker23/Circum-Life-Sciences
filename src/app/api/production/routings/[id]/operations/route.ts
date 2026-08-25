import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateOperationSchema } from "@/modules/production/domain";
import * as svc from "@/modules/production/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("production.routing.update");
    const body = parseOrThrow(CreateOperationSchema, await req.json());
    return ok(await svc.addOperation(ctx, id, body));
  } catch (e) { return fail(e); }
}
