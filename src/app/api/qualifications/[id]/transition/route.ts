import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { QualTransitionSchema } from "@/modules/equipment/domain";
import * as svc from "@/modules/equipment/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const ctx = await requirePermission("equipment.qualification.transition"); const body = parseOrThrow(QualTransitionSchema, await req.json()); return ok(await svc.transitionQualification(ctx, id, body)); } catch (e) { return fail(e); } }
