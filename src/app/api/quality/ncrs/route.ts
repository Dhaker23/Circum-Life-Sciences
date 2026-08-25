import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import { CreateNcrSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("quality.ncr.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const r = await svc.listNcrs(ctx, page, pageSize);
    return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
  } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("quality.ncr.create");
    const body = parseOrThrow(CreateNcrSchema, await req.json());
    return ok(await svc.createNcr(ctx, body));
  } catch (e) { return fail(e); }
}
