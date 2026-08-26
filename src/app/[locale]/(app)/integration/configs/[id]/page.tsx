"use client";
// Phase 13 Integration Config detail page.
// CRITICAL (owner rule, Phase 13 D5): adapters are PULL-ONLY. No push to external systems.
// CRITICAL (Phase 13 D6): credentials are NEVER displayed — always show "*** REDACTED ***".
// The page only calls the already-built integration API routes.
// All strings come from useTranslations("integration").
//
// Layout:
//   - Page header (config name + adapter type + back button)
//   - PULL-ONLY amber Alert (always visible)
//   - MOCK_TEST badge (when applicable)
//   - Config details card (credentials REDACTED)
//   - Action row: Sync Now (POST /sync) + Archive (DELETE)
//   - Sync result banner (after sync)
//   - Event log table (eventType, recordsSynced, recordsFailed, errorDetail, durationMs, createdAt)
//
// See: src/modules/integration/service/index.ts for the backend contract.

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plug, ShieldAlert, AlertTriangle, Loader2, RefreshCw,
  Archive, CheckCircle2, XCircle, AlertCircle, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror the API contract
// ---------------------------------------------------------------------------

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

interface IntegrationEvent {
  id: string;
  configId: string;
  eventType: string; // SYNC_START | SYNC_SUCCESS | SYNC_PARTIAL | SYNC_FAILURE
  recordsSynced: number;
  recordsFailed: number;
  errorDetail: string | null;
  durationMs: number | null;
  triggeredByUserId: string | null;
  createdAt: string;
}

interface SyncResult {
  success: boolean;
  recordsSynced?: number;
  recordsFailed?: number;
  durationMs: number;
  error?: string;
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

const EVENT_TYPE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SYNC_START: "outline",
  SYNC_SUCCESS: "default",
  SYNC_PARTIAL: "secondary",
  SYNC_FAILURE: "destructive",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationConfigDetailPage() {
  const t = useTranslations("integration");
  const router = useRouter();
  const params = useParams<{ locale: string; id: string }>();
  const id = params?.id;
  const qc = useQueryClient();

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Config detail
  const configQ = useQuery<IntegrationConfig>({
    queryKey: ["integration", "config", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing id");
      const res = await fetch(`/api/integration/configs/${id}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.data as IntegrationConfig;
    },
    enabled: !!id,
    refetchInterval: 60_000,
  });

  // Events
  const eventsQ = useQuery<IntegrationEvent[]>({
    queryKey: ["integration", "config", id, "events"],
    queryFn: async () => {
      if (!id) throw new Error("Missing id");
      const res = await fetch(`/api/integration/configs/${id}/events?page=1&pageSize=50`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.data ?? []) as IntegrationEvent[];
    },
    enabled: !!id,
    refetchInterval: 30_000,
  });

  const handleSync = useCallback(async () => {
    if (!id || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch(`/api/integration/configs/${id}/sync`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message || json?.error || `HTTP ${res.status}`;
        setSyncError(typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }
      const result = json.data as SyncResult;
      setSyncResult(result);
      // Refresh config + events to reflect the new state
      qc.invalidateQueries({ queryKey: ["integration", "config", id] });
      qc.invalidateQueries({ queryKey: ["integration", "config", id, "events"] });
      qc.invalidateQueries({ queryKey: ["integration", "configs"] });
      qc.invalidateQueries({ queryKey: ["integration", "health"] });
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSyncing(false);
    }
  }, [id, syncing, qc]);

  const handleArchive = useCallback(async () => {
    if (!id || archiving) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/integration/configs/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error?.message || json?.error || `HTTP ${res.status}`;
        setSyncError(typeof msg === "string" ? msg : JSON.stringify(msg));
        setArchiving(false);
        return;
      }
      qc.invalidateQueries({ queryKey: ["integration", "configs"] });
      qc.invalidateQueries({ queryKey: ["integration", "health"] });
      router.push(`/integration/configs`);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed");
      setArchiving(false);
    }
  }, [id, archiving, qc, router]);

  const config = configQ.data;
  const isMock = config?.adapterType === "MOCK_TEST";
  const isInactive = config?.status === "INACTIVE";

  if (configQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (configQ.isError || !config) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/integration/configs")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Button>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{t("noConfigs")}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/integration/configs")}
            className="gap-1.5 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
            <Plug className="h-6 w-6 text-primary" />
            <span className="truncate">{config.name}</span>
            <Badge variant="outline" className="font-mono">{config.adapterType}</Badge>
            {isMock && (
              <Badge
                variant="outline"
                className="border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300"
              >
                {t("testMockBadge")}
              </Badge>
            )}
            {config.isDemo && (
              <Badge variant="secondary">{t("demoConfig")}</Badge>
            )}
          </h1>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["integration", "config", id] });
              qc.invalidateQueries({ queryKey: ["integration", "config", id, "events"] });
            }}
            className="gap-1.5"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={handleSync}
            disabled={syncing || isInactive}
            className="gap-1.5"
            aria-label={t("sync")}
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("syncRunning")}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {t("sync")}
              </>
            )}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={archiving || isInactive}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                {archiving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                {t("archive")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("archiveConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("archiveConfirmBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={archiving}>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleArchive}
                  disabled={archiving}
                  className="gap-1.5"
                >
                  {archiving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                  {t("archive")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
      {isMock && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            {t("testMockNotice")}
          </AlertDescription>
        </Alert>
      )}

      {/* Inactive status notice */}
      {isInactive && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("status")}: <Badge variant={STATUS_VARIANT[config.status] ?? "outline"}>{config.status}</Badge>
          </AlertDescription>
        </Alert>
      )}

      {/* Sync result banner */}
      {syncResult && (
        <Alert
          variant={syncResult.success ? "default" : "destructive"}
          className={
            syncResult.success
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              : undefined
          }
        >
          {syncResult.success ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle className={syncResult.success ? "text-emerald-800 dark:text-emerald-300" : undefined}>
            {t("syncResult")}
          </AlertTitle>
          <AlertDescription className={syncResult.success ? "text-emerald-800 dark:text-emerald-300" : undefined}>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span>
                {syncResult.success ? t("syncSuccess") : t("syncFailure")}
              </span>
              {typeof syncResult.recordsSynced === "number" && (
                <span>
                  {t("recordsSyncedLabel")}: <strong>{syncResult.recordsSynced}</strong>
                </span>
              )}
              {typeof syncResult.recordsFailed === "number" && (
                <span>
                  {t("recordsFailedLabel")}: <strong>{syncResult.recordsFailed}</strong>
                </span>
              )}
              <span>
                {t("durationLabel")}: <strong>{syncResult.durationMs} ms</strong>
              </span>
              {syncResult.error && (
                <span className="text-destructive">
                  {syncResult.error}
                </span>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Sync error banner */}
      {syncError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">{syncError}</AlertDescription>
        </Alert>
      )}

      {/* Config details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("configDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <DetailField label={t("adapterType")} value={<span className="font-mono">{config.adapterType}</span>} />
            <DetailField label={t("name")} value={config.name} />
            <DetailField
              label={t("status")}
              value={<Badge variant={STATUS_VARIANT[config.status] ?? "outline"}>{config.status}</Badge>}
            />
            <DetailField
              label={t("siteId")}
              value={config.siteId ? <span className="font-mono text-xs">{config.siteId}</span> : t("noSite")}
            />
            <DetailField
              label={t("endpointUrl")}
              value={
                <a
                  href={config.endpointUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs underline break-all"
                >
                  {config.endpointUrl}
                </a>
              }
              fullWidth
            />
            <DetailField
              label={t("credentials")}
              value={
                <span className="font-mono text-xs text-muted-foreground">
                  {t("credentialsRedacted")}
                </span>
              }
            />
            <DetailField
              label={t("hasCredentials")}
              value={config.hasCredentials ? t("yes") : t("no")}
            />
            <DetailField
              label={t("syncSchedule")}
              value={
                config.syncSchedule ? (
                  <span className="font-mono text-xs">{config.syncSchedule}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )
              }
            />
            <DetailField
              label={t("lastSyncStatus")}
              value={
                config.lastSyncStatus ? (
                  <span className="text-xs font-medium">{config.lastSyncStatus}</span>
                ) : (
                  <span className="text-muted-foreground">{t("never")}</span>
                )
              }
            />
            <DetailField
              label={t("lastSync")}
              value={
                config.lastSyncAt ? (
                  <span className="text-xs text-muted-foreground">{formatDateTime(config.lastSyncAt)}</span>
                ) : (
                  <span className="text-muted-foreground">{t("never")}</span>
                )
              }
            />
            <DetailField
              label={t("created")}
              value={<span className="text-xs text-muted-foreground">{formatDateTime(config.createdAt)}</span>}
            />
            <DetailField
              label={t("updated")}
              value={<span className="text-xs text-muted-foreground">{formatDateTime(config.updatedAt)}</span>}
            />
          </dl>
        </CardContent>
      </Card>

      {/* Event log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t("events")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventsQ.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : eventsQ.data && eventsQ.data.length > 0 ? (
            <div className="max-h-[36rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>{t("eventType")}</TableHead>
                    <TableHead className="text-right">{t("recordsSynced")}</TableHead>
                    <TableHead className="text-right">{t("recordsFailed")}</TableHead>
                    <TableHead>{t("errorDetail")}</TableHead>
                    <TableHead className="text-right">{t("durationMs")}</TableHead>
                    <TableHead>{t("createdAt")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsQ.data.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell>
                        <Badge variant={EVENT_TYPE_VARIANT[ev.eventType] ?? "outline"} className="font-mono text-xs">
                          {ev.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {ev.recordsSynced}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span className={cn(ev.recordsFailed > 0 && "text-amber-600 font-medium")}>
                          {ev.recordsFailed}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md text-xs text-muted-foreground">
                        {ev.errorDetail ? (
                          <span className="break-words" title={ev.errorDetail}>
                            {ev.errorDetail}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {ev.durationMs ?? "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(ev.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("noEvents")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail field helper
// ---------------------------------------------------------------------------

function DetailField({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("space-y-0.5", fullWidth && "sm:col-span-2")}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
