"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { FileWarning } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusType } from "@/components/app/status-badge";
import { QuickViewDrawer, type QuickViewField } from "@/components/app/quick-view-drawer";

interface NcrRow {
  id: string;
  code: string;
  status: string;
  severity: string;
  concernsEntityType: string;
  description: string;
  site: { code: string };
}

const STATUS_OPTIONS = [
  "DRAFT",
  "CONTAINMENT",
  "INVESTIGATION",
  "DISPOSITION",
  "CLOSED",
  "CANCELLED",
];

const SEVERITY_OPTIONS = ["MINOR", "MAJOR", "CRITICAL"];

const SEVERITY_TYPE: Record<string, StatusType> = {
  MINOR: "info",
  MAJOR: "warning",
  CRITICAL: "error",
};

export default function NcrsPage() {
  const t = useTranslations("quality");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{
    data: NcrRow[];
    total: number;
  }>({
    queryKey: ["ncrs", page],
    queryFn: async () => {
      const res = await fetch(
        `/api/quality/ncrs?page=${page}&pageSize=20`,
        { credentials: "same-origin" },
      );
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return {
        data: json.data as NcrRow[],
        total: (json.meta?.total as number | undefined) ?? 0,
      };
    },
  });

  const filtered = (data?.data ?? []).filter((n) => {
    const matchesSearch = n.code
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    const matchesStatus = !status || n.status === status;
    const matchesSeverity = !severity || n.severity === severity;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const columns: Column<NcrRow>[] = [
    {
      key: "code",
      header: t("ncrs.code"),
      render: (n) => <span className="font-mono text-xs">{n.code}</span>,
    },
    {
      key: "severity",
      header: t("ncrs.severity"),
      render: (n) => (
        <StatusBadge
          status={n.severity}
          type={SEVERITY_TYPE[n.severity]}
        />
      ),
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (n) => <StatusBadge status={n.status} />,
    },
    {
      key: "concernsEntityType",
      header: t("ncrs.concerns"),
      render: (n) => (
        <span className="font-mono text-xs">{n.concernsEntityType}</span>
      ),
    },
    {
      key: "description",
      header: t("ncrs.detail.fields.description"),
      render: (n) => (
        <span
          className="block max-w-[24rem] truncate text-xs text-muted-foreground"
          title={n.description}
        >
          {n.description}
        </span>
      ),
    },
    {
      key: "site",
      header: tCommon("site"),
      render: (n) => <span className="font-mono text-xs">{n.site.code}</span>,
    },
  ];

  const activeFilterCount =
    (search ? 1 : 0) + (status ? 1 : 0) + (severity ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("ncrs.title")} subtitle={t("ncrs.subtitle")} />
      <DataTable<NcrRow>
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
          {
            key: "severity",
            label: t("ncrs.severity"),
            value: severity,
            onChange: (v) => {
              setSeverity(v);
              setPage(1);
            },
            options: SEVERITY_OPTIONS.map((s) => ({ value: s, label: s })),
          },
        ]}
        onResetFilters={() => {
          setSearch("");
          setStatus("");
          setSeverity("");
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
          <EmptyState icon={FileWarning} title={t("ncrs.noData")} />
        }
        onRowClick={(n) => setQuickViewId(n.id)}
      />

      <QuickViewDrawer
        open={!!quickViewId}
        onOpenChange={(v) => !v && setQuickViewId(null)}
        recordId={quickViewId}
        entityType="NCR"
        title="NCR"
        detailHref={(id) => `/quality/ncrs/${id}`}
        fetchUrl={(id) => `/api/quality/ncrs/${id}`}
        fields={[
          { key: "code", label: "Code" },
          { key: "status", label: "Status" },
          { key: "severity", label: "Severity" },
          { key: "description", label: "Description" },
          { key: "concernsEntityType", label: "Concerns" },
        ] satisfies QuickViewField[]}
      />
    </div>
  );
}
