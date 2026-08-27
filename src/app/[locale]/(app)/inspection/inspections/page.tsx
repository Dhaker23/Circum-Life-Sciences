"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusType } from "@/components/app/status-badge";

interface InspectionRow {
  id: string;
  code: string;
  inspectionType: string;
  status: string;
  evaluatedResult: string | null;
  sourceEntityType: string;
}

const STATUS_OPTIONS = ["PENDING", "PASSED", "FAILED", "CONDITIONAL"];

const EVAL_TYPE: Record<string, StatusType> = {
  PASS: "success",
  FAIL: "error",
  CONDITIONAL: "warning",
};

export default function InspectionsPage() {
  const t = useTranslations("inspection");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: InspectionRow[];
    total: number;
  }>({
    queryKey: ["inspections", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/inspection/inspections?page=${page}&pageSize=20`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as InspectionRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((i) => {
    const matchesSearch = i.code
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesStatus = !status || i.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<InspectionRow>[] = [
    {
      key: "code",
      header: t("code"),
      render: (i) => <span className="font-mono text-xs">{i.code}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: "evaluatedResult",
      header: t("evaluated"),
      render: (i) =>
        i.evaluatedResult ? (
          <StatusBadge
            status={i.evaluatedResult}
            type={EVAL_TYPE[i.evaluatedResult]}
          />
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<InspectionRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder={tCommon("search.placeholder")}
        filters={[
          {
            key: "status",
            label: tCommon("status"),
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
          },
        ]}
        onResetFilters={() => {
          setSearch("");
          setStatus("");
          setPage(1);
        }}
        activeFilterCount={activeFilterCount}
        pagination={
          data
            ? {
                page,
                pageSize: 20,
                total: data.total,
                onPageChange: setPage,
              }
            : undefined
        }
        emptyState={
          <EmptyState icon={ClipboardCheck} title={t("noData")} />
        }
      />
    </div>
  );
}
