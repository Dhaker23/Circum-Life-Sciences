"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Network, Search } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { LoadingSkeleton } from "@/components/app/loading-skeleton";

interface TraceNode {
  entityType: string;
  code: string;
  status?: string | null;
  siteCode?: string | null;
}

interface TraceResult {
  root: { entityType: string; code: string };
  summary: { totalNodes: number };
  nodes: TraceNode[];
  authorizationLimited?: boolean;
  truncated?: boolean;
  boundaryMarkers?: unknown[];
}

const ENTITY_TYPES = [
  "MATERIAL_LOT",
  "BATCH",
  "DEVICE_LOT",
  "WORK_ORDER",
  "PRODUCT",
  "PRODUCT_REVISION",
  "MATERIAL",
  "TEST_RESULT",
  "INSPECTION",
  "NCR",
];

export default function TracePage() {
  const t = useTranslations("traceability");
  const tCommon = useTranslations("common");
  const [entityType, setEntityType] = useState("DEVICE_LOT");
  const [entityId, setEntityId] = useState("");
  const [direction, setDirection] = useState("backward");
  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTrace = async () => {
    if (!entityId) return;
    setLoading(true);
    setResult(null);
    setError(null);
    const endpoint =
      direction === "forward"
        ? "/api/traceability/forward-trace"
        : "/api/traceability/backward-trace";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startEntityType: entityType,
          startEntityId: entityId,
        }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "Trace failed");
      }
      const json = await res.json();
      setResult(json.data as TraceResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trace failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("trace.title")} subtitle={t("trace.subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4" aria-hidden="true" />
            {t("trace.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="trace-entity-type">{t("trace.entityType")}</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger id="trace-entity-type" className="w-full">
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
              <Label htmlFor="trace-entity-id">{t("trace.entityId")}</Label>
              <Input
                id="trace-entity-id"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="cuid..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trace-direction">{t("trace.direction")}</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger id="trace-direction" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backward">{t("trace.backward")}</SelectItem>
                  <SelectItem value="forward">{t("trace.forward")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={onTrace}
              disabled={loading || !entityId}
              className="gap-2"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              {loading ? tCommon("loading") : t("trace.trace")}
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
            <LoadingSkeleton variant="table" count={4} />
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("trace.title")} — {result.summary.totalNodes} nodes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusBadge
                status={`${result.root.entityType}: ${result.root.code}`}
                type="info"
              />
              <span className="text-muted-foreground">
                {result.summary.totalNodes} nodes
              </span>
              {result.authorizationLimited ? (
                <StatusBadge status={t("trace.authLimited")} type="warning" />
              ) : null}
              {result.truncated ? (
                <StatusBadge status={t("trace.truncated")} type="warning" />
              ) : null}
            </div>

            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("trace.entityType")}</TableHead>
                    <TableHead>{tCommon("code")}</TableHead>
                    <TableHead>{tCommon("status")}</TableHead>
                    <TableHead>{tCommon("site")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.nodes.map((n, i) => (
                    <TableRow key={`${n.entityType}-${n.code}-${i}`}>
                      <TableCell className="font-mono text-xs">
                        {n.entityType}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {n.code}
                      </TableCell>
                      <TableCell className="text-xs">
                        {n.status ?? "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {n.siteCode ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {result.boundaryMarkers && result.boundaryMarkers.length > 0 ? (
              <div className="rounded-md border border-dashed bg-muted/30 p-2 text-xs text-muted-foreground">
                {t("trace.boundaryNotice")}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
