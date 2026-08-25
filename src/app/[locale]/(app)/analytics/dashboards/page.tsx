"use client";
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingDown, AlertTriangle, Clock, Package, Gauge, Activity, GitGraph, Building } from "lucide-react";
import { KpiCard, WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker, SiteSelector } from "@/components/analytics";

export default function AnalyticsDashboardsPage() {
  const t = useTranslations("analytics");
  const [siteId, setSiteId] = useState<string>("");
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [range, setRange] = useState({ fromDate: weekAgo, toDate: today });

  const sitesQuery = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/org/sites?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{ id: string; code: string; name: string }>;
    },
  });

  const effectiveSiteId = siteId || sitesQuery.data?.[0]?.id || "";

  const productionQ = useQuery({
    queryKey: ["analytics", "production", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard/production", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!effectiveSiteId,
  });

  const qualityQ = useQuery({
    queryKey: ["analytics", "quality", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard/quality", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!effectiveSiteId,
  });

  const downtimeQ = useQuery({
    queryKey: ["analytics", "downtime", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard/downtime", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!effectiveSiteId,
  });

  const loading = productionQ.isLoading || qualityQ.isLoading || downtimeQ.isLoading;
  const error = productionQ.error || qualityQ.error || downtimeQ.error;

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboards.title")} subtitle={t("dashboards.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <SiteSelector sites={sitesQuery.data ?? []} value={effectiveSiteId} onChange={setSiteId} />
            <DateRangePicker value={range} onChange={setRange} />
          </div>
        </CardContent>
      </Card>

      {loading ? <AnalyticsSkeleton cards={6} /> :
       error ? <ErrorState message={t("common.error")} /> :
       productionQ.data && qualityQ.data && downtimeQ.data ? (
        <>
          <WarningBanner warnings={[...(productionQ.data.data?.meta.warnings ?? []), ...(qualityQ.data.data?.meta.warnings ?? []), ...(downtimeQ.data.data?.meta.warnings ?? [])]} />

          {/* Production KPIs */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{t("dashboards.production")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={t("dashboards.planned")} value={productionQ.data.data.plannedTotal} source={productionQ.data.data.meta.sources.plannedTotal} />
              <KpiCard label={t("dashboards.actual")} value={productionQ.data.data.actualTotal} source={productionQ.data.data.meta.sources.actualTotal} />
              <KpiCard label={t("dashboards.variance")} value={productionQ.data.data.variance} source={productionQ.data.data.meta.sources.variance} state={productionQ.data.data.variance < 0 ? "warning" : "calculated"} />
            </div>
          </div>

          {/* Quality KPIs */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{t("dashboards.quality")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={t("dashboards.fpy")} value={qualityQ.data.data.fpy} suffix="%" source={qualityQ.data.data.meta.sources.fpy} state={qualityQ.data.data.fpy === null ? "unavailable" : "calculated"} />
              <KpiCard label={t("dashboards.rejectRate")} value={qualityQ.data.data.rejectRate} suffix="%" source={qualityQ.data.data.meta.sources.rejectRate} state={qualityQ.data.data.rejectRate === null ? "unavailable" : "calculated"} />
              <KpiCard label={t("dashboards.openNcrs")} value={qualityQ.data.data.openNcrs} source={qualityQ.data.data.meta.sources.openNcrs} />
              <KpiCard label={t("dashboards.openCapas")} value={qualityQ.data.data.openCapas} source={qualityQ.data.data.meta.sources.openCapas} />
            </div>
          </div>

          {/* Downtime KPIs */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{t("dashboards.downtime")}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard label={t("dashboards.totalDowntime")} value={downtimeQ.data.data.totalDowntimeMinutes} suffix="min" source={downtimeQ.data.data.meta.sources.totalDowntimeMinutes} />
              <KpiCard label={t("dashboards.category")} value={downtimeQ.data.data.pareto.length} suffix=" categories" />
              <KpiCard label={t("dashboards.count")} value={downtimeQ.data.data.pareto.reduce((s: number, p: { count: number }) => s + p.count, 0)} />
            </div>
          </div>

          {/* Navigation cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: "/analytics/dashboards/oee", icon: Gauge, label: t("dashboards.oee") },
              { href: "/analytics/dashboards/critical-problems", icon: AlertTriangle, label: t("dashboards.criticalProblems") },
              { href: "/analytics/dashboards/overdue-actions", icon: Clock, label: t("dashboards.overdueActions") },
              { href: "/analytics/reports", icon: BarChart3, label: t("reports.title") },
            ].map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-6 flex items-center gap-3">
                    <item.icon className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">View details →</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <MetaFooter meta={productionQ.data.data.meta} />
        </>
      ) : null}
    </div>
  );
}
