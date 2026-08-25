"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  KpiCard, WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, SiteSelector,
} from "@/components/analytics";

type CriticalData = {
  threshold: number;
  items: Array<{
    type: "NCR" | "DEVIATION" | "CAPA";
    id: string;
    code: string;
    status: string;
    rpn: number;
    riskAssessmentId: string;
    riskAssessmentCode: string;
    associationPath: string;
    openedAt: string;
  }>;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function CriticalProblemsDashboardPage() {
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
    queryKey: ["analytics", "critical-problems", effectiveSiteId],
    queryFn: async () => {
      const res = await fetch("/api/analytics/dashboard/critical-problems", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as CriticalData;
    },
    enabled: !!effectiveSiteId,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboards.criticalProblems")} subtitle={t("dashboards.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <SiteSelector sites={sitesQuery.data ?? []} value={effectiveSiteId} onChange={setSiteId} />
          </div>
        </CardContent>
      </Card>

      {dataQ.isLoading ? <AnalyticsSkeleton cards={2} /> :
        dataQ.error ? <ErrorState message={t("common.error")} /> :
        dataQ.data ? (
          <>
            <WarningBanner warnings={dataQ.data.meta.warnings ?? []} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={t("dashboards.rpn") + " (threshold)"} value={dataQ.data.threshold} source={dataQ.data.meta.sources?.criticalProblems} />
              <KpiCard label={t("dashboards.criticalProblems")} value={dataQ.data.items.length} state={dataQ.data.items.length > 0 ? "warning" : "calculated"} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("dashboards.criticalProblems")}</CardTitle>
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
                          <TableHead className="text-xs">{t("dashboards.status")}</TableHead>
                          <TableHead className="text-xs text-right">{t("dashboards.rpn")}</TableHead>
                          <TableHead className="text-xs">{t("dashboards.riskAssessment")}</TableHead>
                          <TableHead className="text-xs">{t("dashboards.associationPath")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataQ.data.items.map((it) => (
                          <TableRow key={`${it.type}-${it.id}`}>
                            <TableCell>
                              <Badge variant={it.type === "CAPA" ? "secondary" : it.type === "DEVIATION" ? "outline" : "destructive"} className="text-[10px]">{it.type}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{it.code}</TableCell>
                            <TableCell className="text-xs">{it.status}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-semibold">{it.rpn}</TableCell>
                            <TableCell className="font-mono text-xs">{it.riskAssessmentCode}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{it.associationPath}</TableCell>
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
