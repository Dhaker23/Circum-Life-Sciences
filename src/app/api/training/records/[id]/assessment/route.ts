import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateAssessmentSchema } from "@/modules/training/domain";
import * as svc from "@/modules/training/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const ctx = await requirePermission("training.assessment.create"); const body = parseOrThrow(CreateAssessmentSchema, await req.json()); return ok(await svc.createAssessment(ctx, id, body)); } catch (e) { return fail(e); } }
