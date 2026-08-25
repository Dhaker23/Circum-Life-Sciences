import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import { CreateEquipmentSchema } from "@/modules/equipment/domain";
import * as svc from "@/modules/equipment/service";
export async function GET(req: NextRequest) { try { const ctx = await requirePermission("equipment.read"); const url = new URL(req.url); const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams)); const r = await svc.listEquipment(ctx, page, pageSize); return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total }); } catch (e) { return fail(e); } }
export async function POST(req: NextRequest) { try { const ctx = await requirePermission("equipment.create"); const body = parseOrThrow(CreateEquipmentSchema, await req.json()); return ok(await svc.createEquipment(ctx, body)); } catch (e) { return fail(e); } }
