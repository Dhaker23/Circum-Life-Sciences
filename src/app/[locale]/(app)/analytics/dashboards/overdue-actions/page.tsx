"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  KpiCard, WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, SiteSelector, LimitationsNotice,
} from "@/components/analytics";

type OverdueData = {
  items: Array<{
    type: "CALIBRATION" | "MAINTENANCE" | "TRAINING";
    id: string;
    code: string;
    dueDate: string;
    daysOverdue: number;
    detail: string;
  }>;
  limitations: Array<{ type: "CAPA" | "CHANGE_CONTROL"; reason: string }>;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function OverdueActionsDashboardPage() {
  const t = useTranslations("analytics");
  const [siteId, setSiteId] = useState<string>("");

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
    queryKey: ["analytics", "overdue-actions", effectiveSiteId],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard/overdue-actions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as OverdueData;
    },
    enabled: !!effectiveSiteId,
  });

  const counts = dataQ.data?.items.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboards.overdueActions")} subtitle={t("dashboards.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <SiteSelector sites={sitesQuery.data ?? []} value={effectiveSiteId} onChange={setSiteId} />
          </div>
        </CardContent>
      </Card>

      {dataQ.isLoading ? <AnalyticsSkeleton cards={3} /> :
        dataQ.error ? <ErrorState message={t("common.error")} /> :
        dataQ.data ? (
          <>
            <WarningBanner warnings={dataQ.data.meta.warnings ?? []} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Calibration" value={counts.CALIBRATION ?? 0} state={(counts.CALIBRATION ?? 0) > 0 ? "warning" : "calculated"} source={dataQ.data.meta.sources?.overdueCalibration} />
              <KpiCard label="Maintenance" value={counts.MAINTENANCE ?? 0} state={(counts.MAINTENANCE ?? 0) > 0 ? "warning" : "calculated"} source={dataQ.data.meta.sources?.overdueMaintenance} />
              <KpiCard label="Training" value={counts.TRAINING ?? 0} state={(counts.TRAINING ?? 0) > 0 ? "warning" : "calculated"} source={dataQ.data.meta.sources?.overdueTraining} />
              <KpiCard label={t("dashboards.overdueActions")} value={dataQ.data.items.length} state={dataQ.data.items.length > 0 ? "warning" : "calculated"} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("dashboards.overdueActions")}</CardTitle>
              </CardHeader>
              <CardContent>
                {dataQ.data.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          <TableHead className="text-xs">{t("dashboards.type")}</TableHead>
                          <TableHead className="text-xs">{t("dashboards.code")}</TableHead>
                          <TableHead className="text-xs">{t("dashboards.dueDate")}</TableHead>
                          <TableHead className="text-xs text-right">{t("dashboards.daysOverdue")}</TableHead>
                          <TableHead className="text-xs">{t("dashboards.detail")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataQ.data.items.map((it) => (
                          <TableRow key={`${it.type}-${it.id}`}>
                            <TableCell>
                              <Badge variant={it.daysOverdue > 30 ? "destructive" : "secondary"} className="text-[10px]">{it.type}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{it.code}</TableCell>
                            <TableCell className="text-xs">{new Date(it.dueDate).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-semibold">{it.daysOverdue}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{it.detail}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <LimitationsNotice limitations={dataQ.data.limitations} />

            <MetaFooter meta={dataQ.data.meta} />
          </>
        ) : null}
    </div>
  );
}
