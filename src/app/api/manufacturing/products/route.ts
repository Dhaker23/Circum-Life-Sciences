import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import * as svc from "@/modules/manufacturing/service";
import { CreateProductSchema } from "@/modules/manufacturing/domain";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("manufacturing.product.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const filters = {
      productType: url.searchParams.get("productType") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    };
    const r = await svc.listProducts(ctx, page, pageSize, filters);
    return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("manufacturing.product.create");
    const body = parseOrThrow(CreateProductSchema, await req.json());
    return ok(await svc.createProduct(ctx, body));
  } catch (e) {
    return fail(e);
  }
}
