import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateOperationExecutionSchema } from "@/modules/production/domain";
import * as svc from "@/modules/production/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("production.execution.create");
    const body = parseOrThrow(CreateOperationExecutionSchema, await req.json());
    return ok(await svc.createExecution(ctx, id, body));
  } catch (e) { return fail(e); }
}
