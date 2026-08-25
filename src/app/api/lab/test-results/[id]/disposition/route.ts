import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { DispositionSchema } from "@/modules/laboratory/domain";
import * as svc from "@/modules/laboratory/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const { id } = await params; const ctx = await requirePermission("lab.testresult.disposition"); const body = parseOrThrow(DispositionSchema, await req.json()); return ok(await svc.dispositionTestResult(ctx, id, body)); } catch (e) { return fail(e); }
}
