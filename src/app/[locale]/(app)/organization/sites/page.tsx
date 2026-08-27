"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface SiteRow {
  id: string;
  code: string;
  name: string;
  timezone: string;
  status: string;
  isDemo: boolean;
  _count: { departments: number; employees: number };
}

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"];

export default function SitesPage() {
  const t = useTranslations("sites");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<SiteRow[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/org/sites", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as SiteRow[];
    },
  });

  const filtered = (data ?? []).filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q);
    const matchesStatus = !status || s.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<SiteRow>[] = [
    {
      key: "code",
      header: t("code"),
      render: (s) => <span className="font-mono text-xs">{s.code}</span>,
    },
    {
      key: "name",
      header: t("name"),
      render: (s) => <span className="text-xs">{s.name}</span>,
    },
    {
      key: "timezone",
      header: t("timezone"),
      render: (s) => (
        <span className="font-mono text-xs text-muted-foreground">
          {s.timezone}
        </span>
      ),
    },
    {
      key: "departments",
      header: t("departments"),
      render: (s) => <span className="text-xs">{s._count.departments}</span>,
    },
    {
      key: "employees",
      header: t("employees"),
      render: (s) => <span className="text-xs">{s._count.employees}</span>,
    },
    {
      key: "status",
      header: t("status"),
      render: (s) => <StatusBadge status={s.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<SiteRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={tCommon("search.placeholder")}
        filters={[
          {
            key: "status",
            label: t("status"),
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
        emptyState={<EmptyState icon={Building2} />}
      />
    </div>
  );
}
