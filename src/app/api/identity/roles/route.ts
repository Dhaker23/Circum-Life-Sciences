import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { PaginationSchema } from "@/lib/zod-schemas";
import * as identityService from "@/modules/identity/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("identity.role.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const result = await identityService.listRoles(ctx, page, pageSize);
    return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (e) {
    return fail(e);
  }
}
