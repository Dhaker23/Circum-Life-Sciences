"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Standardized empty state. Use on list pages when there is no data to display.
 *
 * Falls back to the i18n "common.empty.noData" / "common.empty.noDataDescription"
 * strings when `title` is not provided, so callers can render `<EmptyState />`
 * without any props for a sensible default.
 */
export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const t = useTranslations("common.empty");

  const resolvedTitle = title ?? t("noData");
  const resolvedDescription = description ?? t("noDataDescription");

  return (
    <Card className="border-dashed bg-transparent shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        {Icon ? (
          <Icon className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        ) : null}
        <div className="flex flex-col gap-1">
          <p className="text-base font-medium">{resolvedTitle}</p>
          <p className="text-sm text-muted-foreground">{resolvedDescription}</p>
        </div>
        {action ? <div className="mt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
