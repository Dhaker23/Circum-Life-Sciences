"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/analytics";
import { TrendingUp, Activity, BarChart3, Cog, Repeat, ShieldCheck, ArrowRight } from "lucide-react";

const REPORTS = [
  { href: "/analytics/reports/oee-trend", icon: TrendingUp, key: "oeeTrend", desc: "Multi-series OEE/availability/performance/quality over time" },
  { href: "/analytics/reports/quality-trend", icon: Activity, key: "qualityTrend", desc: "FPY / scrap rate / rework rate trend over time" },
  { href: "/analytics/reports/downtime-pareto", icon: BarChart3, key: "downtimePareto", desc: "Downtime categories with cumulative percentage" },
  { href: "/analytics/reports/equipment-performance", icon: Cog, key: "equipmentPerformance", desc: "Per-equipment OEE breakdown" },
  { href: "/analytics/reports/recurrence", icon: Repeat, key: "recurrence", desc: "Recurring quality subjects and occurrence counts" },
  { href: "/analytics/reports/action-effectiveness", icon: ShieldCheck, key: "actionEffectiveness", desc: "Closed CAPAs with effectiveness outcome and recurrence" },
] as const;

export default function ReportsIndexPage() {
  const t = useTranslations("analytics");
  return (
    <div className="space-y-6">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6 flex items-start gap-3">
                <r.icon className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t(`reports.${r.key}`)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
