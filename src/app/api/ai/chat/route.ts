import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { ChatRequestSchema } from "@/modules/ai/domain";
import * as svc from "@/modules/ai/service";
export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("ai.chat");
    const body = parseOrThrow(ChatRequestSchema, await req.json());
    return ok(await svc.chat(ctx, body));
  } catch (e) { return fail(e); }
}
