"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { TestTube } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface SampleRow {
  id: string;
  code: string;
  sourceEntityType: string;
  status: string;
  site: { code: string };
}

const STATUS_OPTIONS = [
  "DRAWN",
  "RECEIVED_IN_LAB",
  "IN_TEST",
  "CONSUMED",
  "RETAINED",
];

export default function SamplesPage() {
  const t = useTranslations("lab");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: SampleRow[];
    total: number;
  }>({
    queryKey: ["samples", page],
    queryFn: async () => {
      const res = await fetch(`/api/lab/samples?page=${page}&pageSize=20`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as SampleRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((s) => {
    const matchesSearch = s.code
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesStatus = !status || s.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<SampleRow>[] = [
    {
      key: "code",
      header: t("samples.code"),
      render: (s) => <span className="font-mono text-xs">{s.code}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (s) => <StatusBadge status={s.status} />,
    },
    {
      key: "sourceEntityType",
      header: t("samples.source"),
      render: (s) => (
        <span className="font-mono text-xs">{s.sourceEntityType}</span>
      ),
    },
    {
      key: "site",
      header: tCommon("site"),
      render: (s) => <span className="font-mono text-xs">{s.site.code}</span>,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("samples.title")} subtitle={t("samples.subtitle")} />
      <DataTable<SampleRow>
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
        emptyState={<EmptyState icon={TestTube} title={t("samples.noData")} />}
      />
    </div>
  );
}
