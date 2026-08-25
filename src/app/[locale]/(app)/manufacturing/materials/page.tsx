"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function MaterialsPage() {
  const t = useTranslations("manufacturing");
  const { data, isLoading } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const res = await fetch("/api/manufacturing/materials?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{
        id: string; code: string; name: string; materialType: string; defaultUnit: string; status: string; isDemo: boolean;
        _count: { lots: number };
      }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("materials.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("materials.subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("materials.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("materials.code")}</TableHead>
                    <TableHead>{t("materials.name")}</TableHead>
                    <TableHead>{t("materials.type")}</TableHead>
                    <TableHead>{t("materials.unit")}</TableHead>
                    <TableHead>{t("materials.lots")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{m.code}</TableCell>
                      <TableCell className="flex items-center gap-2">{m.name}{m.isDemo && <Badge variant="outline" className="text-[10px]">DEMO</Badge>}</TableCell>
                      <TableCell className="text-xs">{m.materialType}</TableCell>
                      <TableCell className="text-xs">{m.defaultUnit}</TableCell>
                      <TableCell>{m._count.lots}</TableCell>
                      <TableCell><Badge variant={m.status === "ACTIVE" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("materials.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
