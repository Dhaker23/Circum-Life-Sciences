import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import { CreateRequiredTrainingSchema } from "@/modules/training/domain";
import * as svc from "@/modules/training/service";
export async function GET(_req: NextRequest) { try { const ctx = await requirePermission("training.required.read"); return ok(await svc.listRequiredTrainings(ctx)); } catch (e) { return fail(e); } }
export async function POST(req: NextRequest) { try { const ctx = await requirePermission("training.required.create"); const body = parseOrThrow(CreateRequiredTrainingSchema, await req.json()); return ok(await svc.createRequiredTraining(ctx, body)); } catch (e) { return fail(e); } }
