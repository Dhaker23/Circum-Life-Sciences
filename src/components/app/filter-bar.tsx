"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
}

export interface FilterBarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  onReset?: () => void;
  /** Number of currently active filters — shows "{count} active" pill if > 0. */
  activeFilterCount?: number;
  className?: string;
}

/**
 * Reusable horizontal filter bar for list pages.
 *
 * Layout: [search Input with Search icon] [N filter Selects] [{count} active] [Reset]
 *
 * Wraps responsively on small screens via `flex-wrap`.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  onReset,
  activeFilterCount,
  className,
}: FilterBarProps) {
  const t = useTranslations("common");
  const placeholder = searchPlaceholder ?? t("search.placeholder");
  const hasActive = (activeFilterCount ?? 0) > 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        className,
      )}
    >
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="ps-9"
        />
      </div>

      {/* Filter selects */}
      {filters?.map((f) => (
        <Select
          key={f.key}
          value={f.value || "__all__"}
          onValueChange={(v) => f.onChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger
            size="sm"
            aria-label={f.label}
            className="min-w-[140px]"
          >
            <SelectValue placeholder={f.label}>
              {f.value
                ? (f.options.find((o) => o.value === f.value)?.label ?? f.label)
                : f.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{f.label}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Active count */}
      {hasActive ? (
        <span
          className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
          aria-live="polite"
        >
          {t("filters.active", { count: activeFilterCount ?? 0 })}
        </span>
      ) : null}

      {/* Reset */}
      {onReset ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={!hasActive}
          className="gap-1"
        >
          <X className="h-3.5 w-3.5" />
          {t("filters.reset")}
        </Button>
      ) : null}
    </div>
  );
}
