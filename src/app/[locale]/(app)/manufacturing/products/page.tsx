"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface ProductRow {
  id: string;
  code: string;
  name: string;
  productType: string;
  deviceClass: string | null;
  status: string;
  isDemo: boolean;
  _count: { revisions: number };
}

const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "INACTIVE"];

export default function ProductsPage() {
  const t = useTranslations("manufacturing");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<ProductRow[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/manufacturing/products?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as ProductRow[];
    },
  });

  const filtered = (data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q);
    const matchesStatus = !status || p.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<ProductRow>[] = [
    {
      key: "code",
      header: t("products.code"),
      render: (p) => <span className="font-mono text-xs">{p.code}</span>,
    },
    {
      key: "name",
      header: t("products.name"),
      render: (p) => <span className="text-xs">{p.name}</span>,
    },
    {
      key: "productType",
      header: t("products.type"),
      render: (p) => <span className="text-xs">{p.productType}</span>,
    },
    {
      key: "deviceClass",
      header: t("products.deviceClass"),
      render: (p) => (
        <span className="text-xs text-muted-foreground">
          {p.deviceClass ?? "-"}
        </span>
      ),
    },
    {
      key: "revisions",
      header: t("products.revisions"),
      render: (p) => <span className="text-xs">{p._count.revisions}</span>,
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
      <PageHeader
        title={t("products.title")}
        subtitle={t("products.subtitle")}
      />
      <DataTable<ProductRow>
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
        emptyState={<EmptyState icon={Package} title={t("products.noData")} />}
      />
    </div>
  );
}
