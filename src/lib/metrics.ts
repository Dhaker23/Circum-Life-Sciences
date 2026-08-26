// Phase 13 D4: In-memory metrics (no Redis/Prometheus/Grafana).
// D8: metrics require audit.read permission.
// Metrics are operational, not manufacturing data. Reset on restart.

interface MetricsState {
  requestCount: number;
  errorCount: number;
  totalResponseTimeMs: number;
  perEndpoint: Record<string, { count: number; errors: number; totalMs: number }>;
  startTime: string;
}

const state: MetricsState = {
  requestCount: 0,
  errorCount: 0,
  totalResponseTimeMs: 0,
  perEndpoint: {},
  startTime: new Date().toISOString(),
};

export function recordRequest(method: string, path: string, status: number, durationMs: number): void {
  state.requestCount++;
  state.totalResponseTimeMs += durationMs;
  if (status >= 400) state.errorCount++;
  const key = `${method} ${path}`;
  if (!state.perEndpoint[key]) state.perEndpoint[key] = { count: 0, errors: 0, totalMs: 0 };
  state.perEndpoint[key].count++;
  state.perEndpoint[key].totalMs += durationMs;
  if (status >= 400) state.perEndpoint[key].errors++;
}

export function getMetrics() {
  const avgResponseTimeMs = state.requestCount > 0 ? state.totalResponseTimeMs / state.requestCount : 0;
  return {
    requestCount: state.requestCount,
    errorCount: state.errorCount,
    errorRate: state.requestCount > 0 ? state.errorCount / state.requestCount : 0,
    avgResponseTimeMs: Math.round(avgResponseTimeMs * 100) / 100,
    uptime: new Date().getTime() - new Date(state.startTime).getTime(),
    startTime: state.startTime,
    perEndpoint: Object.entries(state.perEndpoint).map(([key, v]) => ({
      endpoint: key,
      count: v.count,
      errors: v.errors,
      avgMs: v.count > 0 ? Math.round((v.totalMs / v.count) * 100) / 100 : 0,
    })),
  };
}
