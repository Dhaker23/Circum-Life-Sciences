"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const WO_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PLANNED: "outline", RELEASED: "secondary", IN_PRODUCTION: "default", COMPLETED: "default", CLOSED: "secondary", CANCELLED: "destructive", ON_HOLD: "destructive",
};

export default function WorkOrdersPage() {
  const t = useTranslations("production");
  const { data, isLoading } = useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => {
      const res = await fetch("/api/production/work-orders?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{
        id: string; code: string; status: string; plannedQuantity: string; unit: string;
        productRevision: { product: { code: string; name: string }; revisionCode: string };
        site: { code: string; name: string };
        _count: { batches: number };
      }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("workOrders.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("workOrders.subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("workOrders.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("workOrders.code")}</TableHead>
                    <TableHead>{t("workOrders.product")}</TableHead>
                    <TableHead>{t("workOrders.site")}</TableHead>
                    <TableHead>{t("workOrders.quantity")}</TableHead>
                    <TableHead>{t("workOrders.batches")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell className="font-mono text-xs">{wo.code}</TableCell>
                      <TableCell className="text-xs"><span className="font-mono">{wo.productRevision.product.code}</span> {wo.productRevision.revisionCode}<span className="ms-2 text-muted-foreground">{wo.productRevision.product.name}</span></TableCell>
                      <TableCell className="font-mono text-xs">{wo.site.code}</TableCell>
                      <TableCell className="text-xs">{wo.plannedQuantity} {wo.unit}</TableCell>
                      <TableCell>{wo._count.batches}</TableCell>
                      <TableCell><Badge variant={WO_VARIANT[wo.status] ?? "outline"}>{wo.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("workOrders.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
