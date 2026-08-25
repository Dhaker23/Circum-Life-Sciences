"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function WorkCentersPage() {
  const t = useTranslations("production");
  const { data, isLoading } = useQuery({
    queryKey: ["work-centers"],
    queryFn: async () => {
      const res = await fetch("/api/production/work-centers?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{ id: string; code: string; name: string; status: string; isDemo: boolean; site: { code: string; name: string } }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("workCenters.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("workCenters.subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("workCenters.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("workCenters.code")}</TableHead>
                    <TableHead>{t("workCenters.name")}</TableHead>
                    <TableHead>{t("workCenters.site")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((wc) => (
                    <TableRow key={wc.id}>
                      <TableCell className="font-mono text-xs">{wc.code}</TableCell>
                      <TableCell className="flex items-center gap-2">{wc.name}{wc.isDemo && <Badge variant="outline" className="text-[10px]">DEMO</Badge>}</TableCell>
                      <TableCell className="text-xs"><span className="font-mono">{wc.site.code}</span><span className="ms-2 text-muted-foreground">{wc.site.name}</span></TableCell>
                      <TableCell><Badge variant={wc.status === "ACTIVE" ? "default" : "secondary"}>{wc.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("workCenters.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
