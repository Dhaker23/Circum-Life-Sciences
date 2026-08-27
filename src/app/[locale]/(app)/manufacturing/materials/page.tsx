"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface MaterialRow {
  id: string;
  code: string;
  name: string;
  materialType: string;
  defaultUnit: string;
  status: string;
  isDemo: boolean;
  _count: { lots: number };
}

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"];

export default function MaterialsPage() {
  const t = useTranslations("manufacturing");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: MaterialRow[];
    total: number;
  }>({
    queryKey: ["materials", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/manufacturing/materials?page=${page}&pageSize=20`,
        {
          credentials: "same-origin",
        },
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as MaterialRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((m) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.code.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q);
    const matchesStatus = !status || m.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<MaterialRow>[] = [
    {
      key: "code",
      header: t("materials.code"),
      render: (m) => <span className="font-mono text-xs">{m.code}</span>,
    },
    {
      key: "name",
      header: t("materials.name"),
      render: (m) => <span className="text-xs">{m.name}</span>,
    },
    {
      key: "materialType",
      header: t("materials.type"),
      render: (m) => <span className="text-xs">{m.materialType}</span>,
    },
    {
      key: "defaultUnit",
      header: t("materials.unit"),
      render: (m) => (
        <span className="font-mono text-xs text-muted-foreground">
          {m.defaultUnit}
        </span>
      ),
    },
    {
      key: "lots",
      header: t("materials.lots"),
      render: (m) => <span className="text-xs">{m._count.lots}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (m) => <StatusBadge status={m.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("materials.title")}
        subtitle={t("materials.subtitle")}
      />
      <DataTable<MaterialRow>
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
        emptyState={<EmptyState icon={Boxes} title={t("materials.noData")} />}
      />
    </div>
  );
}
