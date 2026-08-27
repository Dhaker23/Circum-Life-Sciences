"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge, type StatusType } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";

interface AuditEventRow {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: string;
  reason: string | null;
  ipAddress: string | null;
}

const OUTCOME_OPTIONS = ["SUCCESS", "FAILURE", "DENIED"];

const OUTCOME_TYPE: Record<string, StatusType> = {
  SUCCESS: "success",
  FAILURE: "warning",
  DENIED: "error",
};

export default function AuditEventsPage() {
  const t = useTranslations("audit");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("");

  const { data, isLoading } = useQuery<AuditEventRow[]>({
    queryKey: ["audit-events"],
    queryFn: async () => {
      const res = await fetch("/api/audit/events?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as AuditEventRow[];
    },
  });

  const filtered = (data ?? []).filter((e) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || e.action.toLowerCase().includes(q);
    const matchesOutcome = !outcome || e.outcome === outcome;
    return matchesSearch && matchesOutcome;
  });

  const columns: Column<AuditEventRow>[] = [
    {
      key: "action",
      header: t("action"),
      render: (e) => <span className="font-mono text-xs">{e.action}</span>,
    },
    {
      key: "entityType",
      header: t("entity"),
      render: (e) => (
        <span className="text-xs">
          <span className="font-mono">{e.entityType}</span>
          {e.entityId ? (
            <span className="text-muted-foreground">
              {" "}
              / {e.entityId.slice(-8)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "outcome",
      header: t("outcome"),
      render: (e) => (
        <StatusBadge
          status={e.outcome}
          type={OUTCOME_TYPE[e.outcome]}
        />
      ),
    },
    {
      key: "occurredAt",
      header: t("occurredAt"),
      render: (e) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {new Date(e.occurredAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actorUserId",
      header: t("actor"),
      render: (e) => (
        <span className="font-mono text-xs text-muted-foreground">
          {e.actorUserId ? e.actorUserId.slice(-8) : "-"}
        </span>
      ),
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (outcome ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/audit/export">{t("export")}</a>
          </Button>
        }
      />
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        {t("appendOnly")}
      </div>
      <DataTable<AuditEventRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={tCommon("search.placeholder")}
        filters={[
          {
            key: "outcome",
            label: t("outcome"),
            value: outcome,
            onChange: setOutcome,
            options: OUTCOME_OPTIONS.map((o) => ({ value: o, label: o })),
          },
        ]}
        onResetFilters={() => {
          setSearch("");
          setOutcome("");
        }}
        activeFilterCount={activeFilterCount}
        emptyState={<EmptyState icon={ScrollText} title={t("noData")} />}
      />
    </div>
  );
}
