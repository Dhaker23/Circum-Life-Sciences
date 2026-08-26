import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateRiskSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("quality.risk.create");
    const body = parseOrThrow(CreateRiskSchema, await req.json());
    return ok(await svc.createRisk(ctx, body));
  } catch (e) { return fail(e); }
}
