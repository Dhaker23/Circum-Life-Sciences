import { ok } from "@/lib/api-envelope";
import { db } from "@/lib/db";
import { getProvider } from "@/modules/ai/provider/factory";
import { getMetrics } from "@/lib/metrics";

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  let overall: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Database check
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.database = { status: "healthy", latencyMs: Date.now() - start };
  } catch {
    checks.database = { status: "unhealthy", error: "database connection failed" };
    overall = "unhealthy";
  }

  // AI provider check (non-sensitive; just available/not)
  try {
    const provider = getProvider();
    const health = await provider.health();
    checks.aiProvider = { status: health.available ? "healthy" : "degraded", latencyMs: health.latencyMs };
    if (!health.available && overall === "healthy") overall = "degraded";
  } catch {
    checks.aiProvider = { status: "degraded", error: "provider check failed" };
    if (overall === "healthy") overall = "degraded";
  }

  // Integration check (count only — no sensitive info; D8)
  try {
    const count = await db.integrationConfig.count({ where: { status: "ACTIVE" } });
    checks.integrations = { status: "healthy", activeCount: count } as any;
  } catch {
    checks.integrations = { status: "degraded" };
  }

  return ok({
    status: overall,
    timestamp: new Date().toISOString(),
    checks,
    uptime: getMetrics().uptime,
  });
}
