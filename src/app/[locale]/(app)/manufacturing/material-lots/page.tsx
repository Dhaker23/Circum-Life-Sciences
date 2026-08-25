"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LOT_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  RECEIVED: "secondary", QUARANTINE: "outline", APPROVED: "default", IN_USE: "default", EXHAUSTED: "secondary", REJECTED: "destructive",
};

export default function MaterialLotsPage() {
  const t = useTranslations("manufacturing");
  const { data, isLoading } = useQuery({
    queryKey: ["material-lots"],
    queryFn: async () => {
      const res = await fetch("/api/manufacturing/material-lots?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{
        id: string; lotCode: string; status: string; quantityReceived: string; quantityAvailable: string; unit: string;
        material: { code: string; name: string }; supplier: { code: string; name: string }; site: { code: string; name: string };
      }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("lots.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lots.subtitle")}</p>
      </div>
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">{t("lots.siteScoped")}</div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("lots.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("lots.lotCode")}</TableHead>
                    <TableHead>{t("lots.material")}</TableHead>
                    <TableHead>{t("lots.supplier")}</TableHead>
                    <TableHead>{t("lots.site")}</TableHead>
                    <TableHead>{t("lots.quantity")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.lotCode}</TableCell>
                      <TableCell className="text-xs"><span className="font-mono">{l.material.code}</span><span className="ms-2 text-muted-foreground">{l.material.name}</span></TableCell>
                      <TableCell className="text-xs">{l.supplier.code}</TableCell>
                      <TableCell className="text-xs font-mono">{l.site.code}</TableCell>
                      <TableCell className="text-xs">{l.quantityAvailable} / {l.quantityReceived} {l.unit}</TableCell>
                      <TableCell><Badge variant={LOT_STATUS_VARIANT[l.status] ?? "outline"}>{l.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("lots.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
