import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateSiteSchema } from "@/lib/zod-schemas";
import * as orgService from "@/modules/organization/service";

export async function GET(_req: NextRequest) {
  try {
    const ctx = await requirePermission("org.site.read");
    const sites = await orgService.listSites(ctx);
    return ok(sites);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("org.site.create");
    const body = parseOrThrow(CreateSiteSchema, await req.json());
    return ok(await orgService.createSite(ctx, body));
  } catch (e) {
    return fail(e);
  }
}
