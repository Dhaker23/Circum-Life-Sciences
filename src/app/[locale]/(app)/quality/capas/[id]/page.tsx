"use client";
// Phase 14 D5 — CAPA detail page with transition buttons.
// Calls the EXISTING transition API: POST /api/quality/capas/[id]/transition
// Domain state machine (D5) is enforced by the authoritative service layer; the UI
// only renders the buttons that are valid for the current status.
//
// IMPORTANT (PRD §9): CAPA closure is HUMAN-ONLY. AI MUST NEVER close a CAPA.
// Closure requires effectiveness verification evidence. This page surfaces a clear
// notice on the CLOSED transition button and requires the effectivenessVerification
// field in the dialog.
//
// NOTE: There is no GET /api/quality/capas/[id] endpoint — this page fetches from
// the list endpoint (GET /api/quality/capas?pageSize=100) and filters client-side
// by ID (per the task spec).

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { FormField } from "@/components/app/form-field";

// ---------------------------------------------------------------------------
// Types — mirror the API contract
// ---------------------------------------------------------------------------
interface CapaDetail {
  id: string;
  code: string;
  status: string;
  sourceType: string;
  sourceId: string;
  type: string;
  actionPlan: string;
  implementationOwnerUserId: string | null;
  implementedAt: string | null;
  effectivenessVerification: string | null;
  effectivenessVerifiedAt: string | null;
  effectivenessVerifiedByUserId: string | null;
  closedByUserId: string | null;
  closedAt: string | null;
  createdAt: string;
  siteId: string;
  site?: { code: string };
  investigation?: { code: string } | null;
}

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------
const CAPA_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "outline", ACTION_PLAN: "default", IMPLEMENTATION: "default",
  EFFECTIVENESS: "secondary", CLOSED: "secondary",
};

// ---------------------------------------------------------------------------
// Transition specs (D5 state machine — UI mirror only)
// ---------------------------------------------------------------------------
type FieldKind = "effectivenessVerification";

interface TransitionSpec {
  to: string;
  labelKey: string;
  fields: FieldKind[];
  variant?: "default" | "outline" | "destructive" | "secondary";
}

const TRANSITIONS_BY_STATUS: Record<string, TransitionSpec[]> = {
  OPEN: [
    { to: "ACTION_PLAN", labelKey: "ACTION_PLAN", fields: [], variant: "default" },
  ],
  ACTION_PLAN: [
    { to: "IMPLEMENTATION", labelKey: "IMPLEMENTATION", fields: [], variant: "default" },
  ],
  IMPLEMENTATION: [
    { to: "EFFECTIVENESS", labelKey: "EFFECTIVENESS", fields: [], variant: "secondary" },
  ],
  EFFECTIVENESS: [
    { to: "CLOSED", labelKey: "CLOSED", fields: ["effectivenessVerification"], variant: "secondary" },
  ],
  CLOSED: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CapaDetailPage() {
  const t = useTranslations("quality");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useParams<{ locale: string; id: string }>();
  const id = params?.id;
  const qc = useQueryClient();
  const { toast } = useToast();

  const capaQ = useQuery<CapaDetail>({
    queryKey: ["quality", "capa", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing id");
      const res = await fetch("/api/quality/capas?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const items = (json.data ?? []) as CapaDetail[];
      const found = items.find((c) => c.id === id);
      if (!found) throw new Error("CAPA not found");
      return found;
    },
    enabled: !!id,
  });

  if (capaQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (capaQ.isError || !capaQ.data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/quality/capas")} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Button>
        <Alert variant="destructive">
          <AlertTitle>{tc("notFound")}</AlertTitle>
          <AlertDescription>
            {capaQ.error instanceof Error ? capaQ.error.message : tc("notFound")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const capa = capaQ.data;
  const transitions = TRANSITIONS_BY_STATUS[capa.status] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/quality/capas")} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
            <span className="font-mono">{capa.code}</span>
            <Badge variant={CAPA_VARIANT[capa.status] ?? "outline"}>{capa.status}</Badge>
            <Badge variant="outline">{capa.type}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{t("capas.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => capaQ.refetch()} className="gap-1.5" aria-label={tc("refresh")}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* AI governance notice (always visible) */}
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">{t("capas.aiGuard")}</AlertTitle>
      </Alert>

      {/* Details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("capas.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Field label={t("capas.detail.fields.code")} value={<span className="font-mono text-xs">{capa.code}</span>} />
            <Field label={t("capas.detail.fields.status")} value={<Badge variant={CAPA_VARIANT[capa.status] ?? "outline"}>{capa.status}</Badge>} />
            <Field label={t("capas.detail.fields.type")} value={<Badge variant="outline">{capa.type}</Badge>} />
            <Field label={t("capas.detail.fields.site")} value={capa.site?.code ?? <span className="text-muted-foreground">-</span>} />
            <Field label={t("capas.detail.fields.sourceType")} value={<span className="font-mono text-xs">{capa.sourceType}</span>} />
            <Field label={t("capas.detail.fields.sourceId")} value={<span className="font-mono text-xs text-muted-foreground">{capa.sourceId}</span>} />
            <Field label={t("capas.investigation")} value={capa.investigation?.code ? <span className="font-mono text-xs">{capa.investigation.code}</span> : <span className="text-muted-foreground">{tc("notAvailable")}</span>} />
            <Field label={t("capas.detail.fields.actionPlan")} value={<span className="text-sm whitespace-pre-wrap break-words">{capa.actionPlan}</span>} fullWidth />
            <Field
              label={t("capas.detail.fields.implementationOwnerUserId")}
              value={capa.implementationOwnerUserId
                ? <span className="font-mono text-xs text-muted-foreground">{capa.implementationOwnerUserId}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field
              label={t("capas.detail.fields.implementedAt")}
              value={capa.implementedAt
                ? <span className="text-xs text-muted-foreground">{formatDateTime(capa.implementedAt)}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field
              label={t("capas.detail.fields.effectivenessVerification")}
              value={capa.effectivenessVerification
                ? <span className="text-sm whitespace-pre-wrap break-words">{capa.effectivenessVerification}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              fullWidth
            />
            <Field
              label={t("capas.detail.fields.effectivenessVerifiedAt")}
              value={capa.effectivenessVerifiedAt
                ? <span className="text-xs text-muted-foreground">{formatDateTime(capa.effectivenessVerifiedAt)}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field
              label={t("capas.detail.fields.closedByUserId")}
              value={capa.closedByUserId
                ? <span className="font-mono text-xs text-muted-foreground">{capa.closedByUserId}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field
              label={t("capas.detail.fields.closedAt")}
              value={capa.closedAt
                ? <span className="text-xs text-muted-foreground">{formatDateTime(capa.closedAt)}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field label={t("capas.detail.fields.createdAt")} value={<span className="text-xs text-muted-foreground">{formatDateTime(capa.createdAt)}</span>} />
          </dl>
        </CardContent>
      </Card>

      {/* Transitions card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tc("transition")}</CardTitle>
        </CardHeader>
        <CardContent>
          {transitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("capas.detail.noTransitions")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transitions.map((spec) => (
                <TransitionDialog
                  key={spec.to}
                  spec={spec}
                  capaId={capa.id}
                  translateLabel={(key) => t(`capas.detail.transitions.${key}`)}
                  translateTitle={(to) => t("capas.detail.transitionTitle", { to })}
                  effectivenessLabel={t("capas.detail.effectivenessVerificationRequired")}
                  closureNotice={t("capas.detail.closureHumanOnlyNotice")}
                  reasonLabel={tc("reasonRequired")}
                  cancelLabel={tc("cancel")}
                  confirmLabel={tc("confirmTransition")}
                  fieldRequiredLabel={tc("fieldRequired")}
                  onSuccess={async () => {
                    await qc.invalidateQueries({ queryKey: ["quality", "capa", capa.id] });
                    await qc.invalidateQueries({ queryKey: ["capas"] });
                    toast({ title: tc("transitionSuccess"), description: `${capa.code} → ${spec.to}` });
                  }}
                  onError={(msg: string) => {
                    toast({ variant: "destructive", title: tc("transitionFailed"), description: msg });
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <ActivityTimeline entityType="CAPA" entityId={capa.id} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field helper
// ---------------------------------------------------------------------------
function Field({ label, value, fullWidth }: { label: string; value: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={cn("space-y-0.5", fullWidth && "sm:col-span-2")}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransitionDialog
// ---------------------------------------------------------------------------
interface TransitionDialogProps {
  spec: TransitionSpec;
  capaId: string;
  translateLabel: (key: string) => string;
  translateTitle: (to: string) => string;
  effectivenessLabel: string;
  closureNotice: string;
  reasonLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  fieldRequiredLabel: string;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}

function TransitionDialog({
  spec, capaId, translateLabel, translateTitle, effectivenessLabel, closureNotice,
  reasonLabel, cancelLabel, confirmLabel, fieldRequiredLabel, onSuccess, onError,
}: TransitionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [effectivenessVerification, setEffectivenessVerification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  function reset() {
    setReason("");
    setEffectivenessVerification("");
    setSubmitAttempted(false);
  }

  const reasonError = submitAttempted && !reason.trim() ? fieldRequiredLabel : null;
  const effectivenessError =
    submitAttempted && spec.fields.includes("effectivenessVerification") && !effectivenessVerification.trim()
      ? fieldRequiredLabel
      : null;

  function canSubmit(): boolean {
    if (!reason.trim()) return false;
    if (spec.fields.includes("effectivenessVerification") && !effectivenessVerification.trim()) return false;
    return true;
  }

  async function handleSubmit() {
    // Flag any empty required fields on submit attempt.
    setSubmitAttempted(true);
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { to: spec.to, reason: reason.trim() };
      if (spec.fields.includes("effectivenessVerification")) {
        body.effectivenessVerification = effectivenessVerification.trim();
      }
      const res = await fetch(`/api/quality/capas/${capaId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message || `HTTP ${res.status}`;
        onError(typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }
      reset();
      setOpen(false);
      await onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  const isClosure = spec.to === "CLOSED";

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant={spec.variant ?? "outline"} size="sm" className="gap-1.5">
          {translateLabel(spec.labelKey)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{translateTitle(spec.to)}</DialogTitle>
          <DialogDescription>{translateLabel(spec.labelKey)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {isClosure && (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
                {closureNotice}
              </AlertDescription>
            </Alert>
          )}

          <FormField
            label={reasonLabel}
            required
            error={reasonError}
            htmlFor="capa-reason"
          >
            <Textarea
              id="capa-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              aria-invalid={Boolean(reasonError)}
            />
          </FormField>

          {spec.fields.includes("effectivenessVerification") && (
            <FormField
              label={effectivenessLabel}
              required
              error={effectivenessError}
              htmlFor="capa-effectiveness"
            >
              <Textarea
                id="capa-effectiveness"
                value={effectivenessVerification}
                onChange={(e) => setEffectivenessVerification(e.target.value)}
                rows={5}
                maxLength={5000}
                aria-invalid={Boolean(effectivenessError)}
              />
            </FormField>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit() || submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
