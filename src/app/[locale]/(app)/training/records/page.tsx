"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface TrainingRecordRow {
  id: string;
  code: string;
  status: string;
  trainedAt: string;
  employee: { fullName: string };
  requiredTraining: { title: string } | null;
  assessment: { result: string } | null;
}

const STATUS_OPTIONS = ["SCHEDULED", "COMPLETED", "EXPIRED"];

export default function TrainingRecordsPage() {
  const t = useTranslations("training");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<TrainingRecordRow[]>({
    queryKey: ["training-records"],
    queryFn: async () => {
      const res = await fetch("/api/training/records?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as TrainingRecordRow[];
    },
  });

  const filtered = (data ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || r.code.toLowerCase().includes(q);
    const matchesStatus = !status || r.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<TrainingRecordRow>[] = [
    {
      key: "code",
      header: tCommon("code"),
      render: (r) => <span className="font-mono text-xs">{r.code}</span>,
    },
    {
      key: "employee",
      header: t("records.employee"),
      render: (r) => <span className="text-sm">{r.employee.fullName}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "trainedAt",
      header: t("records.trainedAt"),
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(r.trainedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("records.title")}
        subtitle={t("records.subtitle")}
      />
      <DataTable<TrainingRecordRow>
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
        emptyState={
          <EmptyState icon={GraduationCap} title={t("records.noData")} />
        }
      />
    </div>
  );
}
