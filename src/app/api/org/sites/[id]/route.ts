import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { UpdateSiteSchema } from "@/lib/zod-schemas";
import * as orgService from "@/modules/organization/service";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("org.site.read", id);
    return ok(await orgService.getSite(ctx, id));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ctx = await requirePermission("org.site.update", id);
    const body = parseOrThrow(UpdateSiteSchema, await req.json());
    return ok(await orgService.updateSite(ctx, id, body));
  } catch (e) {
    return fail(e);
  }
}
