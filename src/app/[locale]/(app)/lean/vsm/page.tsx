"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Workflow } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface VsmRow {
  id: string;
  code: string;
  name: string;
  status: string;
  totalLeadTimeMinutes: number | null;
  valueAddedRatio: string | null;
}

const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "EVALUATED", "ARCHIVED"];

export default function VsmPage() {
  const t = useTranslations("lean");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<VsmRow[]>({
    queryKey: ["vsm"],
    queryFn: async () => {
      const res = await fetch("/api/lean/vsm", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as VsmRow[];
    },
  });

  const filtered = (data ?? []).filter((v) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      v.code.toLowerCase().includes(q) ||
      v.name.toLowerCase().includes(q);
    const matchesStatus = !status || v.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<VsmRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (v) => <span className="font-mono text-xs">{v.code}</span>,
    },
    {
      key: "name",
      header: tCommon("name"),
      render: (v) => <span className="text-sm">{v.name}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (v) => <StatusBadge status={v.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("vsm.title")} subtitle={t("vsm.subtitle")} />
      <DataTable<VsmRow>
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
        emptyState={<EmptyState icon={Workflow} title={t("vsm.noData")} />}
      />
    </div>
  );
}
