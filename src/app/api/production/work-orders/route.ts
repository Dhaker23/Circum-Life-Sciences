import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import { CreateWorkOrderSchema } from "@/modules/production/domain";
import * as svc from "@/modules/production/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("production.workorder.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const filters = { status: url.searchParams.get("status") ?? undefined, siteId: url.searchParams.get("siteId") ?? undefined };
    const r = await svc.listWorkOrders(ctx, page, pageSize, filters);
    return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("production.workorder.create");
    const body = parseOrThrow(CreateWorkOrderSchema, await req.json());
    return ok(await svc.createWorkOrder(ctx, body));
  } catch (e) { return fail(e); }
}
