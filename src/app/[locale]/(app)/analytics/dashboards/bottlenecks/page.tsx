"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker, SiteSelector,
} from "@/components/analytics";

type BottleneckData = {
  bottlenecks: Array<{ workCenterCode: string; equipmentCode: string; oee: number | null; avgCycleTime: number | null }>;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function BottlenecksDashboardPage() {
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
    queryKey: ["analytics", "bottlenecks", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard/bottlenecks", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as BottleneckData;
    },
    enabled: !!effectiveSiteId,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboards.bottlenecks")} subtitle={t("dashboards.subtitle")} />

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

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("dashboards.bottlenecks")}</CardTitle>
              </CardHeader>
              <CardContent>
                {dataQ.data.bottlenecks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          <TableHead className="text-xs">#</TableHead>
                          <TableHead className="text-xs">{t("dashboards.workCenter")}</TableHead>
                          <TableHead className="text-xs">{t("dashboards.equipment")}</TableHead>
                          <TableHead className="text-xs text-right">{t("dashboards.oee")}</TableHead>
                          <TableHead className="text-xs text-right">{t("dashboards.avgCycleTime")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataQ.data.bottlenecks.map((b, idx) => (
                          <TableRow key={`${b.workCenterCode}-${b.equipmentCode}-${idx}`}>
                            <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-xs">{b.workCenterCode}</TableCell>
                            <TableCell className="font-mono text-xs">{b.equipmentCode}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {b.oee === null ? (
                                <span className="text-muted-foreground italic">—</span>
                              ) : (
                                <Badge variant={b.oee >= 0.85 ? "default" : b.oee >= 0.6 ? "secondary" : "destructive"}>
                                  {(b.oee * 100).toFixed(1)}%
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {b.avgCycleTime === null ? <span className="text-muted-foreground italic">—</span> : `${b.avgCycleTime.toFixed(1)}m`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
