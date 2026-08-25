import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateSupplierSchema } from "@/modules/manufacturing/domain";
import * as svc from "@/modules/manufacturing/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.supplier.read");
    return ok(await svc.getSupplier(ctx, id));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.supplier.update");
    const body = parseOrThrow(UpdateSupplierSchema, await req.json());
    return ok(await svc.updateSupplier(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}
