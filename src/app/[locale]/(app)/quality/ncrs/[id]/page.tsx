"use client";
// Phase 14 D5 — NCR detail page with transition buttons.
// Calls the EXISTING transition API: POST /api/quality/ncrs/[id]/transition
// Domain state machine (D3) is enforced by the authoritative service layer; the UI
// only renders the buttons that are valid for the current status.
// "Reason" is always required. Additional fields are required per transition
// (containmentAction / disposition / closureNotes) and sent in the same payload.

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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { FormField } from "@/components/app/form-field";

// ---------------------------------------------------------------------------
// Types — mirror the API contract (Prisma NCR + relations)
// ---------------------------------------------------------------------------
interface NcrDetail {
  id: string;
  code: string;
  status: string;
  severity: string;
  concernsEntityType: string;
  concernsEntityId: string;
  description: string;
  containmentAction: string | null;
  disposition: string | null;
  closureNotes: string | null;
  createdAt: string;
  siteId: string;
  site?: { code: string; name: string | null };
  creator?: { id: string; name: string | null; email: string | null } | null;
}

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------
const NCR_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline", CONTAINMENT: "default", INVESTIGATION: "default",
  DISPOSITION: "secondary", CLOSED: "secondary", CANCELLED: "destructive",
};
const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  MINOR: "secondary", MAJOR: "default", CRITICAL: "destructive",
};

const DISPOSITION_OPTIONS = ["USE_AS_IS", "REWORK", "REGRADE", "SCRAP", "RETURN_TO_SUPPLIER"] as const;
type DispositionOption = (typeof DISPOSITION_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Transition specs for the current status (D3 state machine — UI mirror only)
// ---------------------------------------------------------------------------
type FieldKind = "containmentAction" | "disposition" | "closureNotes";

interface TransitionSpec {
  to: string;
  labelKey: string;
  fields: FieldKind[];
  variant?: "default" | "outline" | "destructive" | "secondary";
}

const TRANSITIONS_BY_STATUS: Record<string, TransitionSpec[]> = {
  DRAFT: [
    { to: "CONTAINMENT", labelKey: "CONTAINMENT", fields: ["containmentAction"], variant: "default" },
    { to: "CANCELLED", labelKey: "CANCELLED", fields: ["closureNotes"], variant: "destructive" },
  ],
  CONTAINMENT: [
    { to: "INVESTIGATION", labelKey: "INVESTIGATION", fields: [], variant: "default" },
  ],
  INVESTIGATION: [
    { to: "DISPOSITION", labelKey: "DISPOSITION", fields: ["disposition"], variant: "default" },
  ],
  DISPOSITION: [
    { to: "CLOSED", labelKey: "CLOSED", fields: ["closureNotes"], variant: "secondary" },
  ],
  CLOSED: [],
  CANCELLED: [],
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
export default function NcrDetailPage() {
  const t = useTranslations("quality");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useParams<{ locale: string; id: string }>();
  const id = params?.id;
  const qc = useQueryClient();
  const { toast } = useToast();

  const ncrQ = useQuery<NcrDetail>({
    queryKey: ["quality", "ncr", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing id");
      const res = await fetch(`/api/quality/ncrs/${id}`, { credentials: "same-origin" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      return json.data as NcrDetail;
    },
    enabled: !!id,
  });

  if (ncrQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (ncrQ.isError || !ncrQ.data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/quality/ncrs")} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Button>
        <Alert variant="destructive">
          <AlertTitle>{tc("notFound")}</AlertTitle>
          <AlertDescription>
            {ncrQ.error instanceof Error ? ncrQ.error.message : tc("notFound")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const ncr = ncrQ.data;
  const transitions = TRANSITIONS_BY_STATUS[ncr.status] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/quality/ncrs")} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
            <span className="font-mono">{ncr.code}</span>
            <Badge variant={NCR_VARIANT[ncr.status] ?? "outline"}>{ncr.status}</Badge>
            <Badge variant={SEVERITY_VARIANT[ncr.severity] ?? "outline"}>{ncr.severity}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{t("ncrs.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => ncrQ.refetch()}
          className="gap-1.5"
          aria-label={tc("refresh")}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("ncrs.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Field label={t("ncrs.detail.fields.code")} value={<span className="font-mono text-xs">{ncr.code}</span>} />
            <Field label={t("ncrs.detail.fields.status")} value={<Badge variant={NCR_VARIANT[ncr.status] ?? "outline"}>{ncr.status}</Badge>} />
            <Field label={t("ncrs.detail.fields.severity")} value={<Badge variant={SEVERITY_VARIANT[ncr.severity] ?? "outline"}>{ncr.severity}</Badge>} />
            <Field label={t("ncrs.detail.fields.site")} value={ncr.site?.code ?? <span className="text-muted-foreground">-</span>} />
            <Field label={t("ncrs.detail.fields.concernsEntityType")} value={<span className="font-mono text-xs">{ncr.concernsEntityType}</span>} />
            <Field label={t("ncrs.detail.fields.concernsEntityId")} value={<span className="font-mono text-xs text-muted-foreground">{ncr.concernsEntityId}</span>} />
            <Field label={t("ncrs.detail.fields.description")} value={<span className="text-sm whitespace-pre-wrap break-words">{ncr.description}</span>} fullWidth />
            <Field
              label={t("ncrs.detail.fields.containmentAction")}
              value={ncr.containmentAction
                ? <span className="text-sm whitespace-pre-wrap break-words">{ncr.containmentAction}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              fullWidth
            />
            <Field
              label={t("ncrs.detail.fields.disposition")}
              value={ncr.disposition
                ? <Badge variant="outline">{ncr.disposition}</Badge>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field
              label={t("ncrs.detail.fields.closureNotes")}
              value={ncr.closureNotes
                ? <span className="text-sm whitespace-pre-wrap break-words">{ncr.closureNotes}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              fullWidth
            />
            <Field label={t("ncrs.detail.fields.createdAt")} value={<span className="text-xs text-muted-foreground">{formatDateTime(ncr.createdAt)}</span>} />
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
            <p className="text-sm text-muted-foreground">{t("ncrs.detail.noTransitions")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transitions.map((spec) => (
                <TransitionDialog
                  key={spec.to}
                  spec={spec}
                  ncrId={ncr.id}
                  translateLabel={(key) => t(`ncrs.detail.transitions.${key}`)}
                  translateTitle={(to) => t("ncrs.detail.transitionTitle", { to })}
                  translateFieldLabel={(field) => {
                    if (field === "containmentAction") return t("ncrs.detail.containmentActionRequired");
                    if (field === "disposition") return t("ncrs.detail.dispositionRequired");
                    if (field === "closureNotes") return t("ncrs.detail.closureNotesRequired");
                    return field;
                  }}
                  reasonLabel={tc("reasonRequired")}
                  cancelLabel={tc("cancel")}
                  confirmLabel={tc("confirmTransition")}
                  fieldRequiredLabel={tc("fieldRequired")}
                  onSuccess={async () => {
                    await qc.invalidateQueries({ queryKey: ["quality", "ncr", ncr.id] });
                    await qc.invalidateQueries({ queryKey: ["ncrs"] });
                    toast({ title: tc("transitionSuccess"), description: `${ncr.code} → ${spec.to}` });
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
      <ActivityTimeline entityType="NCR" entityId={ncr.id} />
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
// TransitionDialog — Dialog with the required fields for a single transition.
// ---------------------------------------------------------------------------
interface TransitionDialogProps {
  spec: TransitionSpec;
  ncrId: string;
  translateLabel: (key: string) => string;
  translateTitle: (to: string) => string;
  translateFieldLabel: (field: FieldKind) => string;
  reasonLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  fieldRequiredLabel: string;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}

function TransitionDialog({
  spec, ncrId, translateLabel, translateTitle, translateFieldLabel,
  reasonLabel, cancelLabel, confirmLabel, fieldRequiredLabel, onSuccess, onError,
}: TransitionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [containmentAction, setContainmentAction] = useState("");
  const [disposition, setDisposition] = useState<DispositionOption | "">("");
  const [closureNotes, setClosureNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  function reset() {
    setReason("");
    setContainmentAction("");
    setDisposition("");
    setClosureNotes("");
    setSubmitAttempted(false);
  }

  // Field-level error computation — only surfaces errors after a submit
  // attempt (or, in future, after blur). Returns the localized "required"
  // message for any required field that is currently empty.
  const reasonError = submitAttempted && !reason.trim() ? fieldRequiredLabel : null;
  const containmentError =
    submitAttempted && spec.fields.includes("containmentAction") && !containmentAction.trim()
      ? fieldRequiredLabel
      : null;
  const dispositionError =
    submitAttempted && spec.fields.includes("disposition") && !disposition
      ? fieldRequiredLabel
      : null;
  const closureError =
    submitAttempted && spec.fields.includes("closureNotes") && !closureNotes.trim()
      ? fieldRequiredLabel
      : null;

  function canSubmit(): boolean {
    if (!reason.trim()) return false;
    for (const f of spec.fields) {
      if (f === "containmentAction" && !containmentAction.trim()) return false;
      if (f === "disposition" && !disposition) return false;
      if (f === "closureNotes" && !closureNotes.trim()) return false;
    }
    return true;
  }

  async function handleSubmit() {
    // Flag any empty required fields on submit attempt.
    setSubmitAttempted(true);
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { to: spec.to, reason: reason.trim() };
      if (spec.fields.includes("containmentAction")) body.containmentAction = containmentAction.trim();
      if (spec.fields.includes("disposition")) body.disposition = disposition;
      if (spec.fields.includes("closureNotes")) body.closureNotes = closureNotes.trim();
      const res = await fetch(`/api/quality/ncrs/${ncrId}/transition`, {
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
          <FormField
            label={reasonLabel}
            required
            error={reasonError}
            htmlFor="ncr-reason"
          >
            <Textarea
              id="ncr-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              aria-invalid={Boolean(reasonError)}
            />
          </FormField>

          {spec.fields.includes("containmentAction") && (
            <FormField
              label={translateFieldLabel("containmentAction")}
              required
              error={containmentError}
              htmlFor="ncr-containment"
            >
              <Textarea
                id="ncr-containment"
                value={containmentAction}
                onChange={(e) => setContainmentAction(e.target.value)}
                rows={4}
                maxLength={2000}
                aria-invalid={Boolean(containmentError)}
              />
            </FormField>
          )}

          {spec.fields.includes("disposition") && (
            <FormField
              label={translateFieldLabel("disposition")}
              required
              error={dispositionError}
            >
              <Select value={disposition} onValueChange={(v) => setDisposition(v as DispositionOption)}>
                <SelectTrigger className="w-full" aria-invalid={Boolean(dispositionError)}>
                  <SelectValue placeholder="" />
                </SelectTrigger>
                <SelectContent>
                  {DISPOSITION_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {spec.fields.includes("closureNotes") && (
            <FormField
              label={translateFieldLabel("closureNotes")}
              required
              error={closureError}
              htmlFor="ncr-closure"
            >
              <Textarea
                id="ncr-closure"
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                rows={4}
                maxLength={2000}
                aria-invalid={Boolean(closureError)}
              />
            </FormField>
          )}

          {(spec.to === "CLOSED" || spec.to === "CANCELLED") && (
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
