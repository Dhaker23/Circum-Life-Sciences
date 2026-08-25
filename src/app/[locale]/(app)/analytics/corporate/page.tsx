"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Lock, AlertTriangle } from "lucide-react";
import {
  KpiCard, WarningBanner, MetaFooter, AnalyticsSkeleton, ErrorState, PageHeader, DateRangePicker,
} from "@/components/analytics";

type CorporateData = {
  aggregate: Record<string, number | null>;
  contributingSiteCount: number;
  note: string;
  meta: { computedAt: string; sources?: Record<string, string>; warnings: string[]; dataState: string; audited: true };
};

const ALL_METRICS = [
  { key: "oee", label: "OEE" },
  { key: "availability", label: "Availability" },
  { key: "performance", label: "Performance" },
  { key: "quality", label: "Quality" },
  { key: "openNcrs", label: "Open NCRs" },
  { key: "openDeviations", label: "Open Deviations" },
  { key: "openCapas", label: "Open CAPAs" },
  { key: "totalDowntimeMinutes", label: "Total Downtime (min)" },
];

export default function CorporateAnalyticsPage() {
  const t = useTranslations("analytics");
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [range, setRange] = useState({ fromDate: weekAgo, toDate: today });
  const [metricKeys, setMetricKeys] = useState<string[]>(["oee", "openNcrs", "totalDowntimeMinutes"]);

  const toggleMetric = (k: string) => {
    setMetricKeys((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );
  };

  const dataQ = useQuery({
    queryKey: ["analytics", "corporate", range, metricKeys],
    queryFn: async () => {
      const res = await fetch("/api/analytics/corporate/summary", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: range.fromDate, toDate: range.toDate, metricKeys }),
      });
      if (res.status === 403) {
        throw new Error("FORBIDDEN");
      }
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as CorporateData;
    },
    enabled: metricKeys.length > 0,
  });

  const isForbidden = dataQ.error?.message === "FORBIDDEN";

  const formatMetric = (k: string, v: number | null) => {
    if (v === null) return null;
    if (k === "oee" || k === "availability" || k === "performance" || k === "quality") {
      return v * 100;
    }
    return v;
  };
  const suffixFor = (k: string) =>
    k === "oee" || k === "availability" || k === "performance" || k === "quality" ? "%" : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title={t("corporate.title")} subtitle={t("corporate.subtitle")} />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <DateRangePicker value={range} onChange={setRange} />
          <div className="space-y-2">
            <Label className="text-xs">{t("corporate.metricKey")}</Label>
            <div className="flex flex-wrap gap-3">
              {ALL_METRICS.map((m) => (
                <Label key={m.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={metricKeys.includes(m.key)}
                    onCheckedChange={() => toggleMetric(m.key)}
                  />
                  {m.label}
                </Label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {dataQ.isLoading ? <AnalyticsSkeleton cards={4} /> :
        isForbidden ? (
          <Card>
            <CardContent className="pt-10 pb-10 text-center">
              <Lock className="h-10 w-10 mx-auto text-amber-500 mb-3" />
              <p className="text-lg font-semibold">{t("common.error")}</p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                This view requires the <code className="font-mono text-xs">analytics.corporate.read</code> permission.
                Contact your administrator if you believe you should have access.
              </p>
            </CardContent>
          </Card>
        ) :
        dataQ.error ? <ErrorState message={t("common.error")} /> :
        dataQ.data ? (
          <>
            <WarningBanner warnings={dataQ.data.meta.warnings ?? []} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metricKeys.map((k) => {
                const label = ALL_METRICS.find((m) => m.key === k)?.label ?? k;
                const raw = dataQ.data.aggregate[k] ?? null;
                const value = formatMetric(k, raw);
                return (
                  <KpiCard
                    key={k}
                    label={label}
                    value={value}
                    suffix={suffixFor(k)}
                    state={value === null ? "unavailable" : "calculated"}
                  />
                );
              })}
              <KpiCard label={t("corporate.contributingSites")} value={dataQ.data.contributingSiteCount} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t("corporate.aggregate")}
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Audited
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{dataQ.data.note}</p>
              </CardContent>
            </Card>

            <MetaFooter meta={dataQ.data.meta} />
          </>
        ) : null}
    </div>
  );
}
