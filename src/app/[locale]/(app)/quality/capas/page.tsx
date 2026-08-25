"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CAPA_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "outline", ACTION_PLAN: "default", IMPLEMENTATION: "default", EFFECTIVENESS: "secondary", CLOSED: "secondary",
};

export default function CapasPage() {
  const t = useTranslations("quality");
  const { data, isLoading } = useQuery({
    queryKey: ["capas"],
    queryFn: async () => {
      const res = await fetch("/api/quality/capas?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{ id: string; code: string; status: string; sourceType: string; type: string; investigation: { code: string } | null; site: { code: string } }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("capas.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("capas.subtitle")}</p>
      </div>
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">{t("capas.aiGuard")}</div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("capas.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("capas.code")}</TableHead>
                    <TableHead>{t("capas.source")}</TableHead>
                    <TableHead>{t("capas.type")}</TableHead>
                    <TableHead>{t("capas.investigation")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="text-xs font-mono">{c.sourceType}</TableCell>
                      <TableCell className="text-xs">{c.type}</TableCell>
                      <TableCell className="text-xs font-mono">{c.investigation?.code ?? "-"}</TableCell>
                      <TableCell><Badge variant={CAPA_VARIANT[c.status] ?? "outline"}>{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("capas.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
