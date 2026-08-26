"use client";
// Phase 12 AI Assistant page.
// CRITICAL (owner rule): The UI is ADVISORY-ONLY. AI has ZERO mutation permissions.
// The page only calls /api/ai/chat and renders the structured response.
// All strings come from useTranslations("ai").
//
// Layout:
//   - Two columns on lg+ (conversation sidebar ~30% / chat panel ~70%)
//   - Single column on mobile (sidebar collapses into a Sheet/drawer)
//
// See: src/modules/ai/service/index.ts for the backend contract.

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Plus, Send, AlertTriangle, Loader2, Database, Info, Lightbulb,
  ShieldAlert, MessageSquare, Archive, Menu, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types — mirror the API contract
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

interface Site {
  id: string;
  code: string;
  name: string;
}

type Capability =
  | "general"
  | "batch-investigation"
  | "root-cause"
  | "recurrence"
  | "trend-explanation"
  | "kpi-analysis"
  | "report-draft";

const CAPABILITIES: Capability[] = [
  "general",
  "batch-investigation",
  "root-cause",
  "recurrence",
  "trend-explanation",
  "kpi-analysis",
  "report-draft",
];

interface ConversationListItem {
  id: string;
  title: string;
  capability: string | null;
  status: string;
  siteId: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface ConversationMessage {
  id: string;
  role: string; // "USER" | "ASSISTANT"
  content: string;
  structuredResponse?: string | null;
  sources?: string | null;
  tokensUsed?: number | null;
  available?: boolean | null;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  title: string;
  capability: string | null;
  status: string;
  siteId: string;
  messages: ConversationMessage[];
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStructured(raw: string | null | undefined): StructuredResponse | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.answer === "string" &&
      typeof parsed.evidence === "string" &&
      typeof parsed.interpretation === "string" &&
      typeof parsed.recommendation === "string" &&
      typeof parsed.limitations === "string"
    ) {
      return parsed as StructuredResponse;
    }
  } catch {
    /* malformed JSON */
  }
  return null;
}

function parseSources(raw: string | null | undefined): AiSource[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (s): s is AiSource =>
          s && typeof s === "object" && typeof s.service === "string",
      );
    }
  } catch {
    /* malformed JSON */
  }
  return [];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// 5-part structured response renderer
// ---------------------------------------------------------------------------

function StructuredResponseView({
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
    <div className="space-y-3">
      {/* Answer */}
      <section aria-label={t("answer")}>
        <p className="text-sm">{sr.answer}</p>
      </section>

      {/* Evidence */}
      <section
        aria-label={t("evidence")}
        className="rounded-md border bg-muted/40 p-3"
      >
        <header className="flex items-center gap-1.5 mb-1">
          <Database className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("evidence")}
          </h4>
        </header>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sr.evidence}</p>
      </section>

      {/* Interpretation */}
      <section
        aria-label={t("interpretation")}
        className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30"
      >
        <header className="flex items-center gap-1.5 mb-1">
          <Info className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-300">
            {t("interpretation")}
          </h4>
        </header>
        <p className="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-wrap">{sr.interpretation}</p>
      </section>

      {/* Recommendation */}
      <section
        aria-label={t("recommendation")}
        className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30"
      >
        <header className="flex items-center gap-1.5 mb-1">
          <Lightbulb className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            {t("recommendation")}
          </h4>
        </header>
        <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">{sr.recommendation}</p>
      </section>

      {/* Limitations */}
      <section
        aria-label={t("limitations")}
        className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30"
      >
        <header className="flex items-center gap-1.5 mb-1">
          <ShieldAlert className="h-3.5 w-3.5 text-red-700 dark:text-red-300" />
          <h4 className="text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-300">
            {t("limitations")}
          </h4>
        </header>
        <p className="text-sm text-red-900 dark:text-red-200 whitespace-pre-wrap">{sr.limitations}</p>
      </section>

      {/* Sources consulted */}
      {sources.length > 0 && (
        <section aria-label={t("sources")} className="pt-1">
          <p className="text-[10px] text-muted-foreground mb-1">{t("sources")}:</p>
          <div className="flex flex-wrap gap-1">
            {sources.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-mono gap-1">
                <span className="h-1 w-1 rounded-full bg-primary/60" />
                {s.service}
                {s.entityType && (
                  <span className="text-muted-foreground">·{s.entityType}</span>
                )}
                {s.entityCode && (
                  <span className="text-muted-foreground">:{s.entityCode}</span>
                )}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Tokens used footer */}
      {tokensUsed != null && (
        <footer className="text-[10px] text-muted-foreground pt-1 border-t">
          {tokensUsed} {t("tokensUsed")}
        </footer>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single message renderer
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  structured?: StructuredResponse | null;
  sources?: AiSource[];
  tokensUsed?: number | null;
  available: boolean;
  error?: string;
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const t = useTranslations("ai");

  if (msg.role === "USER") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap break-words">
          {msg.content}
        </div>
      </div>
    );
  }

  // ASSISTANT
  if (!msg.available) {
    return (
      <div className="flex justify-start">
        <Alert className="max-w-[90%] border-muted bg-muted/40">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <AlertTitle className="text-sm text-muted-foreground">
            {t("unavailable")}
          </AlertTitle>
          {msg.error && (
            <AlertDescription className="text-xs text-muted-foreground">
              {msg.error}
            </AlertDescription>
          )}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <Card className="max-w-[92%] w-full">
        <CardContent className="p-4">
          {msg.structured ? (
            <StructuredResponseView
              sr={msg.structured}
              sources={msg.sources ?? []}
              tokensUsed={msg.tokensUsed ?? null}
            />
          ) : (
            // Fallback if structuredResponse wasn't persisted (shouldn't happen for available messages)
            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation sidebar item
// ---------------------------------------------------------------------------

function ConversationItem({
  conv,
  active,
  onSelect,
  onArchive,
  canArchive,
}: {
  conv: ConversationListItem;
  active: boolean;
  onSelect: () => void;
  onArchive: () => void;
  canArchive: boolean;
}) {
  const t = useTranslations("ai");
  const capabilityLabel = conv.capability
    ? t(`capabilities.${conv.capability}` as const)
    : t("capabilities.general");
  return (
    <div
      className={cn(
        "group rounded-md border p-2 cursor-pointer transition-colors",
        active ? "border-primary bg-primary/5" : "hover:bg-muted/50",
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{conv.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">{capabilityLabel}</Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {conv._count.messages}
            </span>
            {conv.status === "ARCHIVED" && (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {t("archived")}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(conv.createdAt)}</p>
        </div>
        {canArchive && conv.status !== "ARCHIVED" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            aria-label={t("archive")}
            title={t("archive")}
          >
            <Archive className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation sidebar (shared between desktop and mobile)
// ---------------------------------------------------------------------------

interface SidebarProps {
  conversations: ConversationListItem[];
  loading: boolean;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onArchive: (id: string) => void;
  canArchive: boolean;
}

function ConversationSidebar({
  conversations, loading, activeId, onSelect, onNew, onArchive, canArchive,
}: SidebarProps) {
  const t = useTranslations("ai");
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          {t("conversations")}
        </h2>
        <Button size="sm" variant="outline" onClick={onNew} className="h-8 gap-1">
          <Plus className="h-3.5 w-3.5" />
          {t("newConversation")}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-12rem)]">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">{t("noConversations")}</p>
          </div>
        ) : (
          conversations.map((c) => (
            <ConversationItem
              key={c.id}
              conv={c}
              active={activeId === c.id}
              onSelect={() => onSelect(c.id)}
              onArchive={() => onArchive(c.id)}
              canArchive={canArchive}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AiAssistantPage() {
  const t = useTranslations("ai");
  const qc = useQueryClient();

  // Local state
  const [siteId, setSiteId] = useState<string>("");
  const [capability, setCapability] = useState<Capability>("general");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Session + sites
  const meQ = useQuery<{ permissions?: string[] }>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/me", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      return json.data as { permissions?: string[] };
    },
    staleTime: 60_000,
  });
  const permissions = new Set(meQ.data?.permissions ?? []);
  const canArchive = permissions.has("ai.history.delete");

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

  // Conversation list
  const conversationsQ = useQuery<ConversationListItem[]>({
    queryKey: ["ai", "conversations"],
    queryFn: async () => {
      const res = await fetch("/api/ai/conversations?page=1&pageSize=50", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load conversations");
      const json = await res.json();
      return (json.data ?? []) as ConversationListItem[];
    },
    refetchInterval: 30_000,
  });

  // Conversation detail (when selected)
  const convDetailQ = useQuery<ConversationDetail | null>({
    queryKey: ["ai", "conversation", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const res = await fetch(`/api/ai/conversations/${conversationId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load conversation");
      const json = await res.json();
      return json.data as ConversationDetail;
    },
    enabled: !!conversationId,
  });

  // When a conversation loads, populate the messages state
  useEffect(() => {
    if (convDetailQ.data) {
      const loaded: ChatMessage[] = (convDetailQ.data.messages ?? []).map((m) => {
        const structured = parseStructured(m.structuredResponse);
        const sources = parseSources(m.sources);
        const isAssistant = m.role === "ASSISTANT";
        const available = isAssistant ? (m.available ?? true) : true;
        return {
          id: m.id,
          role: isAssistant ? "ASSISTANT" : "USER",
          content: m.content,
          structured,
          sources,
          tokensUsed: m.tokensUsed ?? null,
          available,
        };
      });
      setMessages(loaded);
      setErrorMsg(null);
    }
  }, [convDetailQ.data]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, sending]);

  // Start a new conversation
  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setInput("");
    setErrorMsg(null);
    setMobileSidebarOpen(false);
  }, []);

  // Select an existing conversation
  const handleSelectConversation = useCallback((id: string) => {
    setConversationId(id);
    setMessages([]);
    setErrorMsg(null);
    setMobileSidebarOpen(false);
  }, []);

  // Archive a conversation (only ai.history.delete)
  const handleArchive = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/ai/conversations/${id}/archive`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (!res.ok) {
          setErrorMsg(t("unavailable"));
          return;
        }
        // Refresh the conversation list
        qc.invalidateQueries({ queryKey: ["ai", "conversations"] });
        // If we archived the currently active conversation, clear it
        if (conversationId === id) {
          setConversationId(null);
          setMessages([]);
        }
      } catch {
        setErrorMsg(t("unavailable"));
      }
    },
    [conversationId, qc, t],
  );

  // Send a chat message
  const handleSend = useCallback(async () => {
    if (!input.trim() || !effectiveSiteId || sending) return;

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "USER",
      content: input,
      available: true,
    };
    setMessages((prev) => [...prev, userMsg]);
    setErrorMsg(null);
    setSending(true);
    const sentQuestion = input;
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: sentQuestion,
          siteId: effectiveSiteId,
          conversationId: conversationId ?? undefined,
          capability,
        }),
      });

      if (res.status === 429) {
        setErrorMsg(t("rateLimited"));
        setSending(false);
        return;
      }
      if (res.status === 403) {
        setErrorMsg(t("unavailable"));
        setSending(false);
        return;
      }
      if (!res.ok) {
        setErrorMsg(t("unavailable"));
        setSending(false);
        return;
      }

      const json = await res.json();
      const data: ChatResult = json.data;

      // Capture the new conversationId (first message creates a conversation)
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
        qc.invalidateQueries({ queryKey: ["ai", "conversations"] });
      }

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
    } finally {
      setSending(false);
    }
  }, [input, effectiveSiteId, sending, conversationId, capability, qc, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {/* Mobile sidebar trigger */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden gap-1.5">
              <Menu className="h-4 w-4" />
              {t("conversations")}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[360px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{t("conversations")}</SheetTitle>
            </SheetHeader>
            <ConversationSidebar
              conversations={conversationsQ.data ?? []}
              loading={conversationsQ.isLoading}
              activeId={conversationId}
              onSelect={handleSelectConversation}
              onNew={handleNewConversation}
              onArchive={handleArchive}
              canArchive={canArchive}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-[30%_1fr]">
        {/* Desktop sidebar */}
        <Card className="hidden lg:block h-[calc(100vh-12rem)] overflow-hidden">
          <ConversationSidebar
            conversations={conversationsQ.data ?? []}
            loading={conversationsQ.isLoading}
            activeId={conversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onArchive={handleArchive}
            canArchive={canArchive}
          />
        </Card>

        {/* Chat panel */}
        <Card className="flex flex-col h-[calc(100vh-12rem)]">
          {/* Advisory notice banner — persistent */}
          <Alert className="rounded-none border-0 border-b border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
              {t("advisoryNotice")}
            </AlertDescription>
          </Alert>

          {/* Top controls */}
          <div className="flex flex-wrap items-end gap-3 p-3 border-b">
            {/* Site selector */}
            <div className="space-y-1">
              <Label className="text-xs">{t("selectSite")}</Label>
              <Select value={effectiveSiteId} onValueChange={setSiteId}>
                <SelectTrigger className="w-[240px] text-xs" aria-label={t("selectSite")}>
                  <SelectValue placeholder={t("selectSite")} />
                </SelectTrigger>
                <SelectContent>
                  {(sitesQ.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Capability selector */}
            <div className="space-y-1">
              <Label className="text-xs">{t("capability")}</Label>
              <Select value={capability} onValueChange={(v) => setCapability(v as Capability)}>
                <SelectTrigger className="w-[200px] text-xs" aria-label={t("capability")}>
                  <SelectValue placeholder={t("capability")} />
                </SelectTrigger>
                <SelectContent>
                  {CAPABILITIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {t(`capabilities.${c}` as const)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {conversationId && (
              <Badge variant="outline" className="text-[10px] font-mono gap-1">
                <Cpu className="h-3 w-3" />
                {conversationId.slice(0, 8)}…
              </Badge>
            )}
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(100vh-20rem)]"
            aria-live="polite"
            aria-atomic="false"
            aria-label={t("title")}
          >
            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground max-w-md">{t("placeholder")}</p>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} />
            ))}
            {sending && (
              <div className="flex justify-start">
                <Card className="max-w-[80%]">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{t("loading")}</span>
                  </CardContent>
                </Card>
              </div>
            )}
            {errorMsg && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
              </Alert>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("placeholder")}
                className="min-h-[44px] max-h-32 resize-none text-sm"
                aria-label={t("placeholder")}
                disabled={sending}
              />
              <Button
                onClick={() => void handleSend()}
                disabled={sending || !input.trim() || !effectiveSiteId}
                className="h-auto gap-1.5"
                aria-label={t("send")}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="text-sm">{t("send")}</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Enter ↵ to send · Shift+Enter for newline
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
