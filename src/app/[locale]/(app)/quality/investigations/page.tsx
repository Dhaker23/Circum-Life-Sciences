"use client";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function InvestigationsPage() {
  const t = useTranslations("quality");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("investigations.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("investigations.subtitle")}</p>
      </div>
      <Card><CardContent><p className="py-8 text-center text-sm text-muted-foreground">{t("investigations.noData")}</p></CardContent></Card>
    </div>
  );
}
