"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface SterilizationRow {
  id: string;
  code: string;
  processType: string;
  status: string;
  validationStatus: string;
  sterilizationLotCode: string | null;
  _count: { deviceLots: number };
}

const STATUS_OPTIONS = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "RELEASED",
  "REJECTED",
];

export default function SterilizationPage() {
  const t = useTranslations("sterilization");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: SterilizationRow[];
    total: number;
  }>({
    queryKey: ["sterilization-lots", page],
    queryFn: async () => {
      const res = await fetch(`/api/sterilization/lots?page=${page}&pageSize=20`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as SterilizationRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || s.code.toLowerCase().includes(q);
    const matchesStatus = !status || s.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<SterilizationRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (s) => <span className="font-mono text-xs">{s.code}</span>,
    },
    {
      key: "processType",
      header: t("method"),
      render: (s) => <span className="text-xs">{s.processType}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (s) => <StatusBadge status={s.status} />,
    },
    {
      key: "validationStatus",
      header: t("releaseStatus"),
      render: (s) => <StatusBadge status={s.validationStatus} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("releaseGuard")}
      </div>
      <DataTable<SterilizationRow>
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
        emptyState={<EmptyState icon={ShieldCheck} title={t("noData")} />}
      />
    </div>
  );
}
