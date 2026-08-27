"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { GitBranch } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface DeviationRow {
  id: string;
  code: string;
  status: string;
  appliesToEntityType: string;
  description: string;
  site: { code: string };
}

const STATUS_OPTIONS = [
  "DRAFT",
  "ASSESSMENT",
  "INVESTIGATION",
  "REVIEW",
  "CLOSED",
  "REJECTED",
];

export default function DeviationsPage() {
  const t = useTranslations("quality");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<DeviationRow[]>({
    queryKey: ["deviations"],
    queryFn: async () => {
      const res = await fetch("/api/quality/deviations?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as DeviationRow[];
    },
  });

  const filtered = (data ?? []).filter((d) => {
    const matchesSearch = d.code
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesStatus = !status || d.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<DeviationRow>[] = [
    {
      key: "code",
      header: t("deviations.code"),
      render: (d) => <span className="font-mono text-xs">{d.code}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: "appliesToEntityType",
      header: t("deviations.appliesTo"),
      render: (d) => (
        <span className="font-mono text-xs">{d.appliesToEntityType}</span>
      ),
    },
    {
      key: "description",
      header: t("deviations.detail.fields.description"),
      render: (d) => (
        <span
          className="block max-w-[24rem] truncate text-xs text-muted-foreground"
          title={d.description}
        >
          {d.description}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("deviations.title")} subtitle={t("deviations.subtitle")} />
      <DataTable<DeviationRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={tCommon("search.placeholder")}
        filters={[
          {
            key: "status",
            label: tCommon("status"),
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
        emptyState={
          <EmptyState icon={GitBranch} title={t("deviations.noData")} />
        }
        onRowClick={(d) => router.push(`/quality/deviations/${d.id}`)}
      />
    </div>
  );
}
