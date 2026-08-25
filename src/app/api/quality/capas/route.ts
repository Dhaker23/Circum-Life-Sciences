import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import { CreateCapaSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("quality.capa.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const r = await svc.listCapas(ctx, page, pageSize);
    return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
  } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("quality.capa.create");
    const body = parseOrThrow(CreateCapaSchema, await req.json());
    return ok(await svc.createCapa(ctx, body));
  } catch (e) { return fail(e); }
}
