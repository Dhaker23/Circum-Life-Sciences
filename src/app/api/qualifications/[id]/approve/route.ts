import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { z } from "zod";
import * as svc from "@/modules/equipment/service";
const ApproveSchema = z.object({ reason: z.string().min(1).max(500) });
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const ctx = await requirePermission("equipment.qualification.approve"); const body = parseOrThrow(ApproveSchema, await req.json()); return ok(await svc.approveQualification(ctx, id, body.reason)); } catch (e) { return fail(e); } }
