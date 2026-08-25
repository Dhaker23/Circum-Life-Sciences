"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TracePage() {
  const t = useTranslations("traceability");
  const [entityType, setEntityType] = useState("DEVICE_LOT");
  const [entityId, setEntityId] = useState("");
  const [direction, setDirection] = useState("backward");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const onTrace = async () => {
    if (!entityId) return;
    setLoading(true); setResult(null);
    const endpoint = direction === "forward" ? "/api/traceability/forward-trace" : "/api/traceability/backward-trace";
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startEntityType: entityType, startEntityId: entityId }), credentials: "same-origin" });
    setLoading(false);
    if (res.ok) { const json = await res.json(); setResult(json.data); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">{t("trace.title")}</h1><p className="text-sm text-muted-foreground">{t("trace.subtitle")}</p></div>
      <Card><CardHeader><CardTitle className="text-base">{t("trace.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="space-y-2"><Label>{t("trace.entityType")}</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["MATERIAL_LOT","BATCH","DEVICE_LOT","WORK_ORDER","PRODUCT","PRODUCT_REVISION","MATERIAL","TEST_RESULT","INSPECTION","NCR"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{t("trace.entityId")}</Label><Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="cuid..." className="w-96" /></div>
            <div className="space-y-2"><Label>{t("trace.direction")}</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="backward">{t("trace.backward")}</SelectItem><SelectItem value="forward">{t("trace.forward")}</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex items-end"><Button onClick={onTrace} disabled={loading || !entityId}>{loading ? "..." : t("trace.trace")}</Button></div>
          </div>
          {result && (
            <div className="space-y-4 rounded-md border p-4">
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="default">{result.root.entityType}: {result.root.code}</Badge>
                <span className="text-muted-foreground">{result.summary.totalNodes} nodes</span>
                {result.authorizationLimited && <Badge variant="outline">{t("trace.authLimited")}</Badge>}
                {result.truncated && <Badge variant="secondary">{t("trace.truncated")}</Badge>}
              </div>
              <div className="max-h-96 overflow-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card"><tr><th className="p-2 text-left">Type</th><th className="p-2 text-left">Code</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Site</th></tr></thead>
                  <tbody>
                    {result.nodes.map((n: any, i: number) => (
                      <tr key={i} className="border-t"><td className="p-2 font-mono">{n.entityType}</td><td className="p-2 font-mono">{n.code}</td><td className="p-2">{n.status ?? "-"}</td><td className="p-2 font-mono">{n.siteCode ?? "-"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.boundaryMarkers?.length > 0 && <div className="rounded-md border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">{t("trace.boundaryNotice")}</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
