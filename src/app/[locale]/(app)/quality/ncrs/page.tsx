"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const NCR_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline", CONTAINMENT: "default", INVESTIGATION: "default", DISPOSITION: "secondary", CLOSED: "secondary", CANCELLED: "destructive",
};
const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  MINOR: "secondary", MAJOR: "default", CRITICAL: "destructive",
};

export default function NcrsPage() {
  const t = useTranslations("quality");
  const { data, isLoading } = useQuery({
    queryKey: ["ncrs"],
    queryFn: async () => {
      const res = await fetch("/api/quality/ncrs?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{ id: string; code: string; status: string; severity: string; concernsEntityType: string; description: string; site: { code: string } }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("ncrs.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ncrs.subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("ncrs.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("ncrs.code")}</TableHead>
                    <TableHead>{t("ncrs.severity")}</TableHead>
                    <TableHead>{t("ncrs.concerns")}</TableHead>
                    <TableHead>{t("ncrs.site")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="font-mono text-xs">{n.code}</TableCell>
                      <TableCell><Badge variant={SEVERITY_VARIANT[n.severity] ?? "outline"}>{n.severity}</Badge></TableCell>
                      <TableCell className="text-xs"><span className="font-mono">{n.concernsEntityType}</span><span className="ms-2 text-muted-foreground truncate">{n.description}</span></TableCell>
                      <TableCell className="font-mono text-xs">{n.site.code}</TableCell>
                      <TableCell><Badge variant={NCR_VARIANT[n.status] ?? "outline"}>{n.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("ncrs.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
