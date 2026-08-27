"use client";
// Phase 14 D5 — Batch Review detail page with transition + disposition buttons.
// Calls the EXISTING APIs:
//   GET    /api/batch-review/batches/[id]                  (aggregated review data)
//   POST   /api/batch-review/batches/[id]/transition       (READY_FOR_REVIEW → QA_REVIEW)
//   POST   /api/batch-review/batches/[id]/disposition      (QA_REVIEW → APPROVED/HOLD/REWORK/REJECT)
//
// Domain state machine (D5) is enforced by the authoritative service layer; the UI
// only renders the buttons that are valid for the current status.
//
// IMPORTANT (PRD §9 D5/D8): Batch disposition is HUMAN-ONLY. AI MUST NEVER release
// product. This page surfaces a clear notice on every disposition button and
// requires reviewFindings + dispositionNotes in each dialog.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/app/status-badge";
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
interface BatchReviewRecord {
  id: string;
  status: string;
  reviewFindings: string | null;
  disposition: string | null;
  dispositionNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  dispositionedByUserId: string | null;
  dispositionedAt: string | null;
}

interface BatchDetail {
  id: string;
  code: string;
  status: string;
  plannedQuantity: string;
  actualQuantity: string | null;
  unit: string;
  createdAt: string;
  siteId: string;
  workOrderId: string;
  productRevisionId: string;
  site?: { code: string; name: string | null };
  workOrder?: { code: string };
  productRevision?: { revisionCode: string; product?: { code: string; name: string } };
  batchReviewRecord?: BatchReviewRecord | null;
}

interface BatchReviewData {
  batch: BatchDetail;
}

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------
const BATCH_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PLANNED: "outline", IN_PRODUCTION: "default", COMPLETED: "secondary",
  READY_FOR_REVIEW: "default", ON_HOLD: "destructive",
  QA_REVIEW: "default", APPROVED: "secondary", HOLD: "destructive",
  REWORK: "secondary", REJECT: "destructive",
};

const DISPOSITION_OPTIONS = ["APPROVED", "HOLD", "REWORK", "REJECT"] as const;
type DispositionOption = (typeof DISPOSITION_OPTIONS)[number];

const DISPOSITION_VARIANT: Record<DispositionOption, "default" | "secondary" | "destructive"> = {
  APPROVED: "default",
  HOLD: "secondary",
  REWORK: "secondary",
  REJECT: "destructive",
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
export default function BatchReviewDetailPage() {
  const t = useTranslations("batchReview");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useParams<{ locale: string; id: string }>();
  const id = params?.id;
  const qc = useQueryClient();
  const { toast } = useToast();

  const dataQ = useQuery<BatchReviewData>({
    queryKey: ["batch-review", "batch", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing id");
      const res = await fetch(`/api/batch-review/batches/${id}`, { credentials: "same-origin" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      return json.data as BatchReviewData;
    },
    enabled: !!id,
  });

  if (dataQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (dataQ.isError || !dataQ.data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/batch-review")} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          {t("detail.back")}
        </Button>
        <Alert variant="destructive">
          <AlertTitle>{t("detail.batchNotFound")}</AlertTitle>
          <AlertDescription>
            {dataQ.error instanceof Error ? dataQ.error.message : t("detail.batchNotFound")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const batch = dataQ.data.batch;
  const reviewRecord = batch.batchReviewRecord ?? null;
  const status = batch.status;

  const canTransition = status === "READY_FOR_REVIEW";
  const canDisposition = status === "QA_REVIEW";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/batch-review")} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            {t("detail.back")}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" />
            <span className="font-mono">{batch.code}</span>
            <Badge variant={BATCH_VARIANT[status] ?? "outline"}>{status}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => dataQ.refetch()} className="gap-1.5" aria-label={tc("refresh")}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Human-only disposition notice (always visible) */}
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">{t("dispositionGuard")}</AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
          {t("detail.dispositionHumanOnlyNotice")}
        </AlertDescription>
      </Alert>

      {/* Batch details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Field label={t("detail.fields.code")} value={<span className="font-mono text-xs">{batch.code}</span>} />
            <Field label={t("detail.fields.status")} value={<Badge variant={BATCH_VARIANT[status] ?? "outline"}>{status}</Badge>} />
            <Field label={t("detail.fields.site")} value={batch.site?.code ?? <span className="text-muted-foreground">-</span>} />
            <Field label={t("detail.fields.workOrder")} value={batch.workOrder?.code ? <span className="font-mono text-xs">{batch.workOrder.code}</span> : <span className="text-muted-foreground">-</span>} />
            <Field label={t("detail.fields.product")} value={batch.productRevision ? <span className="text-xs"><span className="font-mono">{batch.productRevision.product?.code ?? "-"}</span>{" "}{batch.productRevision.revisionCode}</span> : <span className="text-muted-foreground">-</span>} />
            <Field label={t("detail.fields.plannedQuantity")} value={<span className="text-sm">{batch.plannedQuantity} {batch.unit}</span>} />
            <Field label={t("detail.fields.actualQuantity")} value={batch.actualQuantity ? <span className="text-sm">{batch.actualQuantity} {batch.unit}</span> : <span className="text-muted-foreground">{tc("notAvailable")}</span>} />
            <Field label={t("detail.fields.createdAt")} value={<span className="text-xs text-muted-foreground">{formatDateTime(batch.createdAt)}</span>} />
          </dl>
        </CardContent>
      </Card>

      {/* Review record card */}
      {reviewRecord && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("detail.fields.reviewFindings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <Field
                label={t("detail.fields.status")}
                value={<StatusBadge status={reviewRecord.status} />}
              />
              <Field
                label={t("detail.fields.reviewFindings")}
                value={reviewRecord.reviewFindings
                  ? <span className="text-sm whitespace-pre-wrap break-words">{reviewRecord.reviewFindings}</span>
                  : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
                fullWidth
              />
              <Field
                label={t("detail.fields.disposition")}
                value={reviewRecord.disposition
                  ? <Badge variant={BATCH_VARIANT[reviewRecord.disposition] ?? "outline"}>{reviewRecord.disposition}</Badge>
                  : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              />
              <Field
                label={t("detail.fields.dispositionNotes")}
                value={reviewRecord.dispositionNotes
                  ? <span className="text-sm whitespace-pre-wrap break-words">{reviewRecord.dispositionNotes}</span>
                  : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
                fullWidth
              />
              <Field
                label={t("detail.fields.reviewedBy")}
                value={reviewRecord.reviewedByUserId
                  ? <span className="font-mono text-xs text-muted-foreground">{reviewRecord.reviewedByUserId}</span>
                  : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              />
              <Field
                label={t("detail.fields.reviewedAt")}
                value={reviewRecord.reviewedAt
                  ? <span className="text-xs text-muted-foreground">{formatDateTime(reviewRecord.reviewedAt)}</span>
                  : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              />
              <Field
                label={t("detail.fields.dispositionedBy")}
                value={reviewRecord.dispositionedByUserId
                  ? <span className="font-mono text-xs text-muted-foreground">{reviewRecord.dispositionedByUserId}</span>
                  : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              />
              <Field
                label={t("detail.fields.dispositionedAt")}
                value={reviewRecord.dispositionedAt
                  ? <span className="text-xs text-muted-foreground">{formatDateTime(reviewRecord.dispositionedAt)}</span>
                  : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              />
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Actions card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tc("actions")}</CardTitle>
        </CardHeader>
        <CardContent>
          {canTransition ? (
            <div className="flex flex-wrap gap-2">
              <TransitionDialog
                batchId={batch.id}
                translateTitle={() => t("detail.transitionTitle")}
                translateButton={() => t("detail.transitionButton")}
                reasonLabel={tc("reasonRequired")}
                cancelLabel={tc("cancel")}
                confirmLabel={tc("confirmTransition")}
                onSuccess={async () => {
                  await qc.invalidateQueries({ queryKey: ["batch-review", "batch", batch.id] });
                  toast({ title: tc("transitionSuccess"), description: `${batch.code} → QA_REVIEW` });
                }}
                onError={(msg: string) => {
                  toast({ variant: "destructive", title: tc("transitionFailed"), description: msg });
                }}
              />
            </div>
          ) : canDisposition ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{t("detail.dispositionHumanOnlyNotice")}</p>
              <div className="flex flex-wrap gap-2">
                {DISPOSITION_OPTIONS.map((disp) => (
                  <DispositionDialog
                    key={disp}
                    batchId={batch.id}
                    disposition={disp}
                    translateButton={(key) => t(`detail.dispositions.${key}`)}
                    translateTitle={(d) => t("detail.dispositionTitle", { disposition: d })}
                    reviewFindingsLabel={t("detail.reviewFindingsRequired")}
                    dispositionNotesLabel={t("detail.dispositionNotesRequired")}
                    cancelLabel={tc("cancel")}
                    confirmLabel={tc("confirm")}
                    onSuccess={async () => {
                      await qc.invalidateQueries({ queryKey: ["batch-review", "batch", batch.id] });
                      toast({ title: tc("dispositionSuccess"), description: `${batch.code} → ${disp}` });
                    }}
                    onError={(msg: string) => {
                      toast({ variant: "destructive", title: tc("dispositionFailed"), description: msg });
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("detail.noActions")}</p>
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
// TransitionDialog — READY_FOR_REVIEW → QA_REVIEW
// ---------------------------------------------------------------------------
interface TransitionDialogProps {
  batchId: string;
  translateTitle: () => string;
  translateButton: () => string;
  reasonLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}

function TransitionDialog({
  batchId, translateTitle, translateButton, reasonLabel, cancelLabel, confirmLabel,
  onSuccess, onError,
}: TransitionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() { setReason(""); }

  function canSubmit(): boolean { return reason.trim().length > 0; }

  async function handleSubmit() {
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/batch-review/batches/${batchId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ to: "QA_REVIEW", reason: reason.trim() }),
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
        <Button variant="default" size="sm" className="gap-1.5">
          {translateButton()}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{translateTitle()}</DialogTitle>
          <DialogDescription>{translateButton()}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="br-reason">{reasonLabel}</Label>
            <Textarea
              id="br-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
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

// ---------------------------------------------------------------------------
// DispositionDialog — QA_REVIEW → APPROVED/HOLD/REWORK/REJECT (HUMAN-ONLY)
// ---------------------------------------------------------------------------
interface DispositionDialogProps {
  batchId: string;
  disposition: DispositionOption;
  translateButton: (key: string) => string;
  translateTitle: (d: string) => string;
  reviewFindingsLabel: string;
  dispositionNotesLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}

function DispositionDialog({
  batchId, disposition, translateButton, translateTitle, reviewFindingsLabel,
  dispositionNotesLabel, cancelLabel, confirmLabel, onSuccess, onError,
}: DispositionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reviewFindings, setReviewFindings] = useState("");
  const [dispositionNotes, setDispositionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setReviewFindings("");
    setDispositionNotes("");
  }

  function canSubmit(): boolean {
    return reviewFindings.trim().length > 0 && dispositionNotes.trim().length > 0;
  }

  async function handleSubmit() {
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/batch-review/batches/${batchId}/disposition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          disposition,
          reviewFindings: reviewFindings.trim(),
          dispositionNotes: dispositionNotes.trim(),
        }),
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
        <Button variant={DISPOSITION_VARIANT[disposition]} size="sm" className="gap-1.5">
          {translateButton(disposition)}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{translateTitle(disposition)}</DialogTitle>
          <DialogDescription>{translateButton(disposition)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
              HUMAN-ONLY action — AI must never disposition product.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="br-findings">{reviewFindingsLabel}</Label>
            <Textarea
              id="br-findings"
              value={reviewFindings}
              onChange={(e) => setReviewFindings(e.target.value)}
              rows={5}
              maxLength={5000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="br-notes">{dispositionNotesLabel}</Label>
            <Textarea
              id="br-notes"
              value={dispositionNotes}
              onChange={(e) => setDispositionNotes(e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>
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
