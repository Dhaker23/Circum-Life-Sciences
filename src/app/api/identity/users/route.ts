import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateUserSchema, PaginationSchema } from "@/lib/zod-schemas";
import * as identityService from "@/modules/identity/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("identity.user.read");
    const url = new URL(req.url);
    const { page, pageSize } = PaginationSchema.parse(Object.fromEntries(url.searchParams));
    const result = await identityService.listUsers(ctx, page, pageSize);
    return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("identity.user.create");
    const body = parseOrThrow(CreateUserSchema, await req.json());
    const user = await identityService.createUser(ctx, body);
    return ok(user);
  } catch (e) {
    return fail(e);
  }
}
