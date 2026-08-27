"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { GitPullRequestArrow } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface ChangeRow {
  id: string;
  code: string;
  status: string;
  changeType: string;
  description: string;
}

const STATUS_OPTIONS = [
  "REQUEST",
  "IMPACT",
  "RISK",
  "APPROVAL",
  "IMPLEMENTATION",
  "VERIFICATION",
  "EFFECTIVENESS",
  "CLOSED",
  "REJECTED",
];

export default function ChangesPage() {
  const t = useTranslations("quality");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: ChangeRow[];
    total: number;
  }>({
    queryKey: ["changes", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/quality/changes?page=${page}&pageSize=20`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as ChangeRow[],
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

  const columns: Column<ChangeRow>[] = [
    {
      key: "code",
      header: t("changes.code"),
      render: (c) => <span className="font-mono text-xs">{c.code}</span>,
    },
    {
      key: "changeType",
      header: t("changes.type"),
      render: (c) => <span className="font-mono text-xs">{c.changeType}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "description",
      header: t("changes.detail.fields.description"),
      render: (c) => (
        <span
          className="block max-w-[24rem] truncate text-xs text-muted-foreground"
          title={c.description}
        >
          {c.description}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("changes.title")} subtitle={t("changes.subtitle")} />
      <DataTable<ChangeRow>
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
          <EmptyState icon={GitPullRequestArrow} title={t("changes.noData")} />
        }
        onRowClick={(c) => router.push(`/quality/changes/${c.id}`)}
      />
    </div>
  );
}
