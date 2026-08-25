import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import { CreateMaterialLotSchema } from "@/modules/manufacturing/domain";
import * as svc from "@/modules/manufacturing/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("manufacturing.materiallot.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const filters = {
      materialId: url.searchParams.get("materialId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      siteId: url.searchParams.get("siteId") ?? undefined,
    };
    const r = await svc.listMaterialLots(ctx, page, pageSize, filters);
    return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("manufacturing.materiallot.create");
    const body = parseOrThrow(CreateMaterialLotSchema, await req.json());
    return ok(await svc.createMaterialLot(ctx, body));
  } catch (e) {
    return fail(e);
  }
}
