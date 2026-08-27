"use client";

import { useTranslations } from "next-intl";
import { Gauge, LineChart, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function OeePage() {
  const t = useTranslations("lean");

  return (
    <div className="space-y-6">
      <PageHeader title={t("oee.title")} subtitle={t("oee.subtitle")} />
      <Card>
        <CardContent className="flex flex-col gap-4 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Gauge className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground max-w-prose mx-auto">
            {t("oee.info")}
          </p>
          <ul className="mx-auto mt-2 flex flex-col gap-2 text-left text-sm">
            <li className="flex items-start gap-2">
              <LineChart className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>
                {t("oee.subtitle")} — Availability × Performance × Quality
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ListChecks className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span>
                Analytics → OEE dashboard provides live KPIs and trend analysis.
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
