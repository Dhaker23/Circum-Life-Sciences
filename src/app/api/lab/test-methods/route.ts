import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import { CreateTestMethodSchema } from "@/modules/laboratory/domain";
import * as svc from "@/modules/laboratory/service";
export async function GET(req: NextRequest) {
  try { const ctx = await requirePermission("lab.testmethod.read"); const url = new URL(req.url); const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams)); const r = await svc.listTestMethods(ctx, page, pageSize); return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total }); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try { const ctx = await requirePermission("lab.testmethod.create"); const body = parseOrThrow(CreateTestMethodSchema, await req.json()); return ok(await svc.createTestMethod(ctx, body)); } catch (e) { return fail(e); }
}
