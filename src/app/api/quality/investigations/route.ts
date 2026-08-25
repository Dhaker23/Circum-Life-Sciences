import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateInvestigationSchema, ConcludeInvestigationSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";
import { z } from "zod";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("quality.investigation.create");
    const body = parseOrThrow(CreateInvestigationSchema, await req.json());
    return ok(await svc.createInvestigation(ctx, body));
  } catch (e) { return fail(e); }
}
