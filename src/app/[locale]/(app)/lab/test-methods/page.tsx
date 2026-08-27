"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Beaker } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface TestMethodRow {
  id: string;
  code: string;
  name: string;
  status: string;
  _count?: { specs: number };
}

const STATUS_OPTIONS = ["DRAFT", "APPROVED", "EFFECTIVE", "SUPERSEDED"];

export default function TestMethodsPage() {
  const t = useTranslations("lab");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: TestMethodRow[];
    total: number;
  }>({
    queryKey: ["test-methods", page],
    queryFn: async () => {
      const res = await fetch(`/api/lab/test-methods?page=${page}&pageSize=20`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as TestMethodRow[],
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

  const columns: Column<TestMethodRow>[] = [
    {
      key: "code",
      header: t("methods.code"),
      render: (m) => <span className="font-mono text-xs">{m.code}</span>,
    },
    {
      key: "name",
      header: t("methods.name"),
      render: (m) => (
        <span className="text-xs">
          <span className="font-medium">{m.name}</span>
          {typeof m._count?.specs === "number" ? (
            <span className="ms-2 text-muted-foreground">
              ({m._count.specs} specs)
            </span>
          ) : null}
        </span>
      ),
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
      <PageHeader title={t("methods.title")} subtitle={t("methods.subtitle")} />
      <DataTable<TestMethodRow>
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
        emptyState={<EmptyState icon={Beaker} title={t("methods.noData")} />}
      />
    </div>
  );
}
