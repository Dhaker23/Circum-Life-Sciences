import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { GenealogyTreeSchema } from "@/modules/traceability/domain";
import * as svc from "@/modules/traceability/service";
export async function POST(req: NextRequest) {
  try { const ctx = await requirePermission("traceability.read"); const body = parseOrThrow(GenealogyTreeSchema, await req.json()); return ok(await svc.genealogyTree(ctx, body)); } catch (e) { return fail(e); }
}
