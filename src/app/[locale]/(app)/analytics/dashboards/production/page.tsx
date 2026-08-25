"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  KpiCard, WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker, SiteSelector,
} from "@/components/analytics";

type ProductionData = {
  plannedTotal: number;
  actualTotal: number;
  variance: number;
  byDay: Array<{ date: string; planned: number; actual: number }>;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function ProductionDashboardPage() {
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
    queryKey: ["analytics", "production", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard/production", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as ProductionData;
    },
    enabled: !!effectiveSiteId,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboards.production")} subtitle={t("dashboards.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <SiteSelector sites={sitesQuery.data ?? []} value={effectiveSiteId} onChange={setSiteId} />
            <DateRangePicker value={range} onChange={setRange} />
          </div>
        </CardContent>
      </Card>

      {dataQ.isLoading ? <AnalyticsSkeleton cards={3} /> :
        dataQ.error ? <ErrorState message={t("common.error")} /> :
        dataQ.data ? (
          <>
            <WarningBanner warnings={dataQ.data.meta.warnings ?? []} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={t("dashboards.planned")} value={dataQ.data.plannedTotal} source={dataQ.data.meta.sources?.plannedTotal} />
              <KpiCard label={t("dashboards.actual")} value={dataQ.data.actualTotal} source={dataQ.data.meta.sources?.actualTotal} />
              <KpiCard
                label={t("dashboards.variance")}
                value={dataQ.data.variance}
                source={dataQ.data.meta.sources?.variance}
                state={dataQ.data.variance < 0 ? "warning" : "calculated"}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("dashboards.production")}</CardTitle>
              </CardHeader>
              <CardContent>
                {dataQ.data.byDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataQ.data.byDay}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="planned" name={t("dashboards.planned")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actual" name={t("dashboards.actual")} fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
                      </BarChart>
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
