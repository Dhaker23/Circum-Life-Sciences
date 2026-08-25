"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DEV_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline", ASSESSMENT: "default", INVESTIGATION: "default", REVIEW: "secondary", CLOSED: "secondary", REJECTED: "destructive",
};

export default function DeviationsPage() {
  const t = useTranslations("quality");
  const { data, isLoading } = useQuery({
    queryKey: ["deviations"],
    queryFn: async () => {
      const res = await fetch("/api/quality/deviations?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{ id: string; code: string; status: string; appliesToEntityType: string; description: string; site: { code: string } }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("deviations.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("deviations.subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("deviations.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("deviations.code")}</TableHead>
                    <TableHead>{t("deviations.appliesTo")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.code}</TableCell>
                      <TableCell className="text-xs"><span className="font-mono">{d.appliesToEntityType}</span><span className="ms-2 text-muted-foreground truncate">{d.description}</span></TableCell>
                      <TableCell><Badge variant={DEV_VARIANT[d.status] ?? "outline"}>{d.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("deviations.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
