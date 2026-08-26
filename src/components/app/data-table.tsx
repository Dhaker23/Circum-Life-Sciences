"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { LoadingSkeleton } from "./loading-skeleton";
import { FilterBar, type FilterConfig } from "./filter-bar";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Whether the column supports sort UI (caller is responsible for actual sorting). */
  sortable?: boolean;
  /** Optional sort direction indicator: "asc" | "desc" | undefined. */
  sortDirection?: "asc" | "desc";
  /** Called when the column header is clicked (only if sortable). */
  onSort?: () => void;
  className?: string;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}

export interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  onResetFilters?: () => void;
  activeFilterCount?: number;
  /** Custom empty state node. Defaults to <EmptyState />. */
  emptyState?: React.ReactNode;
  pagination?: DataTablePagination;
  onRowClick?: (row: T) => void;
  className?: string;
}

/**
 * Generic, typed data table with optional FilterBar, sticky header, scrollable
 * body, loading skeleton, empty state, and accessible pagination footer.
 *
 * The generic `T` must extend `{ id: string }` so rows have a stable React key.
 *
 * Sorting: columns with `sortable: true` get a sort affordance; the actual sort
 * logic is delegated to the caller (server-side or client-side) via `onSort`.
 */
export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  onResetFilters,
  activeFilterCount,
  emptyState,
  pagination,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const t = useTranslations("common");
  const showFilterBar =
    (typeof searchValue !== "undefined" && onSearchChange) || (filters && filters.length > 0);

  // Pagination math
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / Math.max(1, pagination.pageSize)))
    : 1;
  const currentPage = pagination ? Math.min(Math.max(1, pagination.page), totalPages) : 1;
  const canPrev = pagination ? currentPage > 1 : false;
  const canNext = pagination ? currentPage < totalPages : false;

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
    >
      {showFilterBar ? (
        <FilterBar
          searchValue={searchValue ?? ""}
          onSearchChange={onSearchChange ?? (() => undefined)}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          onReset={onResetFilters}
          activeFilterCount={activeFilterCount}
        />
      ) : null}

      <div className="rounded-md border bg-card">
        <div className="max-h-[32rem] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    scope="col"
                    className={cn(col.className)}
                    aria-sort={
                      col.sortable
                        ? col.sortDirection === "asc"
                          ? "ascending"
                          : col.sortDirection === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                  >
                    {col.sortable && col.onSort ? (
                      <button
                        type="button"
                        onClick={col.onSort}
                        className="inline-flex items-center gap-1 text-left font-medium hover:text-foreground"
                      >
                        <span>{col.header}</span>
                        <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden="true" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    <LoadingSkeleton variant="table" />
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    {emptyState ?? <EmptyState />}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(onRowClick && "cursor-pointer")}
                  >
                    {columns.map((col) => (
                      <TableCell key={col.key} className={cn(col.className)}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {pagination ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground"
          role="navigation"
          aria-label="pagination"
        >
          <span>
            {t("pagination.page")} {currentPage} {t("pagination.of")} {totalPages}{" "}
            <span className="text-muted-foreground/70">
              ({pagination.total} {t("pagination.total")})
            </span>
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(currentPage - 1)}
              disabled={!canPrev}
              aria-label={t("pagination.previous")}
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              <span className="hidden sm:inline">{t("pagination.previous")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => pagination.onPageChange(currentPage + 1)}
              disabled={!canNext}
              aria-label={t("pagination.next")}
            >
              <span className="hidden sm:inline">{t("pagination.next")}</span>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
