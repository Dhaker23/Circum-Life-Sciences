"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";

interface DocumentRow {
  id: string;
  code: string;
  title: string;
  documentType: string;
  version: string;
  status: string;
  updatedAt: string;
}

const STATUS_OPTIONS = [
  "DRAFT",
  "REVIEW",
  "APPROVED",
  "EFFECTIVE",
  "SUPERSEDED",
  "OBSOLETE",
];

export default function DocumentsPage() {
  const t = useTranslations("docs");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<DocumentRow[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await fetch("/api/docs/documents?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as DocumentRow[];
    },
  });

  const filtered = (data ?? []).filter((d) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      d.code.toLowerCase().includes(q) ||
      d.title.toLowerCase().includes(q);
    const matchesStatus = !status || d.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<DocumentRow>[] = [
    {
      key: "code",
      header: "Code",
      render: (d) => <span className="font-mono text-xs">{d.code}</span>,
    },
    {
      key: "title",
      header: "Title",
      render: (d) => (
        <span className="block max-w-[24rem] truncate text-xs" title={d.title}>
          {d.title}
        </span>
      ),
    },
    {
      key: "documentType",
      header: "Type",
      render: (d) => <span className="text-xs">{d.documentType}</span>,
    },
    {
      key: "version",
      header: "Version",
      render: (d) => <span className="font-mono text-xs">{d.version}</span>,
    },
    {
      key: "status",
      header: tCommon("status"),
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (d) => (
        <span className="text-xs text-muted-foreground">
          {new Date(d.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <DataTable<DocumentRow>
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
        emptyState={<EmptyState icon={FileText} />}
      />
    </div>
  );
}
