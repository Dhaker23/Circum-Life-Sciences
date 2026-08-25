"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Clock, CheckCircle2 } from "lucide-react";
import {
  KpiCard, WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader,
} from "@/components/analytics";

type VsmListItem = { id: string; code: string; name: string; status: string };

type VsmView = {
  vsm: { id: string; code: string; name: string; siteId: string | null; status: string };
  nodes: Array<{
    id: string;
    sequence: number;
    nodeType: string;
    name: string;
    leadTimeMinutes: number | null;
    valueAddedMinutes: number | null;
  }>;
  edges: Array<{ id: string; fromNodeId: string; toNodeId: string }>;
  evaluation: {
    totalLeadTimeMinutes: number;
    totalValueAddedMinutes: number;
    totalNonValueAddedMinutes: number;
    valueAddedRatio: number;
    nodeCount: number;
  };
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string };
};

export default function VsmAnalyticsPage() {
  const t = useTranslations("analytics");
  const [vsmId, setVsmId] = useState<string>("");

  const listQ = useQuery({
    queryKey: ["vsm-list"],
    queryFn: async () => {
      const res = await fetch("/api/lean/vsm", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as VsmListItem[];
    },
  });

  const effectiveVsmId = vsmId || listQ.data?.[0]?.id || "";

  const viewQ = useQuery({
    queryKey: ["analytics", "vsm", effectiveVsmId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/vsm/${effectiveVsmId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as VsmView;
    },
    enabled: !!effectiveVsmId,
  });

  const nodes = (viewQ.data?.nodes ?? []).slice().sort((a, b) => a.sequence - b.sequence);
  const fmtMin = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}m`);

  return (
    <div className="space-y-6">
      <PageHeader title={t("vsm.title")} subtitle={t("vsm.subtitle")} />

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-1 max-w-sm">
            <Label className="text-xs">{t("vsm.selectVsm")}</Label>
            <Select value={effectiveVsmId} onValueChange={setVsmId} disabled={listQ.isLoading || (listQ.data?.length ?? 0) === 0}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder={listQ.isLoading ? t("common.loading") : t("vsm.noVsm")} />
              </SelectTrigger>
              <SelectContent>
                {(listQ.data ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    {v.code} — {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {listQ.isLoading ? <AnalyticsSkeleton cards={1} /> :
        listQ.error ? <ErrorState message={t("common.error")} /> :
        (listQ.data?.length ?? 0) === 0 ? (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">{t("vsm.noVsm")}</CardContent></Card>
        ) :
        viewQ.isLoading ? <AnalyticsSkeleton cards={4} /> :
        viewQ.error ? <ErrorState message={t("common.error")} /> :
        viewQ.data ? (
          <>
            <WarningBanner warnings={viewQ.data.meta.warnings ?? []} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={t("vsm.leadTime")} value={viewQ.data.evaluation.totalLeadTimeMinutes} suffix="min" source={viewQ.data.meta.sources?.vsmEvaluation} />
              <KpiCard label={t("vsm.valueAdded")} value={viewQ.data.evaluation.totalValueAddedMinutes} suffix="min" />
              <KpiCard label={t("vsm.nonValueAdded")} value={viewQ.data.evaluation.totalNonValueAddedMinutes} suffix="min" state={viewQ.data.evaluation.totalNonValueAddedMinutes > viewQ.data.evaluation.totalValueAddedMinutes ? "warning" : "calculated"} />
              <KpiCard label={t("vsm.vaRatio")} value={viewQ.data.evaluation.valueAddedRatio * 100} suffix="%" state={viewQ.data.evaluation.valueAddedRatio < 0.3 ? "warning" : "calculated"} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <span>{viewQ.data.vsm.code} — {viewQ.data.vsm.name}</span>
                  <Badge variant={viewQ.data.vsm.status === "ACTIVE" ? "default" : "secondary"} className="text-[10px]">{viewQ.data.vsm.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("dashboards.noData")}</p>
                ) : (
                  <div className="overflow-x-auto pb-4">
                    <div className="flex items-stretch gap-2 min-w-max">
                      {nodes.map((n, idx) => (
                        <div key={n.id} className="flex items-center gap-2">
                          <Card className="w-56 flex-shrink-0">
                            <CardContent className="pt-4 pb-4">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="text-[10px]">{n.nodeType}</Badge>
                                <span className="text-[10px] text-muted-foreground">#{n.sequence}</span>
                              </div>
                              <p className="text-sm font-medium mb-3 truncate" title={n.name}>{n.name}</p>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {t("vsm.leadTime")}</span>
                                  <span className="font-semibold tabular-nums">{fmtMin(n.leadTimeMinutes)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3 w-3" /> {t("vsm.valueAdded")}</span>
                                  <span className="font-semibold tabular-nums text-green-600">{fmtMin(n.valueAddedMinutes)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          {idx < nodes.length - 1 && (
                            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 self-center" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <MetaFooter meta={viewQ.data.meta} />
          </>
        ) : null}
    </div>
  );
}
