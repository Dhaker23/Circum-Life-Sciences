"use client";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
export default function BatchReviewPage() {
  const t = useTranslations("batchReview");
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1><p className="text-sm text-muted-foreground">{t("subtitle")}</p></div><div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">{t("dispositionGuard")}</div><Card><CardContent><p className="py-8 text-center text-sm text-muted-foreground">{t("noData")}</p></CardContent></Card></div>);
}
