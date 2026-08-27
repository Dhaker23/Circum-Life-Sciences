"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface PackagingRow {
  id: string;
  code: string;
  targetEntityType: string;
  targetEntityId: string;
  status: string;
  inspectionResult: string | null;
  equipment: { code: string; name: string } | null;
  operator: { fullName: string } | null;
}

const STATUS_OPTIONS = ["IN_PROGRESS", "COMPLETED", "FAILED"];

export default function PackagingPage() {
  const t = useTranslations("packaging");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<PackagingRow[]>({
    queryKey: ["packaging-records"],
    queryFn: async () => {
      const res = await fetch("/api/packaging/records?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as PackagingRow[];
    },
  });

  const filtered = (data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || p.code.toLowerCase().includes(q);
    const matchesStatus = !status || p.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<PackagingRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (p) => <span className="font-mono text-xs">{p.code}</span>,
    },
    {
      key: "target",
      header: t("target"),
      render: (p) => (
        <span className="text-xs">
          <span className="font-mono">{p.targetEntityType}</span>
          {p.targetEntityId ? (
            <span className="text-muted-foreground">
              {" "}
              / {p.targetEntityId.slice(-8)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (p) => <StatusBadge status={p.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<PackagingRow>
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
        emptyState={<EmptyState icon={Package} title={t("noData")} />}
      />
    </div>
  );
}
