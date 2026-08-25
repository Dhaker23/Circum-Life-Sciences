import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import { CreateSpecificationSchema } from "@/modules/laboratory/domain";
import * as svc from "@/modules/laboratory/service";
export async function GET(req: NextRequest) {
  try { const ctx = await requirePermission("lab.specification.read"); const url = new URL(req.url); const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams)); const r = await svc.listSpecifications(ctx, page, pageSize); return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total }); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try { const ctx = await requirePermission("lab.specification.create"); const body = parseOrThrow(CreateSpecificationSchema, await req.json()); return ok(await svc.createSpecification(ctx, body)); } catch (e) { return fail(e); }
}
