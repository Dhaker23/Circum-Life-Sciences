import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import * as svc from "@/modules/production/service";
import { CreateWorkCenterSchema } from "@/modules/production/domain";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("production.workcenter.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const r = await svc.listWorkCenters(ctx, page, pageSize);
    return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
  } catch (e) { return fail(e); }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("production.workcenter.create");
    const body = parseOrThrow(CreateWorkCenterSchema, await req.json());
    return ok(await svc.createWorkCenter(ctx, body));
  } catch (e) { return fail(e); }
}
