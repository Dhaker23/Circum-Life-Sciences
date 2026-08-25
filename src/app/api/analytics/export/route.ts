import { NextRequest, NextResponse } from "next/server";
import { fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { ExportQuerySchema } from "@/modules/analytics/domain";
import * as svc from "@/modules/analytics/service";
export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("analytics.export");
    const body = parseOrThrow(ExportQuerySchema, await req.json());
    const { csv, filename } = await svc.exportReportCsv(ctx, body);
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (e) { return fail(e); }
}
