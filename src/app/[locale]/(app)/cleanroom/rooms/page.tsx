"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Wind } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface CleanroomRow {
  id: string;
  code: string;
  name: string;
  classification: string | null;
  status: string;
  _count: { monitoringPoints: number };
}

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE", "DECOMMISSIONED"];

export default function CleanroomPage() {
  const t = useTranslations("cleanroom");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<CleanroomRow[]>({
    queryKey: ["cleanrooms"],
    queryFn: async () => {
      const res = await fetch("/api/cleanroom/rooms?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as CleanroomRow[];
    },
  });

  const filtered = (data ?? []).filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q);
    const matchesStatus = !status || c.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<CleanroomRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (c) => <span className="font-mono text-xs">{c.code}</span>,
    },
    {
      key: "name",
      header: tCommon("name"),
      render: (c) => <span className="text-sm">{c.name}</span>,
    },
    {
      key: "classification",
      header: t("classification"),
      render: (c) => (
        <span className="font-mono text-xs text-muted-foreground">
          {c.classification ?? "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (c) => <StatusBadge status={c.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<CleanroomRow>
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
        emptyState={<EmptyState icon={Wind} title={t("noData")} />}
      />
    </div>
  );
}
