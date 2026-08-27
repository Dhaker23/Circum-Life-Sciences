"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface WorkOrder {
  id: string;
  code: string;
  status: string;
  plannedQuantity: string;
  unit: string;
  createdAt: string;
  productRevision: {
    product: { code: string; name: string };
    revisionCode: string;
  };
  site: { code: string; name: string };
  _count: { batches: number };
}

const STATUS_OPTIONS = [
  "PLANNED",
  "RELEASED",
  "IN_PRODUCTION",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
  "ON_HOLD",
];

export default function WorkOrdersPage() {
  const t = useTranslations("production");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: WorkOrder[];
    total: number;
  }>({
    queryKey: ["work-orders", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/production/work-orders?page=${page}&pageSize=20`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as WorkOrder[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((wo) => {
    const matchesSearch = wo.code
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesStatus = !status || wo.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<WorkOrder>[] = [
    {
      key: "code",
      header: t("workOrders.code"),
      render: (wo) => <span className="font-mono text-xs">{wo.code}</span>,
    },
    {
      key: "product",
      header: t("workOrders.product"),
      render: (wo) => (
        <span className="text-xs">
          <span className="font-mono">{wo.productRevision.product.code}</span>{" "}
          {wo.productRevision.revisionCode}
          <span className="ms-2 text-muted-foreground">
            {wo.productRevision.product.name}
          </span>
        </span>
      ),
    },
    {
      key: "site",
      header: tCommon("site"),
      render: (wo) => <span className="font-mono text-xs">{wo.site.code}</span>,
    },
    {
      key: "quantity",
      header: t("workOrders.quantity"),
      render: (wo) => (
        <span className="text-xs">
          {wo.plannedQuantity} {wo.unit}
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (wo) => <StatusBadge status={wo.status} />,
    },
    {
      key: "createdAt",
      header: tCommon("createdAt"),
      render: (wo) => (
        <span className="text-xs text-muted-foreground">
          {new Date(wo.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("workOrders.title")} subtitle={t("workOrders.subtitle")} />
      <DataTable<WorkOrder>
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
        emptyState={
          <EmptyState
            icon={PackageSearch}
            title={t("workOrders.noData")}
          />
        }
      />
    </div>
  );
}
