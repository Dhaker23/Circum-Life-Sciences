"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Microscope } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface InvestigationRow {
  id: string;
  code: string;
  sourceType: string;
  status: string;
  methodology: string;
}

const STATUS_OPTIONS = ["IN_PROGRESS", "CONCLUDED"];

const EMPTY_DATA: InvestigationRow[] = [];

export default function InvestigationsPage() {
  const t = useTranslations("quality");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const columns: Column<InvestigationRow>[] = [
    {
      key: "code",
      header: t("investigations.code"),
      render: (i) => <span className="font-mono text-xs">{i.code}</span>,
    },
    {
      key: "sourceType",
      header: t("investigations.source"),
      render: (i) => <span className="font-mono text-xs">{i.sourceType}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (i) => <StatusBadge status={i.status} />,
    },
    {
      key: "methodology",
      header: t("investigations.methodology"),
      render: (i) => (
        <span
          className="block max-w-[24rem] truncate text-xs text-muted-foreground"
          title={i.methodology}
        >
          {i.methodology}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("investigations.title")}
        subtitle={t("investigations.subtitle")}
      />
      <DataTable<InvestigationRow>
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
        emptyState={
          <EmptyState icon={Microscope} title={t("investigations.noData")} />
        }
      />
    </div>
  );
}
