"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface SpecificationRow {
  id: string;
  code: string;
  name: string;
  parameter: string;
  criterionType: string;
  criterionValue: string;
  status: string;
}

const STATUS_OPTIONS = ["DRAFT", "APPROVED", "EFFECTIVE", "SUPERSEDED"];

export default function SpecificationsPage() {
  const t = useTranslations("lab");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<SpecificationRow[]>({
    queryKey: ["specifications"],
    queryFn: async () => {
      const res = await fetch("/api/lab/specifications?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as SpecificationRow[];
    },
  });

  const filtered = (data ?? []).filter((s) => {
    const matchesSearch = s.code
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesStatus = !status || s.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<SpecificationRow>[] = [
    {
      key: "code",
      header: t("specs.code"),
      render: (s) => <span className="font-mono text-xs">{s.code}</span>,
    },
    {
      key: "parameter",
      header: t("specs.parameter"),
      render: (s) => (
        <span className="text-xs">
          <span className="font-medium">{s.parameter}</span>
          <span className="ms-2 text-muted-foreground">{s.name}</span>
        </span>
      ),
    },
    {
      key: "criterionType",
      header: t("specs.criterionType"),
      render: (s) => (
        <span className="font-mono text-xs">
          {s.criterionType}: {s.criterionValue}
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (s) => <StatusBadge status={s.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("specs.title")} subtitle={t("specs.subtitle")} />
      <DataTable<SpecificationRow>
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
        emptyState={<EmptyState icon={FlaskConical} title={t("specs.noData")} />}
      />
    </div>
  );
}
