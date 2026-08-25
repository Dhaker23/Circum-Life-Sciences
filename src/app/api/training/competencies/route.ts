import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateCompetencySchema } from "@/modules/training/domain";
import * as svc from "@/modules/training/service";
export async function GET(_req: NextRequest) { try { const ctx = await requirePermission("training.competency.read"); return ok(await svc.listCompetencies(ctx)); } catch (e) { return fail(e); } }
export async function POST(req: NextRequest) { try { const ctx = await requirePermission("training.competency.authorize"); const body = parseOrThrow(CreateCompetencySchema, await req.json()); return ok(await svc.authorizeCompetency(ctx, body)); } catch (e) { return fail(e); } }
