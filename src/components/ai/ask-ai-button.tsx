"use client";
// Phase 12 floating "Ask AI" button.
// CRITICAL (owner rule): Advisory-only. AI has ZERO mutation permissions.
// This component is a reusable floating button that opens a compact chat Dialog.
// For Phase 12, just the component file — wiring into individual pages is deferred.

import { useState, useRef, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Send, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types — mirror the API response shape (see src/modules/ai/service/index.ts)
// ---------------------------------------------------------------------------

interface StructuredResponse {
  answer: string;
  evidence: string;
  interpretation: string;
  recommendation: string;
  limitations: string;
}

interface AiSource {
  service: string;
  entityCode?: string;
  entityType?: string;
}

interface ChatOk {
  conversationId: string;
  messageId: string;
  response: StructuredResponse;
  sources: AiSource[];
  tokensUsed: number | null;
  available: true;
  provider: string;
  promptVersion: string;
}

interface ChatUnavailable {
  conversationId: string;
  messageId: string;
  available: false;
  error: string;
  promptVersion: string;
}

type ChatResult = ChatOk | ChatUnavailable;

interface Site {
  id: string;
  code: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Message type used in the compact dialog
// ---------------------------------------------------------------------------

interface DialogMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  structured?: StructuredResponse;
  sources?: AiSource[];
  tokensUsed?: number | null;
  available: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Site picker (inline, minimal)
// ---------------------------------------------------------------------------

function SitePicker({
  sites,
  value,
  onChange,
  label,
}: {
  sites: Site[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-transparent px-3 text-xs"
        aria-label={label}
      >
        {sites.length === 0 ? (
          <option value="">—</option>
        ) : (
          sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact structured response renderer
// ---------------------------------------------------------------------------

function CompactStructuredResponse({
  sr,
  sources,
  tokensUsed,
}: {
  sr: StructuredResponse;
  sources: AiSource[];
  tokensUsed: number | null;
}) {
  const t = useTranslations("ai");
  return (
    <div className="space-y-2">
      {/* Answer */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("answer")}
        </p>
        <p className="text-sm">{sr.answer}</p>
      </div>
      {/* Evidence */}
      <div className="rounded-md bg-muted/40 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("evidence")}
        </p>
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{sr.evidence}</p>
      </div>
      {/* Interpretation */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-2 dark:border-blue-900 dark:bg-blue-950/30">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">
          {t("interpretation")}
        </p>
        <p className="text-xs text-blue-900 dark:text-blue-200 whitespace-pre-wrap">{sr.interpretation}</p>
      </div>
      {/* Recommendation */}
      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/30">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          {t("recommendation")}
        </p>
        <p className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap">{sr.recommendation}</p>
      </div>
      {/* Limitations */}
      <div className="rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/30">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:text-red-300">
          {t("limitations")}
        </p>
        <p className="text-xs text-red-900 dark:text-red-200 whitespace-pre-wrap">{sr.limitations}</p>
      </div>
      {/* Sources */}
      {sources && sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          <span className="text-[10px] text-muted-foreground">{t("sources")}:</span>
          {sources.map((s, i) => (
            <Badge key={i} variant="outline" className="text-[10px] font-mono">
              {s.service}
            </Badge>
          ))}
        </div>
      )}
      {/* Tokens */}
      {tokensUsed != null && (
        <p className="text-[10px] text-muted-foreground">
          {tokensUsed} {t("tokensUsed")}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main floating "Ask AI" button + compact Dialog
// ---------------------------------------------------------------------------

export interface AskAiButtonProps {
  /** Optional preset question to seed the dialog input (e.g., from an analytics page). */
  initialQuestion?: string;
  /** Optional preset context (entityType/entityId) — passed to /api/ai/chat. */
  context?: { entityType?: string; entityId?: string };
  /** Optional capability hint (e.g., "kpi-analysis"). */
  capability?: string;
  /** Optional label override (defaults to t("ai.askAi")). */
  label?: string;
  /** Floating position classes. */
  className?: string;
}

export function AskAiButton({
  initialQuestion = "",
  context,
  capability,
  label,
  className = "",
}: AskAiButtonProps) {
  const t = useTranslations("ai");
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState<string>("");
  const [question, setQuestion] = useState<string>(initialQuestion);
  const [messages, setMessages] = useState<DialogMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Fetch sites (same pattern as the analytics page)
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

  // Derived effective site (first authorized site when none selected yet).
  // Avoids setState-in-effect: the Select shows effectiveSiteId and the user
  // can override it via onChange -> setSiteId.
  const effectiveSiteId = siteId || sitesQ.data?.[0]?.id || "";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isPending]);

  // Open the dialog (also seeds the question with initialQuestion).
  // Done in a callback to avoid setState-in-effect.
  const handleOpen = () => {
    setQuestion(initialQuestion);
    setOpen(true);
  };

  const handleSend = () => {
    if (!question.trim() || !effectiveSiteId) return;
    const userMsg: DialogMessage = {
      id: `local-${Date.now()}`,
      role: "USER",
      content: question,
      available: true,
    };
    setMessages((prev) => [...prev, userMsg]);
    setErrorMsg(null);
    const sentQuestion = question;
    setQuestion("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: sentQuestion,
            siteId: effectiveSiteId,
            conversationId: conversationId ?? undefined,
            capability: capability ?? "general",
            context: context,
          }),
        });
        if (res.status === 429) {
          setErrorMsg(t("rateLimited"));
          return;
        }
        if (res.status === 403) {
          setErrorMsg(t("unavailable"));
          return;
        }
        if (!res.ok) {
          setErrorMsg(t("unavailable"));
          return;
        }
        const json = await res.json();
        const data: ChatResult = json.data;
        if (!conversationId) setConversationId(data.conversationId);

        if (data.available) {
          setMessages((prev) => [
            ...prev,
            {
              id: data.messageId,
              role: "ASSISTANT",
              content: data.response.answer,
              structured: data.response,
              sources: data.sources,
              tokensUsed: data.tokensUsed,
              available: true,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: data.messageId,
              role: "ASSISTANT",
              content: data.error ?? t("unavailable"),
              available: false,
              error: data.error,
            },
          ]);
        }
      } catch {
        setErrorMsg(t("unavailable"));
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        className={`fixed bottom-6 end-6 z-40 gap-2 rounded-full shadow-lg h-12 ps-4 pe-5 ${className}`}
        aria-label={label ?? t("askAi")}
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-medium">{label ?? t("askAi")}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("title")}
            </DialogTitle>
            <DialogDescription className="sr-only">{t("subtitle")}</DialogDescription>
          </DialogHeader>

          {/* Advisory notice banner — persistent */}
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
              {t("advisoryNotice")}
            </AlertDescription>
          </Alert>

          {/* Site picker */}
          <div className="flex items-center gap-3">
            <SitePicker
              sites={sitesQ.data ?? []}
              value={effectiveSiteId}
              onChange={setSiteId}
              label={t("selectSite")}
            />
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-[280px] max-h-[40vh] overflow-y-auto rounded-md border bg-muted/20 p-2"
            aria-live="polite"
            aria-atomic="false"
          >
            <div className="space-y-3 p-1">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {t("placeholder")}
                </p>
              )}
              {messages.map((m) =>
                m.role === "USER" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {m.content}
                    </div>
                  </div>
                ) : m.available && m.structured ? (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[90%] w-full rounded-lg border bg-card p-3">
                      <CompactStructuredResponse
                        sr={m.structured}
                        sources={m.sources ?? []}
                        tokensUsed={m.tokensUsed ?? null}
                      />
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start">
                    <Alert className="max-w-[90%] border-muted bg-muted/40">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {m.error ?? t("unavailable")}
                      </AlertDescription>
                    </Alert>
                  </div>
                ),
              )}
              {isPending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("loading")}
                </div>
              )}
              {errorMsg && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="flex items-end gap-2 pt-2 border-t">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              className="min-h-[40px] max-h-32 resize-none text-sm"
              aria-label={t("placeholder")}
            />
            <Button onClick={handleSend} disabled={isPending || !question.trim() || !effectiveSiteId} size="sm">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">{t("send")}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { CompactStructuredResponse };
export type { StructuredResponse, AiSource, DialogMessage };
