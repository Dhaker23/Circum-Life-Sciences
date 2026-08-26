import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateIntegrationConfigSchema } from "@/modules/integration/domain/schemas";
import * as svc from "@/modules/integration/service";
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await requirePermission("integration.read"); const { id } = await params; return ok(await svc.getConfig(ctx, id)); } catch (e) { return fail(e); }
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await requirePermission("integration.config.manage"); const { id } = await params; const body = parseOrThrow(UpdateIntegrationConfigSchema, await req.json()); return ok(await svc.updateConfig(ctx, id, body)); } catch (e) { return fail(e); }
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const ctx = await requirePermission("integration.config.manage"); const { id } = await params; return ok(await svc.deactivateConfig(ctx, id)); } catch (e) { return fail(e); }
}
