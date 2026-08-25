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
  KpiCard, WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker, SiteSelector,
} from "@/components/analytics";

type ActionEffectivenessData = {
  items: Array<{
    capaId: string;
    capaCode: string;
    closedAt: string | null;
    effectivenessOutcome: string | null;
    recurrenceSinceClose: boolean;
    recurrenceCount: number;
  }>;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function ActionEffectivenessReportPage() {
  const t = useTranslations("analytics");
  const [siteId, setSiteId] = useState<string>("");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [range, setRange] = useState({ fromDate: monthAgo, toDate: today });

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
    queryKey: ["analytics", "action-effectiveness", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/reports/action-effectiveness", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as ActionEffectivenessData;
    },
    enabled: !!effectiveSiteId,
  });

  const handleExport = async () => {
    const res = await fetch("/api/analytics/export", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportType: "action-effectiveness",
        params: { siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate },
        format: "csv",
      }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `circum-action-effectiveness-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const recurrenceCount = dataQ.data?.items.filter((i) => i.recurrenceSinceClose).length ?? 0;
  const effectivenessRate = dataQ.data && dataQ.data.items.length > 0
    ? (1 - recurrenceCount / dataQ.data.items.length)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.actionEffectiveness")} subtitle={t("reports.subtitle")} />

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
              <KpiCard label="Closed CAPAs" value={dataQ.data.items.length} source={dataQ.data.meta.sources?.actionEffectiveness} />
              <KpiCard label={t("reports.recurrenceSinceClose")} value={recurrenceCount} state={recurrenceCount > 0 ? "warning" : "calculated"} />
              <KpiCard
                label="Effectiveness Rate"
                value={effectivenessRate === null ? null : effectivenessRate * 100}
                suffix="%"
                state={effectivenessRate === null ? "unavailable" : effectivenessRate >= 0.9 ? "calculated" : "warning"}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("reports.actionEffectiveness")}</CardTitle>
              </CardHeader>
              <CardContent>
                {dataQ.data.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          <TableHead className="text-xs">CAPA</TableHead>
                          <TableHead className="text-xs">{t("reports.closedAt")}</TableHead>
                          <TableHead className="text-xs">{t("reports.effectivenessOutcome")}</TableHead>
                          <TableHead className="text-xs text-right">{t("reports.recurrenceSinceClose")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataQ.data.items.map((it) => (
                          <TableRow key={it.capaId}>
                            <TableCell className="font-mono text-xs">{it.capaCode}</TableCell>
                            <TableCell className="text-xs">{it.closedAt ? new Date(it.closedAt).toLocaleDateString() : "—"}</TableCell>
                            <TableCell>
                              {it.effectivenessOutcome ? (
                                <Badge variant={it.effectivenessOutcome === "EFFECTIVE" ? "default" : "secondary"} className="text-[10px]">
                                  {it.effectivenessOutcome}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {it.recurrenceSinceClose ? (
                                <Badge variant="destructive" className="text-[10px]">Yes ({it.recurrenceCount})</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">No</Badge>
                              )}
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
