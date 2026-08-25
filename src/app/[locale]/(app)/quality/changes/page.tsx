"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CHG_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  REQUEST: "outline", IMPACT: "outline", RISK: "default", APPROVAL: "default", IMPLEMENTATION: "default", VERIFICATION: "secondary", EFFECTIVENESS: "secondary", CLOSED: "secondary", REJECTED: "destructive",
};

export default function ChangesPage() {
  const t = useTranslations("quality");
  const { data, isLoading } = useQuery({
    queryKey: ["changes"],
    queryFn: async () => {
      const res = await fetch("/api/quality/changes?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{ id: string; code: string; status: string; changeType: string; description: string }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("changes.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("changes.subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("changes.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("changes.code")}</TableHead>
                    <TableHead>{t("changes.type")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="text-xs"><span className="font-mono">{c.changeType}</span><span className="ms-2 text-muted-foreground truncate">{c.description}</span></TableCell>
                      <TableCell><Badge variant={CHG_VARIANT[c.status] ?? "outline"}>{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("changes.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
