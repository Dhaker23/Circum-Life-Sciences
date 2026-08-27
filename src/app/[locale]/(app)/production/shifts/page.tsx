"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface ShiftRow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  status: string;
  site: { code: string; name: string };
}

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"];

export default function ShiftsPage() {
  const t = useTranslations("production");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<ShiftRow[]>({
    queryKey: ["shifts"],
    queryFn: async () => {
      const res = await fetch("/api/production/shifts", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as ShiftRow[];
    },
  });

  const filtered = (data ?? []).filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || s.name.toLowerCase().includes(q);
    const matchesStatus = !status || s.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<ShiftRow>[] = [
    {
      key: "name",
      header: t("shifts.name"),
      render: (s) => <span className="text-xs font-medium">{s.name}</span>,
    },
    {
      key: "site",
      header: t("shifts.site"),
      render: (s) => (
        <span className="text-xs">
          <span className="font-mono">{s.site.code}</span>
          <span className="ms-2 text-muted-foreground">{s.site.name}</span>
        </span>
      ),
    },
    {
      key: "hours",
      header: t("shifts.hours"),
      render: (s) => (
        <span className="font-mono text-xs">
          {s.startTime} - {s.endTime}
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
      <PageHeader title={t("shifts.title")} subtitle={t("shifts.subtitle")} />
      <DataTable<ShiftRow>
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
        emptyState={<EmptyState icon={Clock} title={t("shifts.noData")} />}
      />
    </div>
  );
}
