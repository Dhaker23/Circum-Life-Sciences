"use client";
// Phase 11 shared analytics UI components.
// CRITICAL: these components ONLY render API results. They NEVER compute KPIs client-side.
// The UI is not a second source of truth (owner rule).

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Database, Clock, Info } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// --- KPI Card: value + label + optional delta + source tooltip ---
export function KpiCard({
  label, value, suffix, delta, state = "calculated", source,
}: {
  label: string; value: string | number | null; suffix?: string;
  delta?: { value: number; label: string }; state?: "calculated" | "unavailable" | "incomplete" | "warning";
  source?: string;
}) {
  const isUnavailable = state === "unavailable" || value === null;
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {label}
          {source && (
            <span title={source} className="cursor-help opacity-50 hover:opacity-100">
              <Database className="h-3 w-3" />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          {isUnavailable ? (
            <span className="text-sm font-medium text-muted-foreground italic">Data unavailable</span>
          ) : (
            <span className="text-2xl font-bold tabular-nums">
              {typeof value === "number" ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}
              {suffix && <span className="text-sm font-normal text-muted-foreground ms-1">{suffix}</span>}
            </span>
          )}
          {delta && (
            <Badge variant={delta.value >= 0 ? "default" : "destructive"} className="text-xs">
              {delta.value >= 0 ? "+" : ""}{delta.value.toFixed(1)}% {delta.label}
            </Badge>
          )}
        </div>
        {state === "warning" && (
          <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Incomplete data
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// --- Warning Banner: displays warnings[] from every analytics response ---
export function WarningBanner({ warnings }: { warnings: string[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <Alert variant="default" className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-400 text-sm">Data Notes</AlertTitle>
      <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
        <ul className="list-disc ms-4 space-y-0.5">
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

// --- Limitations Notice: for D5 overdue-actions (CAPA/ChangeControl no dueDate) ---
export function LimitationsNotice({ limitations }: { limitations: Array<{ type: string; reason: string }> }) {
  if (!limitations || limitations.length === 0) return null;
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle className="text-sm">Limitations</AlertTitle>
      <AlertDescription className="text-xs space-y-1">
        {limitations.map((l, i) => (
          <p key={i}><Badge variant="outline" className="me-1.5 text-[10px]">{l.type}</Badge>{l.reason}</p>
        ))}
      </AlertDescription>
    </Alert>
  );
}

// --- Meta Footer: computedAt + sources + live badge ---
export function MetaFooter({ meta }: { meta: { computedAt: string; sources?: Record<string, string>; dataState?: string } }) {
  const t = useTranslations("analytics");
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground mt-4 pt-3 border-t">
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" /> {t("common.computedAt")}: {new Date(meta.computedAt).toLocaleString()}
      </span>
      <Badge variant="secondary" className="text-[10px] gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" /> {t("common.liveComputation")}
      </Badge>
    </div>
  );
}

// --- Loading Skeleton ---
export function AnalyticsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// --- Date Range Picker (preset-based) ---
export function DateRangePicker({ value, onChange }: {
  value: { fromDate: string; toDate: string };
  onChange: (v: { fromDate: string; toDate: string }) => void;
}) {
  const t = useTranslations("analytics");
  const applyPreset = (preset: string) => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date();
    if (preset === "7") from.setDate(from.getDate() - 7);
    else if (preset === "30") from.setDate(from.getDate() - 30);
    else if (preset === "90") from.setDate(from.getDate() - 90);
    onChange({ fromDate: from.toISOString().slice(0, 10), toDate: to });
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs">{t("dashboards.from")}</Label>
        <Input type="date" value={value.fromDate} onChange={(e) => onChange({ ...value, fromDate: e.target.value })} className="w-auto text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t("dashboards.to")}</Label>
        <Input type="date" value={value.toDate} onChange={(e) => onChange({ ...value, toDate: e.target.value })} className="w-auto text-xs" />
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => applyPreset("7")} className="text-xs">{t("dashboards.last7Days")}</Button>
        <Button size="sm" variant="outline" onClick={() => applyPreset("30")} className="text-xs">{t("dashboards.last30Days")}</Button>
        <Button size="sm" variant="outline" onClick={() => applyPreset("90")} className="text-xs">{t("dashboards.last90Days")}</Button>
      </div>
    </div>
  );
}

// --- Site Selector ---
export function SiteSelector({ sites, value, onChange }: {
  sites: Array<{ id: string; code: string; name: string }>;
  value: string; onChange: (v: string) => void;
}) {
  const t = useTranslations("analytics");
  return (
    <div className="space-y-1">
      <Label className="text-xs">{t("dashboards.selectSite")}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[240px] text-xs"><SelectValue placeholder={t("dashboards.selectSite")} /></SelectTrigger>
        <SelectContent>
          {sites.map((s) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.code} — {s.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// --- Page Header ---
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

// --- Error State ---
export function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <AlertTriangle className="h-8 w-8 mx-auto text-destructive mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
