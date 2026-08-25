"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker, SiteSelector,
} from "@/components/analytics";

type OeeData = {
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  sources: {
    plannedTimeMinutes: number;
    downtimeMinutes: number;
    runTimeMinutes: number;
    idealDurationMinutes: number;
    totalCount: number;
    goodCount: number;
    scrapCount: number;
    reworkCount: number;
  };
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

// Gauge ring: renders a horizontal bar proportional to the value (0-1).
function GaugeBar({ value, label }: { value: number | null; label: string }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  const color = pct >= 85 ? "bg-green-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {value === null ? (
          <span className="text-sm font-medium text-muted-foreground italic">Data unavailable</span>
        ) : (
          <>
            <div className="text-3xl font-bold tabular-nums">{(value * 100).toFixed(1)}%</div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function OeeDashboardPage() {
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
    queryKey: ["analytics", "oee", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard/oee", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as OeeData;
    },
    enabled: !!effectiveSiteId,
  });

  const sourceRows = dataQ.data
    ? [
        { k: "plannedTimeMinutes", v: dataQ.data.sources.plannedTimeMinutes },
        { k: "downtimeMinutes", v: dataQ.data.sources.downtimeMinutes },
        { k: "runTimeMinutes", v: dataQ.data.sources.runTimeMinutes },
        { k: "idealDurationMinutes", v: dataQ.data.sources.idealDurationMinutes },
        { k: "totalCount", v: dataQ.data.sources.totalCount },
        { k: "goodCount", v: dataQ.data.sources.goodCount },
        { k: "scrapCount", v: dataQ.data.sources.scrapCount },
        { k: "reworkCount", v: dataQ.data.sources.reworkCount },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboards.oee")} subtitle={t("dashboards.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <SiteSelector sites={sitesQuery.data ?? []} value={effectiveSiteId} onChange={setSiteId} />
            <DateRangePicker value={range} onChange={setRange} />
          </div>
        </CardContent>
      </Card>

      {dataQ.isLoading ? <AnalyticsSkeleton cards={4} /> :
        dataQ.error ? <ErrorState message={t("common.error")} /> :
        dataQ.data ? (
          <>
            <WarningBanner warnings={dataQ.data.meta.warnings ?? []} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <GaugeBar value={dataQ.data.oee} label={t("dashboards.oee")} />
              <GaugeBar value={dataQ.data.availability} label={t("dashboards.availability")} />
              <GaugeBar value={dataQ.data.performance} label={t("dashboards.performance")} />
              <GaugeBar value={dataQ.data.quality} label={t("dashboards.qualityMetric")} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("common.sources")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead className="text-xs">{t("common.sources")}</TableHead>
                        <TableHead className="text-xs text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sourceRows.map((r) => (
                        <TableRow key={r.k}>
                          <TableCell className="font-mono text-xs">{r.k}</TableCell>
                          <TableCell className="text-right text-xs tabular-nums">{r.v}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <MetaFooter meta={dataQ.data.meta} />
          </>
        ) : null}
    </div>
  );
}
