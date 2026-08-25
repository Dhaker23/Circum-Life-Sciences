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

type RecurrenceData = {
  items: Array<{
    subjectType: string;
    subjectId: string;
    subjectLabel: string;
    occurrences: number;
    dates: string[];
    linkedCapaIds: string[];
  }>;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function RecurrenceReportPage() {
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
    queryKey: ["analytics", "recurrence", effectiveSiteId, range],
    queryFn: async () => {
      const res = await fetch("/api/analytics/reports/recurrence", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as RecurrenceData;
    },
    enabled: !!effectiveSiteId,
  });

  const handleExport = async () => {
    const res = await fetch("/api/analytics/export", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportType: "recurrence",
        params: { siteId: effectiveSiteId, fromDate: range.fromDate, toDate: range.toDate },
        format: "csv",
      }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `circum-recurrence-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalOccurrences = dataQ.data?.items.reduce((s, i) => s + i.occurrences, 0) ?? 0;
  const totalLinkedCapas = dataQ.data?.items.reduce((s, i) => s + i.linkedCapaIds.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.recurrence")} subtitle={t("reports.subtitle")} />

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
              <KpiCard label={t("dashboards.bottlenecks")} value={dataQ.data.items.length} source={dataQ.data.meta.sources?.recurrence} state={dataQ.data.items.length > 0 ? "warning" : "calculated"} />
              <KpiCard label={t("reports.occurrences")} value={totalOccurrences} />
              <KpiCard label={t("reports.recurrenceSinceClose")} value={totalLinkedCapas} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("reports.recurrence")}</CardTitle>
              </CardHeader>
              <CardContent>
                {dataQ.data.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          <TableHead className="text-xs">{t("reports.subject")}</TableHead>
                          <TableHead className="text-xs text-right">{t("reports.occurrences")}</TableHead>
                          <TableHead className="text-xs">Dates</TableHead>
                          <TableHead className="text-xs text-right">Linked CAPAs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dataQ.data.items.map((it, idx) => (
                          <TableRow key={`${it.subjectType}-${it.subjectId}-${idx}`}>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] me-2">{it.subjectType}</Badge>
                              <span className="font-mono text-xs">{it.subjectLabel}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums font-semibold">{it.occurrences}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              <div className="flex flex-wrap gap-1">
                                {it.dates.slice(0, 5).map((d, i) => (
                                  <span key={i} className="font-mono text-[10px]">{new Date(d).toLocaleDateString()}</span>
                                ))}
                                {it.dates.length > 5 && <span className="text-[10px]">+{it.dates.length - 5}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">{it.linkedCapaIds.length}</TableCell>
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
