"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  status: string;
  lastSignInAt: string | null;
  assignments: Array<{
    role: { id: string; systemKey: string; name: string };
  }>;
}

const STATUS_OPTIONS = ["ACTIVE", "LOCKED", "DISABLED"];

export default function UsersPage() {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data, isLoading } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/identity/users?pageSize=100", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as UserRow[];
    },
  });

  const filtered = (data ?? []).filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      (u.name ?? "").toLowerCase().includes(q);
    const matchesStatus = !status || u.status === status;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<UserRow>[] = [
    {
      key: "email",
      header: t("email"),
      render: (u) => <span className="font-mono text-xs">{u.email}</span>,
    },
    {
      key: "name",
      header: t("name"),
      render: (u) => <span className="text-sm">{u.name ?? "-"}</span>,
    },
    {
      key: "status",
      header: t("status"),
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "role",
      header: t("role"),
      render: (u) => {
        const role = u.assignments[0]?.role;
        return role ? (
          <span className="text-xs">
            {role.name}{" "}
            <span className="font-mono text-[10px] text-muted-foreground">
              ({role.systemKey})
            </span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      },
    },
  ];

  const activeFilterCount = (search ? 1 : 0) + (status ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button size="sm" className="gap-2">
            <UserPlus className="h-4 w-4" />
            {t("createUser")}
          </Button>
        }
      />
      <DataTable<UserRow>
        columns={columns}
        data={filtered}
        loading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={tCommon("search.placeholder")}
        filters={[
          {
            key: "status",
            label: t("status"),
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
        emptyState={<EmptyState icon={Users} title={t("noUsers")} />}
      />
    </div>
  );
}
