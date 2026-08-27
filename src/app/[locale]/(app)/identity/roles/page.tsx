"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";

interface RoleRow {
  id: string;
  systemKey: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  status: string;
  permissions: { permission: { key: string; module: string } }[];
}

export default function RolesPage() {
  const t = useTranslations("roles");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: RoleRow[];
    total: number;
  }>({
    queryKey: ["roles", page],
    queryFn: async () => {
      const res = await fetch(`/api/identity/roles?page=${page}&pageSize=20`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as RoleRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.systemKey.toLowerCase().includes(q);
    return matchesSearch;
  });

  const columns: Column<RoleRow>[] = [
    {
      key: "name",
      header: t("role"),
      render: (r) => (
        <span className="flex items-center gap-2 text-sm">
          {r.name}
          <Badge variant={r.isSystem ? "secondary" : "outline"} className="text-[10px]">
            {r.isSystem ? t("systemRole") : t("customRole")}
          </Badge>
        </span>
      ),
    },
    {
      key: "systemKey",
      header: t("systemKey"),
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.systemKey}
        </span>
      ),
    },
    {
      key: "permissions",
      header: t("permissions"),
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.permissions.length}
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const activeFilterCount = search ? 1 : 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<RoleRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder={tCommon("search.placeholder")}
        onResetFilters={() => {
          setSearch("");
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
