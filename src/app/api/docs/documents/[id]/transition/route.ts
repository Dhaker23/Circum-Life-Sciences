import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { DocTransitionSchema } from "@/modules/docs/domain";
import * as svc from "@/modules/docs/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const ctx = await requirePermission("docs.document.transition"); const body = parseOrThrow(DocTransitionSchema, await req.json()); return ok(await svc.transitionDocument(ctx, id, body)); } catch (e) { return fail(e); } }
