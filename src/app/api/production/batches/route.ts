import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import * as svc from "@/modules/production/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("production.batch.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const filters = { status: url.searchParams.get("status") ?? undefined, workOrderId: url.searchParams.get("workOrderId") ?? undefined, siteId: url.searchParams.get("siteId") ?? undefined };
    const r = await svc.listBatches(ctx, page, pageSize, filters);
    return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
  } catch (e) { return fail(e); }
}
