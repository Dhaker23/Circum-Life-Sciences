"use client";
// Phase 14 D5 — Deviation detail page with transition buttons.
// Calls the EXISTING transition API: POST /api/quality/deviations/[id]/transition
// Domain state machine (D4) is enforced by the authoritative service layer; the UI
// only renders the buttons that are valid for the current status.
//
// NOTE: There is no GET /api/quality/deviations/[id] endpoint — the [id] route.ts
// only handles POST (human approval). This page fetches from the list endpoint
// (GET /api/quality/deviations?pageSize=100) and filters client-side by ID.

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror the API contract
// ---------------------------------------------------------------------------
interface DeviationDetail {
  id: string;
  code: string;
  status: string;
  appliesToEntityType: string;
  appliesToEntityId: string;
  description: string;
  justification: string;
  impactAssessment: string | null;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  siteId: string;
  site?: { code: string };
}

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------
const DEV_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline", ASSESSMENT: "default", INVESTIGATION: "default",
  REVIEW: "secondary", CLOSED: "secondary", REJECTED: "destructive",
};

// ---------------------------------------------------------------------------
// Transition specs (D4 state machine — UI mirror only)
// ---------------------------------------------------------------------------
type FieldKind = "impactAssessment";

interface TransitionSpec {
  to: string;
  labelKey: string;
  fields: FieldKind[];
  variant?: "default" | "outline" | "destructive" | "secondary";
}

const TRANSITIONS_BY_STATUS: Record<string, TransitionSpec[]> = {
  DRAFT: [
    { to: "ASSESSMENT", labelKey: "ASSESSMENT", fields: [], variant: "default" },
    { to: "REJECTED", labelKey: "REJECTED", fields: [], variant: "destructive" },
  ],
  ASSESSMENT: [
    { to: "INVESTIGATION", labelKey: "INVESTIGATION", fields: [], variant: "default" },
    { to: "REVIEW", labelKey: "REVIEW", fields: ["impactAssessment"], variant: "secondary" },
    { to: "REJECTED", labelKey: "REJECTED", fields: [], variant: "destructive" },
  ],
  INVESTIGATION: [
    { to: "REVIEW", labelKey: "REVIEW", fields: ["impactAssessment"], variant: "secondary" },
  ],
  REVIEW: [
    { to: "CLOSED", labelKey: "CLOSED", fields: [], variant: "secondary" },
    { to: "REJECTED", labelKey: "REJECTED", fields: [], variant: "destructive" },
  ],
  CLOSED: [],
  REJECTED: [],
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
export default function DeviationDetailPage() {
  const t = useTranslations("quality");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useParams<{ locale: string; id: string }>();
  const id = params?.id;
  const qc = useQueryClient();
  const { toast } = useToast();

  const devQ = useQuery<DeviationDetail>({
    queryKey: ["quality", "deviation", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing id");
      const res = await fetch("/api/quality/deviations?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const items = (json.data ?? []) as DeviationDetail[];
      const found = items.find((d) => d.id === id);
      if (!found) throw new Error("Deviation not found");
      return found;
    },
    enabled: !!id,
  });

  if (devQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (devQ.isError || !devQ.data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/quality/deviations")} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Button>
        <Alert variant="destructive">
          <AlertTitle>{tc("notFound")}</AlertTitle>
          <AlertDescription>
            {devQ.error instanceof Error ? devQ.error.message : tc("notFound")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const dev = devQ.data;
  const transitions = TRANSITIONS_BY_STATUS[dev.status] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/quality/deviations")} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
            <span className="font-mono">{dev.code}</span>
            <Badge variant={DEV_VARIANT[dev.status] ?? "outline"}>{dev.status}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{t("deviations.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => devQ.refetch()} className="gap-1.5" aria-label={tc("refresh")}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("deviations.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Field label={t("deviations.detail.fields.code")} value={<span className="font-mono text-xs">{dev.code}</span>} />
            <Field label={t("deviations.detail.fields.status")} value={<Badge variant={DEV_VARIANT[dev.status] ?? "outline"}>{dev.status}</Badge>} />
            <Field label={t("deviations.detail.fields.site")} value={dev.site?.code ?? <span className="text-muted-foreground">-</span>} />
            <Field label={t("deviations.detail.fields.appliesToEntityType")} value={<span className="font-mono text-xs">{dev.appliesToEntityType}</span>} />
            <Field label={t("deviations.detail.fields.appliesToEntityId")} value={<span className="font-mono text-xs text-muted-foreground">{dev.appliesToEntityId}</span>} />
            <Field label={t("deviations.detail.fields.description")} value={<span className="text-sm whitespace-pre-wrap break-words">{dev.description}</span>} fullWidth />
            <Field label={t("deviations.detail.fields.justification")} value={<span className="text-sm whitespace-pre-wrap break-words">{dev.justification}</span>} fullWidth />
            <Field
              label={t("deviations.detail.fields.impactAssessment")}
              value={dev.impactAssessment
                ? <span className="text-sm whitespace-pre-wrap break-words">{dev.impactAssessment}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              fullWidth
            />
            <Field
              label={t("deviations.detail.fields.validFrom")}
              value={dev.validFrom
                ? <span className="text-xs text-muted-foreground">{formatDateTime(dev.validFrom)}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field
              label={t("deviations.detail.fields.validUntil")}
              value={dev.validUntil
                ? <span className="text-xs text-muted-foreground">{formatDateTime(dev.validUntil)}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field label={t("deviations.detail.fields.createdAt")} value={<span className="text-xs text-muted-foreground">{formatDateTime(dev.createdAt)}</span>} />
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
            <p className="text-sm text-muted-foreground">{t("deviations.detail.noTransitions")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transitions.map((spec) => (
                <TransitionDialog
                  key={spec.to}
                  spec={spec}
                  deviationId={dev.id}
                  translateLabel={(key) => t(`deviations.detail.transitions.${key}`)}
                  translateTitle={(to) => t("deviations.detail.transitionTitle", { to })}
                  impactLabel={t("deviations.detail.impactAssessmentOptional")}
                  reasonLabel={tc("reasonRequired")}
                  cancelLabel={tc("cancel")}
                  confirmLabel={tc("confirmTransition")}
                  onSuccess={async () => {
                    await qc.invalidateQueries({ queryKey: ["quality", "deviation", dev.id] });
                    await qc.invalidateQueries({ queryKey: ["deviations"] });
                    toast({ title: tc("transitionSuccess"), description: `${dev.code} → ${spec.to}` });
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
  deviationId: string;
  translateLabel: (key: string) => string;
  translateTitle: (to: string) => string;
  impactLabel: string;
  reasonLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}

function TransitionDialog({
  spec, deviationId, translateLabel, translateTitle, impactLabel,
  reasonLabel, cancelLabel, confirmLabel, onSuccess, onError,
}: TransitionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [impactAssessment, setImpactAssessment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setReason("");
    setImpactAssessment("");
  }

  function canSubmit(): boolean {
    if (!reason.trim()) return false;
    // impactAssessment is OPTIONAL per the schema; allowed but not strictly required.
    return true;
  }

  async function handleSubmit() {
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { to: spec.to, reason: reason.trim() };
      if (spec.fields.includes("impactAssessment") && impactAssessment.trim()) {
        body.impactAssessment = impactAssessment.trim();
      }
      const res = await fetch(`/api/quality/deviations/${deviationId}/transition`, {
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
          <div className="space-y-1.5">
            <Label htmlFor="dev-reason">{reasonLabel}</Label>
            <Textarea
              id="dev-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          {spec.fields.includes("impactAssessment") && (
            <div className="space-y-1.5">
              <Label htmlFor="dev-impact">{impactLabel}</Label>
              <Textarea
                id="dev-impact"
                value={impactAssessment}
                onChange={(e) => setImpactAssessment(e.target.value)}
                rows={4}
                maxLength={2000}
              />
            </div>
          )}

          {(spec.to === "CLOSED" || spec.to === "REJECTED") && (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
                Terminal status — this transition cannot be reversed.
              </AlertDescription>
            </Alert>
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
