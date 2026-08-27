"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusType } from "@/components/app/status-badge";

interface TestResultRow {
  id: string;
  code: string;
  status: string;
  evaluatedResult: string | null;
  disposition: string | null;
  measuredValue: string | null;
  specification: { code: string; parameter: string };
}

const STATUS_OPTIONS = [
  "SAMPLE_RECEIVED",
  "IN_PROGRESS",
  "RESULT_ENTERED",
  "REVIEWED",
  "DISPOSITIONED",
];

const EVAL_TYPE: Record<string, StatusType> = {
  PASS: "success",
  FAIL: "error",
  NOT_EVALUABLE: "warning",
};

const DISPOSITION_TYPE: Record<string, StatusType> = {
  PASS_RELEASE: "success",
  CONDITIONAL_RELEASE: "warning",
  FAIL_HOLD: "warning",
  FAIL_REJECT: "error",
};

export default function TestResultsPage() {
  const t = useTranslations("lab");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<{
    data: TestResultRow[];
    total: number;
  }>({
    queryKey: ["test-results", page],
    queryFn: async () => {
      const res = await fetch(`/api/lab/test-results?page=${page}&pageSize=20`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as TestResultRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((r) => {
    const matchesSearch = r.code
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesStatus = !status || r.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<TestResultRow>[] = [
    {
      key: "code",
      header: t("results.code"),
      render: (r) => <span className="font-mono text-xs">{r.code}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "disposition",
      header: t("results.disposition"),
      render: (r) =>
        r.disposition ? (
          <StatusBadge
            status={r.disposition}
            type={DISPOSITION_TYPE[r.disposition]}
          />
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      key: "specification",
      header: t("results.spec"),
      render: (r) => (
        <span className="font-mono text-xs">{r.specification.code}</span>
      ),
    },
    {
      key: "measuredValue",
      header: t("results.measured"),
      render: (r) => (
        <span className="text-xs">{r.measuredValue ?? "-"}</span>
      ),
    },
    {
      key: "evaluatedResult",
      header: t("results.evaluated"),
      render: (r) =>
        r.evaluatedResult ? (
          <StatusBadge
            status={r.evaluatedResult}
            type={EVAL_TYPE[r.evaluatedResult]}
          />
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("results.title")} subtitle={t("results.subtitle")} />
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("results.evalGuard")}
      </div>
      <DataTable<TestResultRow>
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
          <EmptyState icon={ClipboardList} title={t("results.noData")} />
        }
      />
    </div>
  );
}
