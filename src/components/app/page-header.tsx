"use client";

import * as React from "react";

/**
 * Standardized page header with title, subtitle, and optional actions slot.
 *
 * Strings are passed in by the caller (already i18n-resolved), so this component
 * does not call useTranslations() itself. Use this on every page for consistent
 * title/subtitle/actions layout.
 */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="flex flex-col gap-1 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
