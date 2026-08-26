"use client";
// Phase 13 Integration Configs list page.
// CRITICAL (owner rule, Phase 13 D5): adapters are PULL-ONLY. No push to external systems.
// CRITICAL (Phase 13 D6): credentials are NEVER displayed in the UI.
// The page only calls the already-built integration API routes.
// All strings come from useTranslations("integration").
//
// Layout:
//   - Page header + New Configuration button
//   - PULL-ONLY amber Alert (always visible)
//   - MOCK_TEST amber Alert (visible when any MOCK_TEST configs exist)
//   - Registered adapters row (badges)
//   - Active / Total counters
//   - Configs table (adapterType, name, endpointUrl, status, lastSync, lastSyncStatus)
//   - Click row -> /integration/configs/[id]
//
// See: src/modules/integration/service/index.ts for the backend contract.

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plug, Plus, AlertTriangle, Loader2, ShieldAlert, ArrowRight, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror the API contract
// ---------------------------------------------------------------------------

type AdapterType =
  | "ERP" | "MES" | "LIMS" | "PLM" | "HR" | "MAINTENANCE"
  | "BARCODE_RFID" | "PLC_SCADA" | "IOT" | "OTHER" | "MOCK_TEST";

const ADAPTER_TYPES: AdapterType[] = [
  "ERP", "MES", "LIMS", "PLM", "HR", "MAINTENANCE",
  "BARCODE_RFID", "PLC_SCADA", "IOT", "OTHER", "MOCK_TEST",
];

interface IntegrationConfig {
  id: string;
  adapterType: string;
  name: string;
  siteId: string | null;
  endpointUrl: string;
  credentials: string; // always "***REDACTED***"
  hasCredentials: boolean;
  syncSchedule: string | null;
  status: string; // ACTIVE | INACTIVE
  lastSyncAt: string | null;
  lastSyncStatus: string | null; // SUCCESS | PARTIAL | FAILURE
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IntegrationHealth {
  registeredAdapters: Array<{ type: string; displayName: string }>;
  activeConfigs: number;
  totalConfigs: number;
  configs: Array<{
    id: string;
    adapterType: string;
    name: string;
    status: string;
    lastSyncStatus: string | null;
  }>;
}

interface Site {
  id: string;
  code: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  INACTIVE: "secondary",
};

const SYNC_STATUS_CLASS: Record<string, string> = {
  SUCCESS: "text-emerald-600",
  PARTIAL: "text-amber-600",
  FAILURE: "text-destructive",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationConfigsPage() {
  const t = useTranslations("integration");
  const router = useRouter();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);

  // Configs list
  const configsQ = useQuery<IntegrationConfig[]>({
    queryKey: ["integration", "configs"],
    queryFn: async () => {
      const res = await fetch("/api/integration/configs?page=1&pageSize=50", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load configs");
      const json = await res.json();
      return (json.data ?? []) as IntegrationConfig[];
    },
    refetchInterval: 60_000,
  });

  // Health (registered adapters + counters)
  const healthQ = useQuery<IntegrationHealth>({
    queryKey: ["integration", "health"],
    queryFn: async () => {
      const res = await fetch("/api/integration/health", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load health");
      const json = await res.json();
      return json.data as IntegrationHealth;
    },
    staleTime: 60_000,
  });

  // Sites (for create dialog)
  const sitesQ = useQuery<Site[]>({
    queryKey: ["sites"],
    queryFn: async () => {
      const res = await fetch("/api/org/sites?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load sites");
      const json = await res.json();
      return (json.data ?? []) as Site[];
    },
    staleTime: 60_000,
  });

  const hasMockConfigs = useMemo(
    () => (configsQ.data ?? []).some((c) => c.adapterType === "MOCK_TEST"),
    [configsQ.data],
  );

  const handleRowClick = useCallback(
    (id: string) => {
      router.push(`/integration/configs/${id}`);
    },
    [router],
  );

  const handleCreated = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["integration", "configs"] });
    qc.invalidateQueries({ queryKey: ["integration", "health"] });
    setCreateOpen(false);
  }, [qc]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Plug className="h-6 w-6 text-primary" />
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-1.5"
          aria-label={t("newConfig")}
        >
          <Plus className="h-4 w-4" />
          {t("newConfig")}
        </Button>
      </div>

      {/* PULL-ONLY notice (always visible) */}
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">
          {t("pullOnlyBadge")}
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-300">
          {t("pullOnlyNotice")}
        </AlertDescription>
      </Alert>

      {/* MOCK_TEST notice (conditional) */}
      {hasMockConfigs && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            {t("testMockNotice")}
          </AlertDescription>
        </Alert>
      )}

      {/* Registered adapters + counters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4" />
            {t("registeredAdapters")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {healthQ.isLoading ? (
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-32" />
            </div>
          ) : healthQ.data && healthQ.data.registeredAdapters.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {healthQ.data.registeredAdapters.map((a) => (
                <Badge
                  key={a.type}
                  variant={a.type === "MOCK_TEST" ? "outline" : "default"}
                  className={cn(
                    a.type === "MOCK_TEST" && "border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300",
                  )}
                  title={a.displayName}
                >
                  {a.type}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("adapterNotRegistered")}</p>
          )}

          <div className="flex flex-wrap gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground">{t("activeConfigs")}</p>
              <p className="text-xl font-semibold">{healthQ.data?.activeConfigs ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("totalConfigs")}</p>
              <p className="text-xl font-semibold">{healthQ.data?.totalConfigs ?? "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>{t("configs")}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["integration", "configs"] });
                qc.invalidateQueries({ queryKey: ["integration", "health"] });
              }}
              aria-label="Refresh"
              className="h-8 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configsQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : configsQ.data && configsQ.data.length > 0 ? (
            <div className="max-h-[36rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>{t("adapterType")}</TableHead>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("endpointUrl")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("lastSync")}</TableHead>
                    <TableHead>{t("lastSyncStatus")}</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configsQ.data.map((c) => {
                    const isMock = c.adapterType === "MOCK_TEST";
                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => handleRowClick(c.id)}
                        className="cursor-pointer hover:bg-muted/50"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleRowClick(c.id);
                          }
                        }}
                      >
                        <TableCell className="whitespace-nowrap text-xs">
                          <span className="font-mono">{c.adapterType}</span>
                          {isMock && (
                            <Badge
                              variant="outline"
                              className="ml-2 border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                            >
                              {t("testMockBadge")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{c.name}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={c.endpointUrl}>
                          {c.endpointUrl}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {c.lastSyncAt ? formatDateTime(c.lastSyncAt) : t("never")}
                        </TableCell>
                        <TableCell>
                          {c.lastSyncStatus ? (
                            <span className={cn("text-xs font-medium", SYNC_STATUS_CLASS[c.lastSyncStatus] ?? "")}>
                              {c.lastSyncStatus}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("noConfigs")}</p>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <CreateConfigDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sites={sitesQ.data ?? []}
        sitesLoading={sitesQ.isLoading}
        onCreated={handleCreated}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Config Dialog
// ---------------------------------------------------------------------------

interface CreateConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sites: Site[];
  sitesLoading: boolean;
  onCreated: () => void;
}

function CreateConfigDialog({
  open, onOpenChange, sites, sitesLoading, onCreated,
}: CreateConfigDialogProps) {
  const t = useTranslations("integration");

  const [adapterType, setAdapterType] = useState<AdapterType | "">("");
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState<string>("__none__");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [credentials, setCredentials] = useState("{}");
  const [syncSchedule, setSyncSchedule] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setAdapterType("");
    setName("");
    setSiteId("__none__");
    setEndpointUrl("");
    setCredentials("{}");
    setSyncSchedule("");
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        resetForm();
        setSubmitting(false);
      }
      onOpenChange(next);
    },
    [onOpenChange, resetForm],
  );

  const parsedCredentials = useCallback((): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(credentials);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }, [credentials]);

  const canSubmit = useMemo(() => {
    if (!adapterType) return false;
    if (name.trim().length < 2) return false;
    if (!endpointUrl.trim()) return false;
    // URL validation (basic)
    try {
      new URL(endpointUrl);
    } catch {
      return false;
    }
    if (!parsedCredentials()) return false;
    return true;
  }, [adapterType, name, endpointUrl, parsedCredentials]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const creds = parsedCredentials();
        if (!creds) {
          setError(t("invalidCredentialsJson"));
          setSubmitting(false);
          return;
        }
        const body: Record<string, unknown> = {
          adapterType,
          name: name.trim(),
          endpointUrl: endpointUrl.trim(),
          credentials: creds,
        };
        if (siteId && siteId !== "__none__") body.siteId = siteId;
        if (syncSchedule.trim()) body.syncSchedule = syncSchedule.trim();

        const res = await fetch("/api/integration/configs", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          const msg = json?.error?.message || json?.error || `HTTP ${res.status}`;
          setError(typeof msg === "string" ? msg : JSON.stringify(msg));
          setSubmitting(false);
          return;
        }

        resetForm();
        onCreated();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, submitting, parsedCredentials, adapterType, name, endpointUrl, siteId, syncSchedule, t, resetForm, onCreated],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("createConfig")}</DialogTitle>
          <DialogDescription>{t("pullOnlyNotice")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Adapter type */}
          <div className="space-y-1.5">
            <Label htmlFor="ic-adapterType" className="text-xs">
              {t("adapterType")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={adapterType}
              onValueChange={(v) => setAdapterType(v as AdapterType)}
            >
              <SelectTrigger id="ic-adapterType" className="w-full" aria-label={t("adapterType")}>
                <SelectValue placeholder={t("adapterType")} />
              </SelectTrigger>
              <SelectContent>
                {ADAPTER_TYPES.map((at) => (
                  <SelectItem key={at} value={at}>
                    {at}
                    {at === "MOCK_TEST" && (
                      <span className="ml-2 text-xs text-amber-600">({t("testMockBadge")})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="ic-name" className="text-xs">
              {t("name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              maxLength={100}
              required
            />
          </div>

          {/* Site (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ic-site" className="text-xs">
              {t("siteOptional")}
            </Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger id="ic-site" className="w-full" aria-label={t("siteOptional")}>
                <SelectValue placeholder={t("siteOptional")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("noSite")}</SelectItem>
                {sitesLoading ? (
                  <SelectItem value="__loading__" disabled>
                    {t("syncRunning")}
                  </SelectItem>
                ) : (
                  sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint URL */}
          <div className="space-y-1.5">
            <Label htmlFor="ic-url" className="text-xs">
              {t("endpointUrl")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ic-url"
              type="url"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder={t("endpointUrlPlaceholder")}
              required
            />
          </div>

          {/* Credentials (JSON textarea) */}
          <div className="space-y-1.5">
            <Label htmlFor="ic-creds" className="text-xs">
              {t("credentials")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="ic-creds"
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder={t("credentialsPlaceholder")}
              className="font-mono text-xs min-h-[80px]"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              {t("credentialsRedacted")}
            </p>
          </div>

          {/* Sync schedule (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="ic-sched" className="text-xs">
              {t("syncSchedule")}
            </Label>
            <Input
              id="ic-sched"
              value={syncSchedule}
              onChange={(e) => setSyncSchedule(e.target.value)}
              placeholder={t("syncSchedulePlaceholder")}
              maxLength={100}
            />
          </div>

          {/* MOCK_TEST inline notice when selected */}
          {adapterType === "MOCK_TEST" && (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
                {t("testMockNotice")}
              </AlertDescription>
            </Alert>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!canSubmit || submitting} className="gap-1.5">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("syncRunning")}
                </>
              ) : (
                t("create")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
