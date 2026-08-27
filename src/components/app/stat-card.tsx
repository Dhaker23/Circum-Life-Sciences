"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ClipboardList,
  Package,
  ScrollText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * StatCard — KPI display card with icon, label, value, optional delta and link.
 *
 * Icon is passed as a STRING name (serializable across Server→Client boundary).
 * The icon is resolved locally via the ICON_REGISTRY below.
 *
 * Strings (label, delta.label) are passed in by the caller (already i18n-resolved),
 * so this component does not call useTranslations() itself.
 *
 * Accent variants only tint the icon container — the card body itself uses theme
 * tokens (bg-card / text-card-foreground) so no indigo/blue is used as a primary.
 */
export type StatCardAccent =
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "neutral";

export type StatCardIconName =
  | "alert-triangle"
  | "wrench"
  | "clipboard-list"
  | "scroll-text"
  | "users"
  | "building"
  | "shield-check"
  | "package"
  | "activity"
  | "trending-up"
  | "trending-down";

const ICON_REGISTRY: Record<StatCardIconName, LucideIcon> = {
  "alert-triangle": AlertTriangle,
  wrench: Wrench,
  "clipboard-list": ClipboardList,
  "scroll-text": ScrollText,
  users: Users,
  building: Building2,
  "shield-check": ShieldCheck,
  package: Package,
  activity: Activity,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
};

export interface StatCardDelta {
  /** Signed percentage change, e.g. +12 or -5. */
  value: number;
  /** Short label describing the comparison window, e.g. "vs last week". */
  label: string;
}

export interface StatCardProps {
  /** Icon name (serializable string, resolved via ICON_REGISTRY). */
  icon: StatCardIconName;
  label: string;
  value: string | number;
  delta?: StatCardDelta;
  href?: string;
  accent?: StatCardAccent;
}

const ACCENT_ICON_CLASS: Record<StatCardAccent, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  error: "bg-red-500/10 text-red-600 dark:text-red-400",
  neutral: "bg-muted text-muted-foreground",
};

export function StatCard({
  icon: iconName,
  label,
  value,
  delta,
  href,
  accent = "primary",
}: StatCardProps) {
  const iconClass = ACCENT_ICON_CLASS[accent];
  const isInteractive = Boolean(href);
  const Icon = ICON_REGISTRY[iconName] ?? AlertTriangle;

  const inner = (
    <Card
      className={cn(
        "h-full gap-0 py-0",
        isInteractive && "hover:shadow-md transition-shadow",
      )}
    >
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              iconClass,
            )}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                delta.value >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400",
              )}
              title={delta.label}
            >
              {delta.value >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              <span>
                {delta.value >= 0 ? "+" : ""}
                {delta.value}%
              </span>
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs text-muted-foreground truncate">{label}</span>
          <span className="text-2xl font-bold tabular-nums leading-none">
            {value}
          </span>
          {delta?.label ? (
            <span className="text-[10px] text-muted-foreground truncate">
              {delta.label}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  if (!isInteractive) {
    return inner;
  }

  return (
    <Link
      href={href as string}
      aria-label={`${label}: ${value}`}
      className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl"
    >
      {inner}
    </Link>
  );
}
