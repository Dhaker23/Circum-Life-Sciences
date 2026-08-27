"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface QueryLogRow {
  id: string;
  queryType: string;
  rootEntityType: string;
  scenario: string | null;
  executedAt: string;
  requester: { name: string | null; email: string } | null;
}

export default function QueryLogPage() {
  const t = useTranslations("traceability");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<QueryLogRow[]>({
    queryKey: ["traceability-query-log"],
    queryFn: async () => {
      const res = await fetch("/api/traceability/query-log?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as QueryLogRow[];
    },
  });

  const filtered = (data ?? []).filter((q) => {
    const q2 = search.trim().toLowerCase();
    return !q2 || q.queryType.toLowerCase().includes(q2);
  });

  const columns: Column<QueryLogRow>[] = [
    {
      key: "queryType",
      header: t("queryLog.action"),
      render: (q) => <StatusBadge status={q.queryType} type="info" />,
    },
    {
      key: "rootEntityType",
      header: t("queryLog.entityType"),
      render: (q) => (
        <span className="font-mono text-xs">{q.rootEntityType}</span>
      ),
    },
    {
      key: "executedAt",
      header: t("queryLog.occurredAt"),
      render: (q) => (
        <span className="text-xs text-muted-foreground">
          {new Date(q.executedAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "requester",
      header: t("queryLog.actor"),
      render: (q) => (
        <span className="text-xs">
          {q.requester?.name ?? q.requester?.email ?? "-"}
        </span>
      ),
    },
    {
      key: "scenario",
      header: t("queryLog.scenario"),
      render: (q) =>
        q.scenario ? (
          <StatusBadge status={q.scenario} type="neutral" />
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
  ];

  const activeFilterCount = search ? 1 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("queryLog.title")}
        subtitle={t("queryLog.subtitle")}
      />
      <DataTable<QueryLogRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={tCommon("search.placeholder")}
        onResetFilters={() => setSearch("")}
        activeFilterCount={activeFilterCount}
        emptyState={<EmptyState icon={History} title={t("queryLog.noData")} />}
      />
    </div>
  );
}
