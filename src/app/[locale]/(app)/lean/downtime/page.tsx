"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { TimerOff } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface DowntimeRow {
  id: string;
  code: string;
  downtimeCategory: string;
  reason: string;
  durationMinutes: number | null;
  status: string;
  equipment: { code: string; name: string };
}

const STATUS_OPTIONS = ["OPEN", "CLOSED"];

export default function DowntimePage() {
  const t = useTranslations("lean");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: DowntimeRow[];
    total: number;
  }>({
    queryKey: ["downtime", page],
    queryFn: async () => {
      const res = await fetch(`/api/lean/downtime?page=${page}&pageSize=20`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as DowntimeRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || d.code.toLowerCase().includes(q);
    const matchesStatus = !status || d.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<DowntimeRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (d) => <span className="font-mono text-xs">{d.code}</span>,
    },
    {
      key: "equipment",
      header: t("downtime.equipment"),
      render: (d) => (
        <span className="font-mono text-xs">{d.equipment.code}</span>
      ),
    },
    {
      key: "downtimeCategory",
      header: t("downtime.category"),
      render: (d) => <span className="text-xs">{d.downtimeCategory}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: "durationMinutes",
      header: t("downtime.duration"),
      render: (d) => (
        <span className="text-xs text-muted-foreground">
          {d.durationMinutes ? `${d.durationMinutes}m` : "-"}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("downtime.title")}
        subtitle={t("downtime.subtitle")}
      />
      <DataTable<DowntimeRow>
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
        emptyState={<EmptyState icon={TimerOff} title={t("downtime.noData")} />}
      />
    </div>
  );
}
