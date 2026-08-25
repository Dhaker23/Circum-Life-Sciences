import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateEquipmentSchema } from "@/modules/equipment/domain";
import * as svc from "@/modules/equipment/service";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const ctx = await requirePermission("equipment.update"); const body = parseOrThrow(UpdateEquipmentSchema, await req.json()); return ok(await svc.updateEquipment(ctx, id, body)); } catch (e) { return fail(e); } }
