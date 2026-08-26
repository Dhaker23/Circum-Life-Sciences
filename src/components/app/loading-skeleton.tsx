"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Reusable loading skeleton with four variants:
 *  - "page": full-page skeleton (header + paragraph + a few lines)
 *  - "table": N rows of skeleton (default 5)
 *  - "card": grid of N skeleton cards (default 4)
 *  - "dashboard": 4 stat cards + 1 chart skeleton
 *
 * Use the existing shadcn/ui `Skeleton` primitive — no custom CSS.
 */
export type SkeletonVariant = "page" | "table" | "card" | "dashboard";

export interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  /** For "table" and "card" variants — number of items to render. Default 5 / 4. */
  count?: number;
  className?: string;
}

export function LoadingSkeleton({
  variant = "page",
  count,
  className,
}: LoadingSkeletonProps) {
  if (variant === "page") {
    return (
      <div className={cn("space-y-4", className)} aria-busy="true" aria-live="polite">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-2 pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (variant === "table") {
    const rows = count && count > 0 ? count : 5;
    return (
      <div
        className={cn("space-y-2", className)}
        aria-busy="true"
        aria-live="polite"
        role="status"
      >
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (variant === "card") {
    const cards = count && count > 0 ? count : 4;
    return (
      <div
        className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}
        aria-busy="true"
        aria-live="polite"
        role="status"
      >
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // variant === "dashboard"
  return (
    <div
      className={cn("space-y-4", className)}
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
