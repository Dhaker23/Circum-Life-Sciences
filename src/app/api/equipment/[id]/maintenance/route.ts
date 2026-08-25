import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateMaintenanceSchema } from "@/modules/equipment/domain";
import * as svc from "@/modules/equipment/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const ctx = await requirePermission("equipment.maintenance.create"); const body = parseOrThrow(CreateMaintenanceSchema, await req.json()); if (body.equipmentId !== id) { const { ValidationError } = await import("@/lib/errors"); throw new ValidationError("equipmentId must match path"); } return ok(await svc.createMaintenance(ctx, body)); } catch (e) { return fail(e); } }
