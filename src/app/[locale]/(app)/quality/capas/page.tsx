"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface CapaRow {
  id: string;
  code: string;
  status: string;
  sourceType: string;
  type: string;
  createdAt: string;
  investigation: { code: string } | null;
  site: { code: string };
}

const STATUS_OPTIONS = [
  "OPEN",
  "ACTION_PLAN",
  "IMPLEMENTATION",
  "EFFECTIVENESS",
  "CLOSED",
];

export default function CapasPage() {
  const t = useTranslations("quality");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: CapaRow[];
    total: number;
  }>({
    queryKey: ["capas", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/quality/capas?page=${page}&pageSize=20`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as CapaRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((c) => {
    const matchesSearch = c.code
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesStatus = !status || c.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<CapaRow>[] = [
    {
      key: "code",
      header: t("capas.code"),
      render: (c) => <span className="font-mono text-xs">{c.code}</span>,
    },
    {
      key: "type",
      header: t("capas.type"),
      render: (c) => <span className="text-xs">{c.type}</span>,
    },
    {
      key: "sourceType",
      header: t("capas.source"),
      render: (c) => <span className="font-mono text-xs">{c.sourceType}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "site",
      header: tCommon("site"),
      render: (c) => <span className="font-mono text-xs">{c.site.code}</span>,
    },
    {
      key: "createdAt",
      header: tCommon("createdAt"),
      render: (c) => (
        <span className="text-xs text-muted-foreground">
          {new Date(c.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("capas.title")} subtitle={t("capas.subtitle")} />
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("capas.aiGuard")}
      </div>
      <DataTable<CapaRow>
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
        emptyState={<EmptyState icon={ClipboardCheck} title={t("capas.noData")} />}
        onRowClick={(c) => router.push(`/quality/capas/${c.id}`)}
      />
    </div>
  );
}
