"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import {
  WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker, SiteSelector,
} from "@/components/analytics";

type TrendData = {
  buckets: Array<{
    bucketStart: string;
    bucketEnd: string;
    values: Record<string, number | null>;
    source: "live";
    warnings: string[];
  }>;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

const METRICS = [
  { key: "oee", color: "hsl(var(--primary))" },
  { key: "availability", color: "#10b981" },
  { key: "performance", color: "#f59e0b" },
  { key: "quality", color: "#ef4444" },
];

export default function OeeTrendReportPage() {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
  const [siteId, setSiteId] = useState<string>("");
  const [granularity, setGranularity] = useState<"HOUR" | "DAY" | "WEEK" | "MONTH">("DAY");
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
    queryKey: ["analytics", "oee-trend", effectiveSiteId, range, granularity],
    queryFn: async () => {
      const res = await fetch("/api/analytics/reports/oee-trend", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate, granularity }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as TrendData;
    },
    enabled: !!effectiveSiteId,
  });

  const chartData = (dataQ.data?.buckets ?? []).map((b) => ({
    bucket: b.bucketStart.slice(0, 16),
    ...METRICS.reduce((acc, m) => {
      const v = b.values[m.key];
      acc[m.key] = v === null || v === undefined ? null : v * 100;
      return acc;
    }, {} as Record<string, number | null>),
  }));

  // Chart accessibility: textual summary computed from the live data so
  // screen readers can announce the chart's shape (no fabricated numbers).
  const buckets = dataQ.data?.buckets ?? [];
  const firstBucket = buckets[0]?.bucketStart;
  const lastBucket = buckets[buckets.length - 1]?.bucketStart;
  const oeeValues = buckets
    .map((b) => b.values.oee)
    .filter((v): v is number => v !== null && v !== undefined)
    .map((v) => v * 100);
  const oeeMin = oeeValues.length > 0 ? Math.min(...oeeValues) : null;
  const oeeMax = oeeValues.length > 0 ? Math.max(...oeeValues) : null;
  const chartAriaLabel = `${t("reports.oeeTrend")} ${tc("chartSummary")}: ${buckets.length} data points, OEE, availability, performance, quality`;
  const chartSummary = buckets.length > 0
    ? `${tc("chartSummary")}: ${t("reports.oeeTrend")}. ${buckets.length} data points from ${firstBucket ?? ""} to ${lastBucket ?? ""}. OEE range: ${oeeMin !== null ? oeeMin.toFixed(1) : "—"}% to ${oeeMax !== null ? oeeMax.toFixed(1) : "—"}%. Metrics: OEE, availability, performance, quality.`
    : `${tc("chartSummary")}: ${t("dashboards.noData")}`;

  const handleExport = async () => {
    const res = await fetch("/api/analytics/export", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportType: "oee-trend",
        params: { siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate, granularity },
        format: "csv",
      }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `circum-oee-trend-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.oeeTrend")} subtitle={t("reports.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <SiteSelector sites={sitesQuery.data ?? []} value={effectiveSiteId} onChange={setSiteId} />
            <DateRangePicker value={range} onChange={setRange} />
            <div className="space-y-1">
              <Label className="text-xs">{t("reports.granularity")}</Label>
              <Select value={granularity} onValueChange={(v) => setGranularity(v as typeof granularity)}>
                <SelectTrigger className="w-[120px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOUR" className="text-xs">Hour</SelectItem>
                  <SelectItem value="DAY" className="text-xs">Day</SelectItem>
                  <SelectItem value="WEEK" className="text-xs">Week</SelectItem>
                  <SelectItem value="MONTH" className="text-xs">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={!dataQ.data} className="text-xs">
              <Download className="h-3.5 w-3.5 me-1" /> {t("reports.export")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {dataQ.isLoading ? <AnalyticsSkeleton cards={4} /> :
        dataQ.error ? <ErrorState message={t("common.error")} /> :
        dataQ.data ? (
          <>
            <WarningBanner warnings={dataQ.data.meta.warnings ?? []} />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("reports.oeeTrend")}</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="h-80" role="img" aria-label={chartAriaLabel}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="bucket" className="text-xs" />
                        <YAxis domain={[0, 100]} className="text-xs" unit="%" />
                        <Tooltip />
                        <Legend />
                        {METRICS.map((m) => (
                          <Line key={m.key} type="monotone" dataKey={m.key} name={m.key} stroke={m.color} strokeWidth={2} dot={false} connectNulls />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="sr-only">{chartSummary}</p>
              </CardContent>
            </Card>

            <MetaFooter meta={dataQ.data.meta} />
          </>
        ) : null}
    </div>
  );
}
