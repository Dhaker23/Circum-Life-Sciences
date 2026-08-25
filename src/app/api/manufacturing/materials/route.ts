import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import { CreateMaterialSchema } from "@/modules/manufacturing/domain";
import * as svc from "@/modules/manufacturing/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("manufacturing.material.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const filters = {
      materialType: url.searchParams.get("materialType") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    };
    const r = await svc.listMaterials(ctx, page, pageSize, filters);
    return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("manufacturing.material.create");
    const body = parseOrThrow(CreateMaterialSchema, await req.json());
    return ok(await svc.createMaterial(ctx, body));
  } catch (e) {
    return fail(e);
  }
}
