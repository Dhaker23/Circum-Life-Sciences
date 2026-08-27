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

  const { data, isLoading } = useQuery<InspectionRow[]>({
    queryKey: ["inspections"],
    queryFn: async () => {
      const res = await fetch("/api/inspection/inspections?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as InspectionRow[];
    },
  });

  const filtered = (data ?? []).filter((i) => {
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
        onSearchChange={setSearch}
        searchPlaceholder={tCommon("search.placeholder")}
        filters={[
          {
            key: "status",
            label: tCommon("status"),
            value: status,
            onChange: setStatus,
            options: STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
          },
        ]}
        onResetFilters={() => {
          setSearch("");
          setStatus("");
        }}
        activeFilterCount={activeFilterCount}
        emptyState={
          <EmptyState icon={ClipboardCheck} title={t("noData")} />
        }
      />
    </div>
  );
}
