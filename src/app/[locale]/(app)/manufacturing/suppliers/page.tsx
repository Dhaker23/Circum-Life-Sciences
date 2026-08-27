"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusType } from "@/components/app/status-badge";

interface SupplierRow {
  id: string;
  code: string;
  name: string;
  qualificationStatus: string;
  status: string;
  isDemo: boolean;
  _count: { lots: number; materials: number };
}

const QUAL_OPTIONS = ["APPROVED", "CONDITIONAL", "DISQUALIFIED"];

const QUAL_TYPE: Record<string, StatusType> = {
  APPROVED: "success",
  CONDITIONAL: "warning",
  DISQUALIFIED: "error",
};

export default function SuppliersPage() {
  const t = useTranslations("manufacturing");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [qualification, setQualification] = useState("");

  const { data, isLoading } = useQuery<SupplierRow[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/manufacturing/suppliers?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as SupplierRow[];
    },
  });

  const filtered = (data ?? []).filter((s) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q);
    const matchesQual =
      !qualification || s.qualificationStatus === qualification;
    return matchesSearch && matchesQual;
  });

  const columns: Column<SupplierRow>[] = [
    {
      key: "code",
      header: t("suppliers.code"),
      render: (s) => <span className="font-mono text-xs">{s.code}</span>,
    },
    {
      key: "name",
      header: t("suppliers.name"),
      render: (s) => <span className="text-xs">{s.name}</span>,
    },
    {
      key: "qualificationStatus",
      header: t("suppliers.qualification"),
      render: (s) => (
        <StatusBadge
          status={s.qualificationStatus}
          type={QUAL_TYPE[s.qualificationStatus]}
        />
      ),
    },
    {
      key: "materials",
      header: t("suppliers.materials"),
      render: (s) => <span className="text-xs">{s._count.materials}</span>,
    },
    {
      key: "lots",
      header: t("suppliers.lots"),
      render: (s) => <span className="text-xs">{s._count.lots}</span>,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (qualification ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("suppliers.title")}
        subtitle={t("suppliers.subtitle")}
      />
      <DataTable<SupplierRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={tCommon("search.placeholder")}
        filters={[
          {
            key: "qualification",
            label: t("suppliers.qualification"),
            value: qualification,
            onChange: setQualification,
            options: QUAL_OPTIONS.map((q) => ({ value: q, label: q })),
          },
        ]}
        onResetFilters={() => {
          setSearch("");
          setQualification("");
        }}
        activeFilterCount={activeFilterCount}
        emptyState={<EmptyState icon={Truck} title={t("suppliers.noData")} />}
      />
    </div>
  );
}
