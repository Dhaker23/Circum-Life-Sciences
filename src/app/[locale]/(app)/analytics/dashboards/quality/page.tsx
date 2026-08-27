"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KpiCard, WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker, SiteSelector,
} from "@/components/analytics";

type QualityData = {
  rejectRate: number | null;
  fpy: number | null;
  scrapRate: number | null;
  reworkRate: number | null;
  openNcrs: number;
  openDeviations: number;
  openCapas: number;
  testPassCount: number;
  testFailCount: number;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function QualityDashboardPage() {
  const t = useTranslations("analytics");
  const tc = useTranslations("common");
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
    queryKey: ["analytics", "quality", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard/quality", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as QualityData;
    },
    enabled: !!effectiveSiteId,
  });

  const pieData = dataQ.data
    ? [
        { name: t("dashboards.testPass"), value: dataQ.data.testPassCount, color: "hsl(142, 71%, 45%)" },
        { name: t("dashboards.testFail"), value: dataQ.data.testFailCount, color: "hsl(0, 84%, 60%)" },
      ]
    : [];

  // Chart accessibility: textual summary computed from the live data so
  // screen readers can announce the chart's shape (no fabricated numbers).
  const totalTests = (dataQ.data?.testPassCount ?? 0) + (dataQ.data?.testFailCount ?? 0);
  const chartAriaLabel = `${t("dashboards.quality")} ${tc("chartSummary")}: ${t("dashboards.testPass")} ${dataQ.data?.testPassCount ?? 0}, ${t("dashboards.testFail")} ${dataQ.data?.testFailCount ?? 0}`;
  const chartSummary = totalTests > 0
    ? `${tc("chartSummary")}: ${t("dashboards.quality")}. ${t("dashboards.testPass")}: ${dataQ.data?.testPassCount ?? 0}. ${t("dashboards.testFail")}: ${dataQ.data?.testFailCount ?? 0}. Total: ${totalTests}. Pass rate: ${totalTests > 0 ? Math.round(((dataQ.data?.testPassCount ?? 0) / totalTests) * 100) : 0}%.`
    : `${tc("chartSummary")}: ${t("dashboards.noData")}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboards.quality")} subtitle={t("dashboards.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <SiteSelector sites={sitesQuery.data ?? []} value={effectiveSiteId} onChange={setSiteId} />
            <DateRangePicker value={range} onChange={setRange} />
          </div>
        </CardContent>
      </Card>

      {dataQ.isLoading ? <AnalyticsSkeleton cards={9} /> :
        dataQ.error ? <ErrorState message={t("common.error")} /> :
        dataQ.data ? (
          <>
            <WarningBanner warnings={dataQ.data.meta.warnings ?? []} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={t("dashboards.fpy")} value={dataQ.data.fpy === null ? null : dataQ.data.fpy * 100} suffix="%" source={dataQ.data.meta.sources?.fpy} state={dataQ.data.fpy === null ? "unavailable" : "calculated"} />
              <KpiCard label={t("dashboards.rejectRate")} value={dataQ.data.rejectRate === null ? null : dataQ.data.rejectRate * 100} suffix="%" source={dataQ.data.meta.sources?.rejectRate} state={dataQ.data.rejectRate === null ? "unavailable" : "calculated"} />
              <KpiCard label={t("dashboards.scrapRate")} value={dataQ.data.scrapRate === null ? null : dataQ.data.scrapRate * 100} suffix="%" source={dataQ.data.meta.sources?.scrapRate} state={dataQ.data.scrapRate === null ? "unavailable" : "calculated"} />
              <KpiCard label={t("dashboards.reworkRate")} value={dataQ.data.reworkRate === null ? null : dataQ.data.reworkRate * 100} suffix="%" source={dataQ.data.meta.sources?.reworkRate} state={dataQ.data.reworkRate === null ? "unavailable" : "calculated"} />
              <KpiCard label={t("dashboards.openNcrs")} value={dataQ.data.openNcrs} source={dataQ.data.meta.sources?.openNcrs} />
              <KpiCard label={t("dashboards.openDeviations")} value={dataQ.data.openDeviations} source={dataQ.data.meta.sources?.openDeviations} />
              <KpiCard label={t("dashboards.openCapas")} value={dataQ.data.openCapas} source={dataQ.data.meta.sources?.openCapas} />
              <KpiCard label={t("dashboards.testPass")} value={dataQ.data.testPassCount} source={dataQ.data.meta.sources?.testPassCount} />
              <KpiCard label={t("dashboards.testFail")} value={dataQ.data.testFailCount} source={dataQ.data.meta.sources?.testFailCount} state={dataQ.data.testFailCount > 0 ? "warning" : "calculated"} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("dashboards.quality")}</CardTitle>
              </CardHeader>
              <CardContent>
                {dataQ.data.testPassCount + dataQ.data.testFailCount === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="h-64" role="img" aria-label={chartAriaLabel}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                          {pieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
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
