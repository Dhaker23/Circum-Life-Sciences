"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Consistent semantic status badge.
 *
 * The `status` string is the raw domain status (e.g. "CLOSED", "OPEN", "REJECTED").
 * The `type` (if provided) overrides inference and is used directly. Otherwise we
 * look up the status in a small mapping table; statuses not in the table fall
 * back to "neutral".
 *
 * Color palette (Tailwind, light + dark):
 *  - success  → emerald
 *  - warning  → amber
 *  - error    → red
 *  - info     → blue (allowed: informational use only, not as primary)
 *  - neutral  → slate
 *  - pending  → violet
 *
 * No indigo/blue primary colors are used — blue is restricted to the "info"
 * semantic, which is for low-prominence informational badges only.
 */
export type StatusType =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "pending";

export interface StatusBadgeProps {
  /** Raw domain status string (e.g. "CLOSED", "OPEN"). */
  status: string;
  /** Optional override; if provided, used directly instead of inferring from `status`. */
  type?: StatusType;
  className?: string;
}

const STATUS_TO_TYPE: Record<string, StatusType> = {
  // Success
  CLOSED: "success",
  APPROVED: "success",
  COMPLETED: "success",
  EFFECTIVE: "success",
  RELEASED: "success",
  // Pending / in-progress
  OPEN: "pending",
  DRAFT: "pending",
  PENDING: "pending",
  IN_PROGRESS: "pending",
  // Warning / on hold
  HOLD: "warning",
  REVIEW: "warning",
  ASSESSMENT: "warning",
  // Error / rejected
  REJECTED: "error",
  CANCELLED: "error",
  FAILED: "error",
};

const TYPE_CLASS: Record<StatusType, string> = {
  success:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  warning:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  error:
    "border-transparent bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  info:
    "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  neutral:
    "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-300",
  pending:
    "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
};

function inferType(status: string): StatusType {
  const key = String(status).toUpperCase();
  return STATUS_TO_TYPE[key] ?? "neutral";
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const resolvedType = type ?? inferType(status);
  const cls = TYPE_CLASS[resolvedType];
  return (
    <Badge variant="outline" className={cn(cls, className)}>
      {status}
    </Badge>
  );
}
