import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateMaterialSchema, LinkMaterialSupplierSchema } from "@/modules/manufacturing/domain";
import * as svc from "@/modules/manufacturing/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.material.read");
    return ok(await svc.getMaterial(ctx, id));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.material.update");
    const body = parseOrThrow(UpdateMaterialSchema, await req.json());
    return ok(await svc.updateMaterial(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("manufacturing.materialsupplier.update");
    const body = parseOrThrow(LinkMaterialSupplierSchema, await req.json());
    return ok(await svc.linkMaterialSupplier(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}
