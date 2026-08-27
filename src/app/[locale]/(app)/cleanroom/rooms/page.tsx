"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Wind } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface CleanroomRow {
  id: string;
  code: string;
  name: string;
  classification: string | null;
  status: string;
  _count: { monitoringPoints: number };
}

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "DECOMMISSIONED"];

export default function CleanroomPage() {
  const t = useTranslations("cleanroom");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: CleanroomRow[];
    total: number;
  }>({
    queryKey: ["cleanrooms", page],
    queryFn: async () => {
      const res = await fetch(`/api/cleanroom/rooms?page=${page}&pageSize=20`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as CleanroomRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q);
    const matchesStatus = !status || c.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<CleanroomRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (c) => <span className="font-mono text-xs">{c.code}</span>,
    },
    {
      key: "name",
      header: tCommon("name"),
      render: (c) => <span className="text-sm">{c.name}</span>,
    },
    {
      key: "classification",
      header: t("classification"),
      render: (c) => (
        <span className="font-mono text-xs text-muted-foreground">
          {c.classification ?? "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (c) => <StatusBadge status={c.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<CleanroomRow>
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
        emptyState={<EmptyState icon={Wind} title={t("noData")} />}
      />
    </div>
  );
}
