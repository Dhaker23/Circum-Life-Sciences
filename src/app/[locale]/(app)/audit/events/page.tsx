"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AuditEventsPage() {
  const t = useTranslations("audit");
  const { data, isLoading } = useQuery({
    queryKey: ["audit-events"],
    queryFn: async () => {
      const res = await fetch("/api/audit/events?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{
        id: string;
        occurredAt: string;
        actorUserId: string | null;
        action: string;
        entityType: string;
        entityId: string | null;
        outcome: string;
        reason: string | null;
        ipAddress: string | null;
      }>;
    },
  });

  const OUTCOME_VARIANT: Record<string, string> = {
    SUCCESS: "text-emerald-600",
    FAILURE: "text-amber-600",
    DENIED: "text-destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <a href="/api/audit/export" className="inline-flex h-8 items-center rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted">
          {t("export")}
        </a>
      </div>
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("appendOnly")}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : data && data.length > 0 ? (
            <div className="max-h-[32rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{t("occurredAt")}</TableHead>
                    <TableHead>{t("action")}</TableHead>
                    <TableHead>{t("entity")}</TableHead>
                    <TableHead>{t("outcome")}</TableHead>
                    <TableHead>{t("reason")}</TableHead>
                    <TableHead>{t("ipAddress")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(e.occurredAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.action}</TableCell>
                      <TableCell className="text-xs">
                        {e.entityType}
                        {e.entityId ? ` / ${e.entityId.slice(-8)}` : ""}
                      </TableCell>
                      <TableCell className={`text-xs font-medium ${OUTCOME_VARIANT[e.outcome] ?? ""}`}>
                        {t(e.outcome.toLowerCase())}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {e.reason ?? "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {e.ipAddress ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No audit events</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
