import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateDepartmentSchema } from "@/lib/zod-schemas";
import * as orgService from "@/modules/organization/service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("org.department.read");
    const url = new URL(req.url);
    const siteId = url.searchParams.get("siteId") ?? undefined;
    return ok(await orgService.listDepartments(ctx, siteId));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = parseOrThrow(CreateDepartmentSchema, await req.json());
    const ctx = await requirePermission("org.department.create", body.siteId);
    return ok(await orgService.createDepartment(ctx, body));
  } catch (e) {
    return fail(e);
  }
}
