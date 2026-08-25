"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const QUAL_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  APPROVED: "default", CONDITIONAL: "secondary", DISQUALIFIED: "destructive",
};

export default function SuppliersPage() {
  const t = useTranslations("manufacturing");
  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/manufacturing/suppliers?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{
        id: string; code: string; name: string; qualificationStatus: string; status: string; isDemo: boolean;
        _count: { lots: number; materials: number };
      }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("suppliers.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("suppliers.subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("suppliers.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("suppliers.code")}</TableHead>
                    <TableHead>{t("suppliers.name")}</TableHead>
                    <TableHead>{t("suppliers.qualification")}</TableHead>
                    <TableHead>{t("suppliers.materials")}</TableHead>
                    <TableHead>{t("suppliers.lots")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.code}</TableCell>
                      <TableCell className="flex items-center gap-2">{s.name}{s.isDemo && <Badge variant="outline" className="text-[10px]">DEMO</Badge>}</TableCell>
                      <TableCell><Badge variant={QUAL_VARIANT[s.qualificationStatus] ?? "outline"}>{s.qualificationStatus}</Badge></TableCell>
                      <TableCell>{s._count.materials}</TableCell>
                      <TableCell>{s._count.lots}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("suppliers.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
