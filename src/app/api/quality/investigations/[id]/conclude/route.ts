import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { ConcludeInvestigationSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("quality.investigation.conclude");
    const body = parseOrThrow(ConcludeInvestigationSchema, await req.json());
    return ok(await svc.concludeInvestigation(ctx, id, body));
  } catch (e) { return fail(e); }
}
