import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import * as svc from "@/modules/manufacturing/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.bom.read");
    return ok(await svc.getBom(ctx, id));
  } catch (e) {
    return fail(e);
  }
}
