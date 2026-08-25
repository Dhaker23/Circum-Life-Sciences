import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateBOMLineSchema } from "@/modules/manufacturing/domain";
import * as svc from "@/modules/manufacturing/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.bom.update");
    const body = parseOrThrow(CreateBOMLineSchema, await req.json());
    return ok(await svc.addBomLine(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}
