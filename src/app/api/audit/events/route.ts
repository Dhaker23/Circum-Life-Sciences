import { NextRequest, NextResponse } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { AuditQuerySchema } from "@/lib/zod-schemas";
import * as auditService from "@/modules/audit/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("audit.read");
    const url = new URL(req.url);
    const q = parseOrThrow(AuditQuerySchema, Object.fromEntries(url.searchParams));
    const result = await auditService.listAuditEvents(ctx, q);
    return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (e) {
    return fail(e);
  }
}
