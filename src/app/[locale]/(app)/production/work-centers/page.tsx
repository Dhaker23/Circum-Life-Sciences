"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Factory } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface WorkCenterRow {
  id: string;
  code: string;
  name: string;
  status: string;
  isDemo: boolean;
  site: { code: string; name: string };
}

const STATUS_OPTIONS = ["ACTIVE", "INACTIVE"];

export default function WorkCentersPage() {
  const t = useTranslations("production");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<WorkCenterRow[]>({
    queryKey: ["work-centers"],
    queryFn: async () => {
      const res = await fetch("/api/production/work-centers?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as WorkCenterRow[];
    },
  });

  const filtered = (data ?? []).filter((wc) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      wc.code.toLowerCase().includes(q) ||
      wc.name.toLowerCase().includes(q);
    const matchesStatus = !status || wc.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<WorkCenterRow>[] = [
    {
      key: "code",
      header: t("workCenters.code"),
      render: (wc) => <span className="font-mono text-xs">{wc.code}</span>,
    },
    {
      key: "name",
      header: t("workCenters.name"),
      render: (wc) => <span className="text-xs">{wc.name}</span>,
    },
    {
      key: "site",
      header: t("workCenters.site"),
      render: (wc) => (
        <span className="text-xs">
          <span className="font-mono">{wc.site.code}</span>
          <span className="ms-2 text-muted-foreground">{wc.site.name}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (wc) => <StatusBadge status={wc.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("workCenters.title")}
        subtitle={t("workCenters.subtitle")}
      />
      <DataTable<WorkCenterRow>
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
        emptyState={<EmptyState icon={Factory} title={t("workCenters.noData")} />}
      />
    </div>
  );
}
