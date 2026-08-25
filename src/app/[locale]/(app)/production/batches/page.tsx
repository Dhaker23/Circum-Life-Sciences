"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BATCH_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PLANNED: "outline", IN_PRODUCTION: "default", COMPLETED: "secondary", READY_FOR_REVIEW: "default", ON_HOLD: "destructive",
};

export default function BatchesPage() {
  const t = useTranslations("production");
  const { data, isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const res = await fetch("/api/production/batches?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{
        id: string; code: string; status: string; plannedQuantity: string; actualQuantity: string | null; unit: string;
        workOrder: { code: string };
        productRevision: { product: { code: string; name: string }; revisionCode: string };
        site: { code: string };
        _count: { deviceLots: number; executions: number; consumptions: number };
      }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("batches.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("batches.subtitle")}</p>
      </div>
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">{t("batches.stopsAt")}</div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("batches.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("batches.code")}</TableHead>
                    <TableHead>{t("batches.workOrder")}</TableHead>
                    <TableHead>{t("batches.product")}</TableHead>
                    <TableHead>{t("batches.quantity")}</TableHead>
                    <TableHead>{t("batches.deviceLots")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.code}</TableCell>
                      <TableCell className="font-mono text-xs">{b.workOrder.code}</TableCell>
                      <TableCell className="text-xs"><span className="font-mono">{b.productRevision.product.code}</span> {b.productRevision.revisionCode}</TableCell>
                      <TableCell className="text-xs">{b.actualQuantity ?? b.plannedQuantity} {b.unit}</TableCell>
                      <TableCell>{b._count.deviceLots}</TableCell>
                      <TableCell><Badge variant={BATCH_VARIANT[b.status] ?? "outline"}>{b.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("batches.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
