"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ShiftsPage() {
  const t = useTranslations("production");
  const { data, isLoading } = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const res = await fetch("/api/production/shifts", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{ id: string; name: string; startTime: string; endTime: string; status: string; site: { code: string; name: string } }>;
    },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("shifts.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("shifts.subtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("shifts.title")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> :
           data && data.length > 0 ? (
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("shifts.name")}</TableHead>
                    <TableHead>{t("shifts.site")}</TableHead>
                    <TableHead>{t("shifts.hours")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-xs"><span className="font-mono">{s.site.code}</span><span className="ms-2 text-muted-foreground">{s.site.name}</span></TableCell>
                      <TableCell className="font-mono text-xs">{s.startTime} - {s.endTime}</TableCell>
                      <TableCell><Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : <p className="text-sm text-muted-foreground">{t("shifts.noData")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
