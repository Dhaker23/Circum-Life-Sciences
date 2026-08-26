"use client";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
export default function OeePage() {
  const t = useTranslations("lean");
  return (<div className="space-y-6"><div><h1 className="text-2xl font-bold tracking-tight">{t("oee.title")}</h1><p className="text-sm text-muted-foreground">{t("oee.subtitle")}</p></div><Card><CardContent><p className="py-8 text-center text-sm text-muted-foreground">OEE computation API ready. Dashboard UI in Phase 11.</p></CardContent></Card></div>);
}
