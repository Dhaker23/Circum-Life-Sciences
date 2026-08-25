import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import { CreateSupplierSchema } from "@/modules/manufacturing/domain";
import * as svc from "@/modules/manufacturing/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("manufacturing.supplier.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const r = await svc.listSuppliers(ctx, page, pageSize);
    return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("manufacturing.supplier.create");
    const body = parseOrThrow(CreateSupplierSchema, await req.json());
    return ok(await svc.createSupplier(ctx, body));
  } catch (e) {
    return fail(e);
  }
}
