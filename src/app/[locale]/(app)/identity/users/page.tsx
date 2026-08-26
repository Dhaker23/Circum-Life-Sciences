"use client";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersTable } from "@/components/app/users-table";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export default function UsersPage() {
  const t = useTranslations("users");
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/identity/users?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as Array<{
        id: string;
        email: string;
        name: string | null;
        status: string;
        lastSignInAt: string | null;
      }>;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t("createUser")}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : data && data.length > 0 ? (
            <UsersTable users={data} />
          ) : (
            <p className="text-sm text-muted-foreground">{t("noUsers")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
