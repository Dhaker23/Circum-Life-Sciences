"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusType } from "@/components/app/status-badge";

interface MaterialLotRow {
  id: string;
  lotCode: string;
  status: string;
  quantityReceived: string;
  quantityAvailable: string;
  unit: string;
  material: { code: string; name: string };
  supplier: { code: string; name: string };
  site: { code: string; name: string };
}

const STATUS_OPTIONS = [
  "RECEIVED",
  "QUARANTINE",
  "APPROVED",
  "IN_USE",
  "EXHAUSTED",
  "REJECTED",
];

// Use the StatusBadge type override for statuses not present in the default
// mapping table (e.g. RECEIVED, IN_USE, EXHAUSTED, QUARANTINE).
const STATUS_TYPE: Record<string, StatusType> = {
  RECEIVED: "info",
  QUARANTINE: "warning",
  APPROVED: "success",
  IN_USE: "success",
  EXHAUSTED: "neutral",
  REJECTED: "error",
};

export default function MaterialLotsPage() {
  const t = useTranslations("manufacturing");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: MaterialLotRow[];
    total: number;
  }>({
    queryKey: ["material-lots", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/manufacturing/material-lots?page=${page}&pageSize=20`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as MaterialLotRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((l) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || l.lotCode.toLowerCase().includes(q);
    const matchesStatus = !status || l.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<MaterialLotRow>[] = [
    {
      key: "lotCode",
      header: t("lots.lotCode"),
      render: (l) => <span className="font-mono text-xs">{l.lotCode}</span>,
    },
    {
      key: "material",
      header: t("lots.material"),
      render: (l) => (
        <span className="text-xs">
          <span className="font-mono">{l.material.code}</span>
          <span className="ms-2 text-muted-foreground">{l.material.name}</span>
        </span>
      ),
    },
    {
      key: "supplier",
      header: t("lots.supplier"),
      render: (l) => (
        <span className="text-xs">
          <span className="font-mono">{l.supplier.code}</span>
          <span className="ms-2 text-muted-foreground">{l.supplier.name}</span>
        </span>
      ),
    },
    {
      key: "site",
      header: tCommon("site"),
      render: (l) => <span className="font-mono text-xs">{l.site.code}</span>,
    },
    {
      key: "quantity",
      header: t("lots.quantity"),
      render: (l) => (
        <span className="text-xs">
          {l.quantityAvailable} / {l.quantityReceived} {l.unit}
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (l) => (
        <StatusBadge status={l.status} type={STATUS_TYPE[l.status]} />
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("lots.title")} subtitle={t("lots.subtitle")} />
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("lots.siteScoped")}
      </div>
      <DataTable<MaterialLotRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder={tCommon("search.placeholder")}
        filters={[
          {
            key: "status",
            label: tCommon("status"),
            value: status,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
            options: STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
          },
        ]}
        onResetFilters={() => {
          setSearch("");
          setStatus("");
          setPage(1);
        }}
        activeFilterCount={activeFilterCount}
        pagination={
          data
            ? {
                page,
                pageSize: 20,
                total: data.total,
                onPageChange: setPage,
              }
            : undefined
        }
        emptyState={<EmptyState icon={Layers} title={t("lots.noData")} />}
      />
    </div>
  );
}
