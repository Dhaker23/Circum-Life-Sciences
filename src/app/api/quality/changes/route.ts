import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateChangeSchema } from "@/modules/quality/domain";
import * as svc from "@/modules/quality/service";

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("quality.change.create");
    const body = parseOrThrow(CreateChangeSchema, await req.json());
    return ok(await svc.createChange(ctx, body));
  } catch (e) { return fail(e); }
}
