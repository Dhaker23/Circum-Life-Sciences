"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  KpiCard, WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker, SiteSelector,
} from "@/components/analytics";

type DowntimeData = {
  pareto: Array<{ category: string; totalDurationMinutes: number; count: number; cumulativePercent: number }>;
  totalDowntimeMinutes: number;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function DowntimeParetoReportPage() {
  const t = useTranslations("analytics");
  const [siteId, setSiteId] = useState<string>("");
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [range, setRange] = useState({ fromDate: weekAgo, toDate: today });

  const sitesQuery = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/org/sites", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{ id: string; code: string; name: string }>;
    },
  });

  const effectiveSiteId = siteId || sitesQuery.data?.[0]?.id || "";

  const dataQ = useQuery({
    queryKey: ["analytics", "downtime-pareto-report", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/reports/downtime-pareto", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as DowntimeData;
    },
    enabled: !!effectiveSiteId,
  });

  const handleExport = async () => {
    const res = await fetch("/api/analytics/export", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportType: "downtime-pareto",
        params: { siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate },
        format: "csv",
      }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `circum-downtime-pareto-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCount = dataQ.data?.pareto.reduce((s, p) => s + p.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.downtimePareto")} subtitle={t("reports.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <SiteSelector sites={sitesQuery.data ?? []} value={effectiveSiteId} onChange={setSiteId} />
            <DateRangePicker value={range} onChange={setRange} />
            <Button size="sm" variant="outline" onClick={handleExport} disabled={!dataQ.data} className="text-xs">
              <Download className="h-3.5 w-3.5 me-1" /> {t("reports.export")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {dataQ.isLoading ? <AnalyticsSkeleton cards={3} /> :
        dataQ.error ? <ErrorState message={t("common.error")} /> :
        dataQ.data ? (
          <>
            <WarningBanner warnings={dataQ.data.meta.warnings ?? []} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={t("dashboards.totalDowntime")} value={dataQ.data.totalDowntimeMinutes} suffix="min" source={dataQ.data.meta.sources?.totalDowntimeMinutes} />
              <KpiCard label={t("dashboards.category")} value={dataQ.data.pareto.length} />
              <KpiCard label={t("dashboards.count")} value={totalCount} />
              <KpiCard label={t("dashboards.cumulative")} value={dataQ.data.pareto.length > 0 ? dataQ.data.pareto[dataQ.data.pareto.length - 1].cumulativePercent : 0} suffix="%" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("reports.downtimePareto")}</CardTitle>
              </CardHeader>
              <CardContent>
                {dataQ.data.pareto.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dataQ.data.pareto}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="category" className="text-xs" angle={-15} textAnchor="end" height={60} />
                        <YAxis yAxisId="left" className="text-xs" />
                        <YAxis yAxisId="right" orientation="right" className="text-xs" domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalDurationMinutes" name={t("dashboards.duration")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" dataKey="cumulativePercent" name={t("dashboards.cumulative")} stroke="#f59e0b" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <MetaFooter meta={dataQ.data.meta} />
          </>
        ) : null}
    </div>
  );
}
