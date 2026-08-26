import { NextRequest } from "next/server";
import { ok, fail, parseOrThrow } from "@/lib/api-envelope";
import { requirePermission } from "@/lib/auth-context";
import * as svc from "@/modules/quality/service";
import { z } from "zod";

const ApproveSchema = z.object({ reason: z.string().min(1).max(500) });

// Deviation approve
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = parseOrThrow(ApproveSchema, await req.json());
    const ctx = await requirePermission("quality.deviation.approve");
    return ok(await svc.approveDeviation(ctx, id, body.reason));
  } catch (e) { return fail(e); }
}
