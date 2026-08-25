import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { MaintTransitionSchema } from "@/modules/equipment/domain";
import * as svc from "@/modules/equipment/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const ctx = await requirePermission("equipment.maintenance.transition"); const body = parseOrThrow(MaintTransitionSchema, await req.json()); return ok(await svc.transitionMaintenance(ctx, id, body)); } catch (e) { return fail(e); } }
