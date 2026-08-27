"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface BatchReviewRow {
  id: string;
  code: string;
  status: string;
  plannedQuantity: string;
  actualQuantity: string | null;
  unit: string;
}

// Statuses that participate in the QA review lifecycle (Phase 9 domain).
const STATUS_OPTIONS = [
  "READY_FOR_REVIEW",
  "QA_REVIEW",
  "APPROVED",
  "HOLD",
  "REWORK",
  "REJECT",
];

export default function BatchReviewPage() {
  const t = useTranslations("batchReview");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<BatchReviewRow[]>({
    queryKey: ["batch-review-batches"],
    queryFn: async () => {
      const res = await fetch("/api/production/batches?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as BatchReviewRow[];
    },
  });

  // Filter to batches that are part of the batch-review lifecycle unless a
  // specific status is selected (in which case we honor the user's choice).
  const inReviewLifecycle = (s: string) => STATUS_OPTIONS.includes(s);

  const filtered = (data ?? []).filter((b) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || b.code.toLowerCase().includes(q);
    const matchesStatus = !status
      ? inReviewLifecycle(b.status)
      : b.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<BatchReviewRow>[] = [
    {
      key: "code",
      header: t("detail.fields.code"),
      render: (b) => <span className="font-mono text-xs">{b.code}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: "plannedQuantity",
      header: t("detail.fields.plannedQuantity"),
      render: (b) => (
        <span className="text-xs">
          {b.plannedQuantity} {b.unit}
        </span>
      ),
    },
    {
      key: "actualQuantity",
      header: t("detail.fields.actualQuantity"),
      render: (b) => (
        <span className="text-xs text-muted-foreground">
          {b.actualQuantity ? `${b.actualQuantity} ${b.unit}` : "-"}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("dispositionGuard")}
      </div>
      <DataTable<BatchReviewRow>
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
        emptyState={<EmptyState icon={ClipboardCheck} title={t("noData")} />}
        onRowClick={(b) => router.push(`/batch-review/batches/${b.id}`)}
      />
    </div>
  );
}
