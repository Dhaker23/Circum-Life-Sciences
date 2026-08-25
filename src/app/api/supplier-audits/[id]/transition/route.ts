import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { AuditTransitionSchema } from "@/modules/supplieraudit/domain";
import * as svc from "@/modules/supplieraudit/service";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const ctx = await requirePermission("supplieraudit.transition"); const body = parseOrThrow(AuditTransitionSchema, await req.json()); return ok(await svc.transitionSupplierAudit(ctx, id, body)); } catch (e) { return fail(e); } }
