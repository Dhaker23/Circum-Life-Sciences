"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusType } from "@/components/app/status-badge";

interface BatchRow {
  id: string;
  code: string;
  status: string;
  plannedQuantity: string;
  actualQuantity: string | null;
  unit: string;
  workOrder: { code: string };
  productRevision: {
    product: { code: string; name: string };
    revisionCode: string;
  };
  site: { code: string };
  _count: { deviceLots: number; executions: number; consumptions: number };
}

const STATUS_OPTIONS = [
  "PLANNED",
  "IN_PRODUCTION",
  "COMPLETED",
  "READY_FOR_REVIEW",
  "ON_HOLD",
];

const STATUS_TYPE: Record<string, StatusType> = {
  PLANNED: "pending",
  IN_PRODUCTION: "info",
  COMPLETED: "success",
  READY_FOR_REVIEW: "warning",
  ON_HOLD: "error",
};

export default function BatchesPage() {
  const t = useTranslations("production");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: BatchRow[];
    total: number;
  }>({
    queryKey: ["batches", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/production/batches?page=${page}&pageSize=20`,
        {
          credentials: "same-origin",
        },
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as BatchRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((b) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || b.code.toLowerCase().includes(q);
    const matchesStatus = !status || b.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<BatchRow>[] = [
    {
      key: "code",
      header: t("batches.code"),
      render: (b) => <span className="font-mono text-xs">{b.code}</span>,
    },
    {
      key: "workOrder",
      header: t("batches.workOrder"),
      render: (b) => (
        <span className="font-mono text-xs">{b.workOrder.code}</span>
      ),
    },
    {
      key: "product",
      header: t("batches.product"),
      render: (b) => (
        <span className="text-xs">
          <span className="font-mono">{b.productRevision.product.code}</span>{" "}
          {b.productRevision.revisionCode}
          <span className="ms-2 text-muted-foreground">
            {b.productRevision.product.name}
          </span>
        </span>
      ),
    },
    {
      key: "quantity",
      header: t("batches.quantity"),
      render: (b) => (
        <span className="text-xs">
          {b.actualQuantity ?? b.plannedQuantity} {b.unit}
        </span>
      ),
    },
    {
      key: "deviceLots",
      header: t("batches.deviceLots"),
      render: (b) => <span className="text-xs">{b._count.deviceLots}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (b) => (
        <StatusBadge status={b.status} type={STATUS_TYPE[b.status]} />
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("batches.title")} subtitle={t("batches.subtitle")} />
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("batches.stopsAt")}
      </div>
      <DataTable<BatchRow>
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
        emptyState={<EmptyState icon={Boxes} title={t("batches.noData")} />}
      />
    </div>
  );
}
