"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingSkeleton } from "@/components/app/loading-skeleton";

interface ImpactResult {
  root: { entityType: string; code: string };
  summary: {
    totalNodes: number;
    nodesByType: Record<string, number>;
  };
}

const ENTITY_TYPES = [
  "MATERIAL_LOT",
  "BATCH",
  "DEVICE_LOT",
  "WORK_ORDER",
  "PRODUCT",
  "MATERIAL",
];

const SCENARIOS = ["RECALL", "QUARANTINE", "DEVIATION", "AUDIT"];

export default function ImpactPage() {
  const t = useTranslations("traceability");
  const tCommon = useTranslations("common");
  const [entityType, setEntityType] = useState("MATERIAL_LOT");
  const [entityId, setEntityId] = useState("");
  const [scenario, setScenario] = useState("RECALL");
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAnalyze = async () => {
    if (!entityId) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/traceability/impact-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startEntityType: entityType,
          startEntityId: entityId,
          scenario,
        }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Analysis failed");
      }
      const json = await res.json();
      setResult(json.data as ImpactResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("impact.title")} subtitle={t("impact.subtitle")} />

      <div
        role="note"
        className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground"
      >
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        />
        <span>{t("impact.informationalOnly")}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4" aria-hidden="true" />
            {t("impact.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="impact-entity-type">
                {t("trace.entityType")}
              </Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger id="impact-entity-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="impact-entity-id">{t("trace.entityId")}</Label>
              <Input
                id="impact-entity-id"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="cuid..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="impact-scenario">{t("impact.scenario")}</Label>
              <Select value={scenario} onValueChange={setScenario}>
                <SelectTrigger id="impact-scenario" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIOS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={onAnalyze}
              disabled={loading || !entityId}
              className="gap-2"
            >
              <Gauge className="h-4 w-4" aria-hidden="true" />
              {loading ? tCommon("loading") : t("impact.analyze")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="py-6">
            <LoadingSkeleton variant="card" count={4} />
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("impact.title")} — {result.summary.totalNodes} affected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusBadge
                status={`${result.root.entityType}: ${result.root.code}`}
                type="info"
              />
              <span className="text-muted-foreground">
                {result.summary.totalNodes} affected
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(result.summary.nodesByType).map(
                ([type, count]) => (
                  <div
                    key={type}
                    className="flex flex-col items-center justify-center gap-1 rounded-md border p-3 text-center"
                  >
                    <div className="text-2xl font-bold tabular-nums">
                      {count}
                    </div>
                    <div className="font-mono text-[10px] uppercase text-muted-foreground">
                      {type}
                    </div>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
