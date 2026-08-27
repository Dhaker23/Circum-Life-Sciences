"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Cog } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusType } from "@/components/app/status-badge";

interface EquipmentRow {
  id: string;
  code: string;
  name: string;
  equipmentType: string;
  operationalStatus: string;
  calibrationStatus: string;
  workCenter: { code: string; name: string } | null;
  site: { code: string };
}

const OPERATIONAL_OPTIONS = ["OPERATIONAL", "MAINTENANCE", "OUT_OF_SERVICE"];

const OP_STATUS_TYPE: Record<string, StatusType> = {
  OPERATIONAL: "success",
  MAINTENANCE: "warning",
  OUT_OF_SERVICE: "error",
};

const CAL_STATUS_TYPE: Record<string, StatusType> = {
  VALID: "success",
  EXPIRING: "warning",
  EXPIRED: "error",
  OUT_OF_SERVICE: "error",
};

export default function EquipmentPage() {
  const t = useTranslations("equipment");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [operational, setOperational] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: EquipmentRow[];
    total: number;
  }>({
    queryKey: ["equipment", page],
    queryFn: async () => {
      const res = await fetch(`/api/equipment?page=${page}&pageSize=20`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as EquipmentRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((e) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      e.code.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q);
    const matchesOp = !operational || e.operationalStatus === operational;
    return matchesSearch && matchesOp;
  });

  const columns: Column<EquipmentRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (e) => <span className="font-mono text-xs">{e.code}</span>,
    },
    {
      key: "name",
      header: tCommon("name"),
      render: (e) => <span className="text-xs">{e.name}</span>,
    },
    {
      key: "equipmentType",
      header: "Type",
      render: (e) => <span className="text-xs">{e.equipmentType}</span>,
    },
    {
      key: "site",
      header: tCommon("site"),
      render: (e) => <span className="font-mono text-xs">{e.site.code}</span>,
    },
    {
      key: "operationalStatus",
      header: "Op. Status",
      render: (e) => (
        <StatusBadge
          status={e.operationalStatus}
          type={OP_STATUS_TYPE[e.operationalStatus]}
        />
      ),
    },
    {
      key: "calibrationStatus",
      header: "Cal. Status",
      render: (e) => (
        <StatusBadge
          status={e.calibrationStatus}
          type={CAL_STATUS_TYPE[e.calibrationStatus]}
        />
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (operational ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<EquipmentRow>
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
            key: "operational",
            label: tCommon("status"),
            value: operational,
            onChange: (v) => {
              setOperational(v);
              setPage(1);
            },
            options: OPERATIONAL_OPTIONS.map((o) => ({
              value: o,
              label: o,
            })),
          },
        ]}
        onResetFilters={() => {
          setSearch("");
          setOperational("");
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
        emptyState={<EmptyState icon={Cog} />}
      />
    </div>
  );
}
