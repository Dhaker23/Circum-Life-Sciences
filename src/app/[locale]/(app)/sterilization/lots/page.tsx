"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface SterilizationRow {
  id: string;
  code: string;
  processType: string;
  status: string;
  validationStatus: string;
  sterilizationLotCode: string | null;
  _count: { deviceLots: number };
}

const STATUS_OPTIONS = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "RELEASED",
  "REJECTED",
];

export default function SterilizationPage() {
  const t = useTranslations("sterilization");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<SterilizationRow[]>({
    queryKey: ["sterilization-lots"],
    queryFn: async () => {
      const res = await fetch("/api/sterilization/lots?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as SterilizationRow[];
    },
  });

  const filtered = (data ?? []).filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || s.code.toLowerCase().includes(q);
    const matchesStatus = !status || s.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<SterilizationRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (s) => <span className="font-mono text-xs">{s.code}</span>,
    },
    {
      key: "processType",
      header: t("method"),
      render: (s) => <span className="text-xs">{s.processType}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (s) => <StatusBadge status={s.status} />,
    },
    {
      key: "validationStatus",
      header: t("releaseStatus"),
      render: (s) => <StatusBadge status={s.validationStatus} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("releaseGuard")}
      </div>
      <DataTable<SterilizationRow>
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
        emptyState={<EmptyState icon={ShieldCheck} title={t("noData")} />}
      />
    </div>
  );
}
