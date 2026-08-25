"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import {
  WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker, SiteSelector,
} from "@/components/analytics";

type EquipmentPerfData = {
  items: Array<{
    equipmentId: string;
    equipmentCode: string;
    equipmentName: string;
    oee: number | null;
    availability: number | null;
    performance: number | null;
    quality: number | null;
    runTimeMinutes: number;
  }>;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function EquipmentPerformanceReportPage() {
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
    queryKey: ["analytics", "equipment-performance", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/reports/equipment-performance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as EquipmentPerfData;
    },
    enabled: !!effectiveSiteId,
  });

  const handleExport = async () => {
    const res = await fetch("/api/analytics/export", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportType: "equipment-performance",
        params: { siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate },
        format: "csv",
      }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `circum-equipment-performance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtPct = (v: number | null) =>
    v === null ? <span className="text-muted-foreground italic">—</span> : `${(v * 100).toFixed(1)}%`;

  const pctBadge = (v: number | null) => {
    if (v === null) return <span className="text-muted-foreground italic">—</span>;
    const pct = v * 100;
    return (
      <Badge variant={pct >= 85 ? "default" : pct >= 60 ? "secondary" : "destructive"} className="text-[10px]">
        {pct.toFixed(1)}%
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.equipmentPerformance")} subtitle={t("reports.subtitle")} />

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

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("reports.equipmentPerformance")}</CardTitle>
              </CardHeader>
              <CardContent>
                {dataQ.data.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          <TableHead className="text-xs">{t("dashboards.equipment")}</TableHead>
                          <TableHead className="text-xs text-right">{t("dashboards.availability")}</TableHead>
                          <TableHead className="text-xs text-right">{t("dashboards.performance")}</TableHead>
                          <TableHead className="text-xs text-right">{t("dashboards.qualityMetric")}</TableHead>
                          <TableHead className="text-xs text-right">{t("dashboards.oee")}</TableHead>
                          <TableHead className="text-xs text-right">Run Time (min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataQ.data.items.map((it) => (
                          <TableRow key={it.equipmentId}>
                            <TableCell>
                              <span className="font-mono text-xs">{it.equipmentCode}</span>
                              <span className="ms-2 text-xs text-muted-foreground">{it.equipmentName}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs">{fmtPct(it.availability)}</TableCell>
                            <TableCell className="text-right text-xs">{fmtPct(it.performance)}</TableCell>
                            <TableCell className="text-right text-xs">{fmtPct(it.quality)}</TableCell>
                            <TableCell className="text-right text-xs">{pctBadge(it.oee)}</TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{it.runTimeMinutes}</TableCell>
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
