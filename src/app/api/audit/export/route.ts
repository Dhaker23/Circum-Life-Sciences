import { NextRequest } from "next/server";
import { fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { AuditQuerySchema } from "@/lib/zod-schemas";
import * as auditService from "@/modules/audit/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("audit.export");
    const url = new URL(req.url);
    const q = parseOrThrow(AuditQuerySchema, Object.fromEntries(url.searchParams));
    const csv = await auditService.exportAuditEvents(ctx, q);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="circum-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
