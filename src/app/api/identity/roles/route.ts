import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import * as identityService from "@/modules/identity/service";

export async function GET(_req: NextRequest) {
  try {
    const ctx = await requirePermission("identity.role.read");
    return ok(await identityService.listRoles(ctx));
  } catch (e) {
    return fail(e);
  }
}
