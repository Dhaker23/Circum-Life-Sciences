"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ProductsPage() {
  const t = useTranslations("manufacturing");
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/manufacturing/products?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{
        id: string; code: string; name: string; productType: string; deviceClass: string | null;
        status: string; isDemo: boolean; _count: { revisions: number };
      }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("products.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("products.subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("products.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("products.code")}</TableHead>
                    <TableHead>{t("products.name")}</TableHead>
                    <TableHead>{t("products.type")}</TableHead>
                    <TableHead>{t("products.deviceClass")}</TableHead>
                    <TableHead>{t("products.revisions")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="flex items-center gap-2">{p.name}{p.isDemo && <Badge variant="outline" className="text-[10px]">DEMO</Badge>}</TableCell>
                      <TableCell className="text-xs">{p.productType}</TableCell>
                      <TableCell className="text-xs">{p.deviceClass ?? "-"}</TableCell>
                      <TableCell>{p._count.revisions}</TableCell>
                      <TableCell><Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("products.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
