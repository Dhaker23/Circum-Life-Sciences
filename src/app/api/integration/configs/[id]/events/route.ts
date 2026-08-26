import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import * as svc from "@/modules/integration/service";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await requirePermission("integration.read"); const { id } = await params; const url = new URL(req.url); const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams)); const r = await svc.listEvents(ctx, id, page, pageSize); return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total }); } catch (e) { return fail(e); }
}
