"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RolesPage() {
  const t = useTranslations("roles");
  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/identity/roles", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{
        id: string;
        systemKey: string;
        name: string;
        isSystem: boolean;
        permissions: { permission: { key: string; module: string } }[];
      }>;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : data ? (
            <div className="max-h-[32rem] space-y-3 overflow-auto">
              {data.map((r) => (
                <div key={r.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <Badge variant={r.isSystem ? "secondary" : "outline"} className="text-[10px]">
                        {r.isSystem ? t("systemRole") : t("customRole")}
                      </Badge>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{r.systemKey}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.permissions.map((p) => (
                      <Badge key={p.permission.key} variant="outline" className="font-mono text-[10px]">
                        {p.permission.key}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No roles</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
