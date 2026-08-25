"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ImpactPage() {
  const t = useTranslations("traceability");
  const [entityType, setEntityType] = useState("MATERIAL_LOT");
  const [entityId, setEntityId] = useState("");
  const [scenario, setScenario] = useState("RECALL");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const onAnalyze = async () => {
    if (!entityId) return;
    setLoading(true); setResult(null);
    const res = await fetch("/api/traceability/impact-analysis", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startEntityType: entityType, startEntityId: entityId, scenario }), credentials: "same-origin" });
    setLoading(false);
    if (res.ok) { const json = await res.json(); setResult(json.data); }
  };
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">{t("impact.title")}</h1><p className="text-sm text-muted-foreground">{t("impact.subtitle")}</p></div>
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">{t("impact.informationalOnly")}</div>
      <Card><CardHeader><CardTitle className="text-base">{t("impact.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="space-y-2"><Label>{t("trace.entityType")}</Label>
              <Select value={entityType} onValueChange={setEntityType}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{["MATERIAL_LOT","BATCH","DEVICE_LOT","WORK_ORDER","PRODUCT","MATERIAL"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{t("trace.entityId")}</Label><Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="cuid..." className="w-96" /></div>
            <div className="space-y-2"><Label>{t("impact.scenario")}</Label>
              <Select value={scenario} onValueChange={setScenario}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{["RECALL","QUARANTINE","DEVIATION","AUDIT"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button onClick={onAnalyze} disabled={loading || !entityId}>{loading ? "..." : t("impact.analyze")}</Button></div>
          </div>
          {result && (
            <div className="space-y-4 rounded-md border p-4">
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="default">{result.root.entityType}: {result.root.code}</Badge>
                <span className="text-muted-foreground">{result.summary.totalNodes} affected</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(result.summary.nodesByType).map(([type, count]: [string, any]) => (
                  <div key={type} className="rounded border p-2 text-center"><div className="text-lg font-bold">{count}</div><div className="text-xs text-muted-foreground">{type}</div></div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
