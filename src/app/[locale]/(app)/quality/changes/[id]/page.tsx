"use client";
// Phase 14 D5 — Change Control detail page with transition buttons.
// Calls the EXISTING transition API: POST /api/quality/changes/[id]/transition
// Domain state machine (D6) is enforced by the authoritative service layer; the UI
// only renders the buttons that are valid for the current status.
//
// D6 guard: Implementation requires prior human approval (the APPROVAL→IMPLEMENTATION
// transition is performed via the human-only approve endpoint, NOT the transition endpoint).
// The transition endpoint will reject IMPLEMENTATION if approval has not been recorded.
// This page surfaces a clear notice when the IMPLEMENTATION button is shown.
//
// NOTE: There is no GET /api/quality/changes/[id] endpoint — the [id] route.ts only
// handles POST (human approval). This page fetches from the list endpoint
// (GET /api/quality/changes?pageSize=100) and filters client-side by ID.

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
import { ActivityTimeline } from "@/components/app/activity-timeline";

// ---------------------------------------------------------------------------
// Types — mirror the API contract
// ---------------------------------------------------------------------------
interface ChangeDetail {
  id: string;
  code: string;
  status: string;
  changeType: string;
  description: string;
  reason: string;
  impactAssessment: string | null;
  implementationPlan: string | null;
  verificationPlan: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  siteId: string;
  site?: { code: string };
}

// ---------------------------------------------------------------------------
// Status styling
// ---------------------------------------------------------------------------
const CHG_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  REQUEST: "outline", IMPACT: "outline", RISK: "default", APPROVAL: "default",
  IMPLEMENTATION: "default", VERIFICATION: "secondary", EFFECTIVENESS: "secondary",
  CLOSED: "secondary", REJECTED: "destructive",
};

// ---------------------------------------------------------------------------
// Transition specs (D6 state machine — UI mirror only)
// ---------------------------------------------------------------------------
type FieldKind = "impactAssessment" | "implementationPlan" | "verificationPlan";

interface TransitionSpec {
  to: string;
  labelKey: string;
  fields: FieldKind[];
  variant?: "default" | "outline" | "destructive" | "secondary";
  /** Whether to show the implementation-needs-approval notice. */
  showApprovalNotice?: boolean;
}

const TRANSITIONS_BY_STATUS: Record<string, TransitionSpec[]> = {
  REQUEST: [
    { to: "IMPACT", labelKey: "IMPACT", fields: [], variant: "default" },
    { to: "REJECTED", labelKey: "REJECTED", fields: [], variant: "destructive" },
  ],
  IMPACT: [
    { to: "RISK", labelKey: "RISK", fields: ["impactAssessment"], variant: "default" },
    { to: "REJECTED", labelKey: "REJECTED", fields: [], variant: "destructive" },
  ],
  RISK: [
    { to: "APPROVAL", labelKey: "APPROVAL", fields: [], variant: "default" },
    { to: "REJECTED", labelKey: "REJECTED", fields: [], variant: "destructive" },
  ],
  APPROVAL: [
    { to: "IMPLEMENTATION", labelKey: "IMPLEMENTATION", fields: [], variant: "default", showApprovalNotice: true },
    { to: "REJECTED", labelKey: "REJECTED", fields: [], variant: "destructive" },
  ],
  IMPLEMENTATION: [
    { to: "VERIFICATION", labelKey: "VERIFICATION", fields: ["implementationPlan"], variant: "secondary" },
  ],
  VERIFICATION: [
    { to: "EFFECTIVENESS", labelKey: "EFFECTIVENESS", fields: ["verificationPlan"], variant: "secondary" },
  ],
  EFFECTIVENESS: [
    { to: "CLOSED", labelKey: "CLOSED", fields: [], variant: "secondary" },
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
export default function ChangeDetailPage() {
  const t = useTranslations("quality");
  const tc = useTranslations("common");
  const router = useRouter();
  const params = useParams<{ locale: string; id: string }>();
  const id = params?.id;
  const qc = useQueryClient();
  const { toast } = useToast();

  const changeQ = useQuery<ChangeDetail>({
    queryKey: ["quality", "change", id],
    queryFn: async () => {
      if (!id) throw new Error("Missing id");
      const res = await fetch("/api/quality/changes?pageSize=100", { credentials: "same-origin" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const items = (json.data ?? []) as ChangeDetail[];
      const found = items.find((c) => c.id === id);
      if (!found) throw new Error("Change control not found");
      return found;
    },
    enabled: !!id,
  });

  if (changeQ.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (changeQ.isError || !changeQ.data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/quality/changes")} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Button>
        <Alert variant="destructive">
          <AlertTitle>{tc("notFound")}</AlertTitle>
          <AlertDescription>
            {changeQ.error instanceof Error ? changeQ.error.message : tc("notFound")}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const change = changeQ.data;
  const transitions = TRANSITIONS_BY_STATUS[change.status] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push("/quality/changes")} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
            <span className="font-mono">{change.code}</span>
            <Badge variant={CHG_VARIANT[change.status] ?? "outline"}>{change.status}</Badge>
            <Badge variant="outline">{change.changeType}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{t("changes.subtitle")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => changeQ.refetch()} className="gap-1.5" aria-label={tc("refresh")}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("changes.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Field label={t("changes.detail.fields.code")} value={<span className="font-mono text-xs">{change.code}</span>} />
            <Field label={t("changes.detail.fields.status")} value={<Badge variant={CHG_VARIANT[change.status] ?? "outline"}>{change.status}</Badge>} />
            <Field label={t("changes.detail.fields.changeType")} value={<Badge variant="outline">{change.changeType}</Badge>} />
            <Field label={t("changes.detail.fields.site")} value={change.site?.code ?? <span className="text-muted-foreground">-</span>} />
            <Field label={t("changes.detail.fields.description")} value={<span className="text-sm whitespace-pre-wrap break-words">{change.description}</span>} fullWidth />
            <Field label={t("changes.detail.fields.reason")} value={<span className="text-sm whitespace-pre-wrap break-words">{change.reason}</span>} fullWidth />
            <Field
              label={t("changes.detail.fields.impactAssessment")}
              value={change.impactAssessment
                ? <span className="text-sm whitespace-pre-wrap break-words">{change.impactAssessment}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              fullWidth
            />
            <Field
              label={t("changes.detail.fields.implementationPlan")}
              value={change.implementationPlan
                ? <span className="text-sm whitespace-pre-wrap break-words">{change.implementationPlan}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              fullWidth
            />
            <Field
              label={t("changes.detail.fields.verificationPlan")}
              value={change.verificationPlan
                ? <span className="text-sm whitespace-pre-wrap break-words">{change.verificationPlan}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
              fullWidth
            />
            <Field
              label={t("changes.detail.fields.approvedByUserId")}
              value={change.approvedByUserId
                ? <span className="font-mono text-xs text-muted-foreground">{change.approvedByUserId}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field
              label={t("changes.detail.fields.approvedAt")}
              value={change.approvedAt
                ? <span className="text-xs text-muted-foreground">{formatDateTime(change.approvedAt)}</span>
                : <span className="text-muted-foreground">{tc("notAvailable")}</span>}
            />
            <Field
              label={t("changes.detail.fields.createdAt")}
              value={<span className="text-xs text-muted-foreground">{formatDateTime(change.createdAt)}</span>}
            />
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
            <p className="text-sm text-muted-foreground">{t("changes.detail.noTransitions")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {transitions.map((spec) => (
                <TransitionDialog
                  key={spec.to}
                  spec={spec}
                  changeId={change.id}
                  translateLabel={(key) => t(`changes.detail.transitions.${key}`)}
                  translateTitle={(to) => t("changes.detail.transitionTitle", { to })}
                  impactLabel={t("changes.detail.impactAssessmentRequired")}
                  implementationLabel={t("changes.detail.implementationPlanRequired")}
                  verificationLabel={t("changes.detail.verificationPlanRequired")}
                  approvalNotice={t("changes.detail.implementationNeedsApprovalNotice")}
                  reasonLabel={tc("reasonRequired")}
                  cancelLabel={tc("cancel")}
                  confirmLabel={tc("confirmTransition")}
                  onSuccess={async () => {
                    await qc.invalidateQueries({ queryKey: ["quality", "change", change.id] });
                    await qc.invalidateQueries({ queryKey: ["changes"] });
                    toast({ title: tc("transitionSuccess"), description: `${change.code} → ${spec.to}` });
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
      <ActivityTimeline entityType="ChangeControl" entityId={change.id} />
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
  changeId: string;
  translateLabel: (key: string) => string;
  translateTitle: (to: string) => string;
  impactLabel: string;
  implementationLabel: string;
  verificationLabel: string;
  approvalNotice: string;
  reasonLabel: string;
  cancelLabel: string;
  confirmLabel: string;
  onSuccess: () => Promise<void> | void;
  onError: (msg: string) => void;
}

function TransitionDialog({
  spec, changeId, translateLabel, translateTitle, impactLabel, implementationLabel,
  verificationLabel, approvalNotice, reasonLabel, cancelLabel, confirmLabel, onSuccess, onError,
}: TransitionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [impactAssessment, setImpactAssessment] = useState("");
  const [implementationPlan, setImplementationPlan] = useState("");
  const [verificationPlan, setVerificationPlan] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setReason("");
    setImpactAssessment("");
    setImplementationPlan("");
    setVerificationPlan("");
  }

  function canSubmit(): boolean {
    if (!reason.trim()) return false;
    if (spec.fields.includes("impactAssessment") && !impactAssessment.trim()) return false;
    if (spec.fields.includes("implementationPlan") && !implementationPlan.trim()) return false;
    if (spec.fields.includes("verificationPlan") && !verificationPlan.trim()) return false;
    return true;
  }

  async function handleSubmit() {
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { to: spec.to, reason: reason.trim() };
      if (spec.fields.includes("impactAssessment")) body.impactAssessment = impactAssessment.trim();
      if (spec.fields.includes("implementationPlan")) body.implementationPlan = implementationPlan.trim();
      if (spec.fields.includes("verificationPlan")) body.verificationPlan = verificationPlan.trim();
      const res = await fetch(`/api/quality/changes/${changeId}/transition`, {
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

  const isTerminal = spec.to === "CLOSED" || spec.to === "REJECTED";

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
          {spec.showApprovalNotice && (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
                {approvalNotice}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="chg-reason">{reasonLabel}</Label>
            <Textarea
              id="chg-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          {spec.fields.includes("impactAssessment") && (
            <div className="space-y-1.5">
              <Label htmlFor="chg-impact">{impactLabel}</Label>
              <Textarea
                id="chg-impact"
                value={impactAssessment}
                onChange={(e) => setImpactAssessment(e.target.value)}
                rows={4}
                maxLength={2000}
              />
            </div>
          )}

          {spec.fields.includes("implementationPlan") && (
            <div className="space-y-1.5">
              <Label htmlFor="chg-impl">{implementationLabel}</Label>
              <Textarea
                id="chg-impl"
                value={implementationPlan}
                onChange={(e) => setImplementationPlan(e.target.value)}
                rows={5}
                maxLength={5000}
              />
            </div>
          )}

          {spec.fields.includes("verificationPlan") && (
            <div className="space-y-1.5">
              <Label htmlFor="chg-verif">{verificationLabel}</Label>
              <Textarea
                id="chg-verif"
                value={verificationPlan}
                onChange={(e) => setVerificationPlan(e.target.value)}
                rows={5}
                maxLength={5000}
              />
            </div>
          )}

          {isTerminal && (
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
