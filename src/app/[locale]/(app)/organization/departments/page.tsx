"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";

interface DepartmentRow {
  id: string;
  code: string;
  name: string;
  site: { code: string; name: string };
}

export default function DepartmentsPage() {
  const t = useTranslations("departments");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<DepartmentRow[]>({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/org/departments", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as DepartmentRow[];
    },
  });

  const filtered = (data ?? []).filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      d.code.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q);
    return matchesSearch;
  });

  const columns: Column<DepartmentRow>[] = [
    {
      key: "code",
      header: t("code"),
      render: (d) => <span className="font-mono text-xs">{d.code}</span>,
    },
    {
      key: "name",
      header: t("name"),
      render: (d) => <span className="text-xs">{d.name}</span>,
    },
    {
      key: "site",
      header: t("site"),
      render: (d) => (
        <span className="text-xs">
          <span className="font-mono">{d.site.code}</span>
          <span className="ms-2 text-muted-foreground">{d.site.name}</span>
        </span>
      ),
    },
  ];

  const activeFilterCount = search ? 1 : 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<DepartmentRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={tCommon("search.placeholder")}
        onResetFilters={() => setSearch("")}
        activeFilterCount={activeFilterCount}
        emptyState={<EmptyState icon={Network} />}
      />
    </div>
  );
}
