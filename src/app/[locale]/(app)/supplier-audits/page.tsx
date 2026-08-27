"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Factory } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface SupplierAuditRow {
  id: string;
  code: string;
  auditType: string;
  status: string;
  result: string | null;
  qualificationImpact: string;
  supplier: { code: string; name: string };
  site: { code: string };
}

const STATUS_OPTIONS = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
];

export default function SupplierAuditsPage() {
  const t = useTranslations("supplierAudit");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<SupplierAuditRow[]>({
    queryKey: ["supplier-audits"],
    queryFn: async () => {
      const res = await fetch("/api/supplier-audits?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as SupplierAuditRow[];
    },
  });

  const filtered = (data ?? []).filter((a) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || a.code.toLowerCase().includes(q);
    const matchesStatus = !status || a.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<SupplierAuditRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (a) => <span className="font-mono text-xs">{a.code}</span>,
    },
    {
      key: "supplier",
      header: t("supplier"),
      render: (a) => (
        <span className="text-xs">
          <span className="font-mono">{a.supplier.code}</span>{" "}
          {a.supplier.name}
        </span>
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (a) => <StatusBadge status={a.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<SupplierAuditRow>
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
        emptyState={<EmptyState icon={Factory} title={t("noData")} />}
      />
    </div>
  );
}
