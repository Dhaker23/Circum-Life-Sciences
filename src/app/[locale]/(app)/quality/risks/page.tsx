"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusType } from "@/components/app/status-badge";

interface RiskRow {
  id: string;
  code: string;
  subjectType: string;
  severity: number;
  probability: number;
  riskPriorityNumber: number;
  status: string;
}

const STATUS_OPTIONS = ["OPEN", "MITIGATED", "CLOSED"];

const SEVERITY_TYPE: Record<number, StatusType> = {
  1: "info",
  2: "info",
  3: "warning",
  4: "warning",
  5: "error",
};

const EMPTY_DATA: RiskRow[] = [];

function rpnType(rpn: number): StatusType {
  if (rpn >= 15) return "error";
  if (rpn >= 8) return "warning";
  return "info";
}

export default function RisksPage() {
  const t = useTranslations("quality");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const columns: Column<RiskRow>[] = [
    {
      key: "code",
      header: t("risks.code"),
      render: (r) => <span className="font-mono text-xs">{r.code}</span>,
    },
    {
      key: "subjectType",
      header: t("risks.subjectType"),
      render: (r) => <span className="font-mono text-xs">{r.subjectType}</span>,
    },
    {
      key: "severity",
      header: t("risks.severity"),
      render: (r) => (
        <StatusBadge
          status={String(r.severity)}
          type={SEVERITY_TYPE[r.severity] ?? "neutral"}
        />
      ),
    },
    {
      key: "probability",
      header: t("risks.probability"),
      render: (r) => <span className="font-mono text-xs">{r.probability}</span>,
    },
    {
      key: "riskPriorityNumber",
      header: t("risks.rpn"),
      render: (r) => (
        <StatusBadge
          status={String(r.riskPriorityNumber)}
          type={rpnType(r.riskPriorityNumber)}
        />
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("risks.title")} subtitle={t("risks.subtitle")} />
      <DataTable<RiskRow>
        columns={columns}
        data={EMPTY_DATA}
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
        emptyState={<EmptyState icon={ShieldAlert} title={t("risks.noData")} />}
      />
    </div>
  );
}
