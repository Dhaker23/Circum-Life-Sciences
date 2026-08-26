// Phase 12 AI orchestration service.
// CRITICAL ARCHITECTURE (owner rule):
//   Authorization → Context Selection → Prompt → Provider → Structured Response → Audit
// The AI is ADVISORY ONLY. It has ZERO mutation permissions. It operates in the user's context.
// Core workflows never call AI (Local-First, D6).
//
// Decisions implemented:
//   D1: provider abstraction (getProvider()).
//   D3: AiConversation + AiMessage (append-only, site-owned, user-scoped).
//   D4: reuse AuditEvent (action="ai.chat").
//   D5: simple context-stuffing with token limits (no vector DB).
//   D6: Local-First fallback (provider unavailable = explicit, non-blocking).
//   D7: in-memory rate limit (20/5min/user).
//   D8: audit every query + denials + rate-limit + provider-unavailable.
//   D9: AI has ZERO mutation permissions; operates in user's context.
//   D10: PRD §9-derived system prompt (versioned, no invented rules).
//   D11: capabilities shape context (advisory, not permission-affecting).
//   D13: token tracking in AiMessage.tokensUsed.

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ForbiddenError, NotFoundError, TooManyRequestsError, ValidationError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import { getProvider } from "../provider/factory";
import { SYSTEM_PROMPT, SYSTEM_PROMPT_VERSION } from "../domain/system-prompt";
import {
  ChatRequestSchema,
  parseStructuredResponse,
  validateStructuredResponse,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  MAX_CONTEXT_TOKENS,
  type Capability,
  type StructuredResponse,
  type AiSource,
} from "../domain";
import type z from "zod";

// ============================================================================
// Rate limiting (D7: in-memory, per-user, 20/5min)
// ============================================================================

interface RateLimitEntry { count: number; windowStart: number; }
const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new TooManyRequestsError(`Rate limit exceeded: ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 60000} minutes`);
  }
  entry.count++;
}

// ============================================================================
// Context resolver (D5: simple context-stuffing; D11: capability-based)
// ============================================================================

// Resolve authorized context for the user's question.
// CRITICAL (owner rule): Authorization → Context Selection → Prompt.
// The AI receives ONLY the user's authorized data. Site isolation enforced HERE, not in the prompt.
async function resolveContext(
  ctx: AuthContext,
  question: string,
  capability: Capability | undefined,
  siteId: string,
  contextHint?: { entityType?: string; entityId?: string },
): Promise<{ contextText: string; sources: AiSource[] }> {
  const sources: AiSource[] = [];
  const contextParts: string[] = [];

  // Default site scope: the user's first authorized site (or the specified siteId)
  const effectiveSiteId = siteId;
  assertSiteAccess(ctx, effectiveSiteId);

  const range = {
    fromDate: new Date(Date.now() - 7 * 86400000),
    toDate: new Date(),
  };

  // Capability-based context (D11)
  if (capability === "kpi-analysis" || capability === "general" || !capability) {
    // Fetch a summary of recent analytics for the site
    try {
      // Consume Phase 11 analytics (single source of truth)
      const { getOeeDashboard, getQualityDashboard, getCriticalProblemsDashboard } = await import("@/modules/analytics/service");
      const oee = await getOeeDashboard(ctx, { siteId: effectiveSiteId, ...range });
      const quality = await getQualityDashboard(ctx, { siteId: effectiveSiteId, ...range });
      const critical = await getCriticalProblemsDashboard(ctx, { siteId: effectiveSiteId });
      contextParts.push(`--- Recent OEE (last 7 days) ---\nOEE: ${oee.oee ?? "unavailable"}, Availability: ${oee.availability ?? "unavailable"}, Performance: ${oee.performance ?? "unavailable"}, Quality: ${oee.quality ?? "unavailable"}\nSources: plannedTime=${oee.sources.plannedTimeMinutes}min, downtime=${oee.sources.downtimeMinutes}min, runTime=${oee.sources.runTimeMinutes}min, totalCount=${oee.sources.totalCount}`);
      sources.push({ service: "analytics.getOeeDashboard", entityType: "OEE", entityCode: effectiveSiteId });
      contextParts.push(`--- Quality Summary ---\nFPY: ${quality.fpy ?? "unavailable"}, RejectRate: ${quality.rejectRate ?? "unavailable"}, OpenNCRs: ${quality.openNcrs}, OpenCAPAs: ${quality.openCapas}, TestPass: ${quality.testPassCount}, TestFail: ${quality.testFailCount}`);
      sources.push({ service: "analytics.getQualityDashboard" });
      if (critical.items.length > 0) {
        contextParts.push(`--- Critical Problems (RPN >= ${critical.threshold}) ---\n${critical.items.map((i) => `${i.type} ${i.code}: RPN=${i.rpn}, status=${i.status}`).join("\n")}`);
        sources.push({ service: "analytics.getCriticalProblemsDashboard" });
      }
    } catch { /* analytics unavailable; continue */ }
  }

  if (capability === "batch-investigation" || capability === "root-cause") {
    // Fetch traceability/quality context if an entity is specified
    if (contextHint?.entityType && contextHint?.entityId) {
      try {
        const { genealogyTree } = await import("@/modules/traceability/service");
        const graph = await genealogyTree(ctx, { entityType: contextHint.entityType as any, entityId: contextHint.entityId });
        const nodeSummary = graph.nodes.slice(0, 20).map((n) => `${n.entityType}:${n.code}`).join(", ");
        contextParts.push(`--- Genealogy for ${contextHint.entityType}:${contextHint.entityId} ---\nNodes: ${nodeSummary}\nSummary: ${graph.summary.totalNodes} nodes`);
        sources.push({ service: "traceability.genealogyTree", entityType: contextHint.entityType, entityCode: contextHint.entityId });
      } catch { /* traceability unavailable; continue */ }
    }
    // Fetch recent NCRs/Deviations for context
    try {
      const ncrs = await db.nCR.findMany({ where: { siteId: effectiveSiteId, status: { notIn: ["CLOSED", "CANCELLED"] } }, take: 5, orderBy: { createdAt: "desc" }, select: { code: true, description: true, severity: true, status: true } });
      if (ncrs.length > 0) {
        contextParts.push(`--- Recent Open NCRs ---\n${ncrs.map((n) => `${n.code} [${n.severity}/${n.status}]: ${n.description.slice(0, 100)}`).join("\n")}`);
        sources.push({ service: "db.nCR.findMany", entityType: "NCR" });
      }
    } catch { /* continue */ }
  }

  if (capability === "recurrence") {
    try {
      const { getRecurrenceReport } = await import("@/modules/analytics/service");
      const recurrence = await getRecurrenceReport(ctx, { siteId: effectiveSiteId, ...range });
      if (recurrence.items.length > 0) {
        contextParts.push(`--- Recurrence Report ---\n${recurrence.items.slice(0, 10).map((r) => `${r.subjectType}:${r.subjectLabel} — ${r.occurrences} occurrences`).join("\n")}`);
        sources.push({ service: "analytics.getRecurrenceReport" });
      }
    } catch { /* continue */ }
  }

  if (capability === "trend-explanation") {
    try {
      const { getOeeTrend } = await import("@/modules/analytics/service");
      const trend = await getOeeTrend(ctx, { siteId: effectiveSiteId, ...range, granularity: "DAY" });
      const trendSummary = trend.buckets.map((b) => `${b.bucketStart.slice(0, 10)}: OEE=${b.values.oee ?? "null"}`).join(", ");
      contextParts.push(`--- OEE Trend (last 7 days) ---\n${trendSummary}`);
      sources.push({ service: "analytics.getOeeTrend" });
    } catch { /* continue */ }
  }

  // RAG over approved documents (D5: simple context-stuffing)
  // If the question mentions "document", "SOP", "procedure", "specification", fetch relevant EFFECTIVE docs
  const docKeywords = ["document", "sop", "procedure", "specification", "work instruction", "protocol", "form"];
  if (docKeywords.some((kw) => question.toLowerCase().includes(kw))) {
    try {
      const docs = await db.controlledDocument.findMany({
        where: { status: "EFFECTIVE" },
        take: 3,
        orderBy: { updatedAt: "desc" },
        select: { code: true, title: true, documentType: true, version: true, description: true },
      });
      if (docs.length > 0) {
        contextParts.push(`--- Relevant Approved Documents (EFFECTIVE) ---\n${docs.map((d) => `${d.code} v${d.version} [${d.documentType}]: ${d.title}\nDescription: ${(d.description ?? "").slice(0, 200)}`).join("\n")}`);
        sources.push({ service: "db.controlledDocument.findMany", entityType: "ControlledDocument" });
      }
    } catch { /* continue */ }
  }

  // Truncate context to approximate token limit (D5)
  const fullContext = contextParts.join("\n\n");
  const truncated = fullContext.length > MAX_CONTEXT_TOKENS * 4 // ~4 chars per token
    ? fullContext.slice(0, MAX_CONTEXT_TOKENS * 4) + "\n[... context truncated due to token limit ...]"
    : fullContext;

  return { contextText: truncated, sources };
}

// ============================================================================
// AI Chat (the main orchestration function)
// ============================================================================

export interface ChatResult {
  conversationId: string;
  messageId: string;
  response: StructuredResponse;
  sources: AiSource[];
  tokensUsed: number | null;
  available: true;
  provider: string;
  promptVersion: string;
}

export interface ChatUnavailable {
  conversationId: string;
  messageId: string;
  available: false;
  error: string;
  promptVersion: string;
}

export async function chat(
  ctx: AuthContext,
  input: z.infer<typeof ChatRequestSchema>,
): Promise<ChatResult | ChatUnavailable> {
  if (!can(ctx, "ai.chat")) throw new ForbiddenError();
  assertSiteAccess(ctx, input.siteId);

  // D7: rate limit
  try {
    checkRateLimit(ctx.user.id);
  } catch (e) {
    // D8: audit rate-limit hit
    await audit({ actorUserId: ctx.user.id, action: "ai.rate-limited", entityType: "AiChat", entityId: null, outcome: "FAILURE", reason: `Rate limit: ${(e as Error).message}` });
    throw e;
  }

  // Resolve or create conversation (D3)
  let conversation = input.conversationId
    ? await db.aiConversation.findUnique({ where: { id: input.conversationId } })
    : null;

  if (input.conversationId && !conversation) throw new NotFoundError("AiConversation");
  if (conversation) {
    // D3: user isolation + site isolation
    if (conversation.userId !== ctx.user.id) throw new ForbiddenError("Conversation belongs to another user");
    assertSiteAccess(ctx, conversation.siteId);
  } else {
    conversation = await db.aiConversation.create({
      data: {
        userId: ctx.user.id,
        siteId: input.siteId,
        title: input.question.slice(0, 60),
        capability: input.capability ?? "general",
        isDemo: false,
      },
    });
  }

  // Persist the user message (D3: append-only)
  await db.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "USER",
      content: input.question,
    },
  });

  // Resolve authorized context (D5: simple context-stuffing; site isolation enforced HERE)
  const { contextText, sources } = await resolveContext(
    ctx,
    input.question,
    input.capability,
    conversation.siteId,
    input.context,
  );

  // Build the prompt (D10: PRD §9-derived system prompt)
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: `Authorized context (site-scoped):\n${contextText}\n\nUser question: ${input.question}` },
  ];

  // Call the provider (D1: through the abstraction; D6: Local-First fallback)
  const provider = getProvider();
  let providerResponse;
  try {
    providerResponse = await provider.chat(messages, { thinking: false });
  } catch (e) {
    // D6: provider unavailable — explicit, non-blocking
    // D8: audit provider-unavailable
    await audit({
      actorUserId: ctx.user.id,
      action: "ai.provider-unavailable",
      entityType: "AiConversation",
      entityId: conversation.id,
      outcome: "FAILURE",
      reason: e instanceof Error ? e.message : "Provider error",
    });

    // Persist the unavailable assistant message (D6)
    const unavailableMsg = await db.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: "AI provider unavailable. Core workflows continue to function normally.",
        available: false,
        provider: provider.name,
      },
    });

    return {
      conversationId: conversation.id,
      messageId: unavailableMsg.id,
      available: false,
      error: "AI provider unavailable (Local-First mode). Core workflows continue to function normally.",
      promptVersion: SYSTEM_PROMPT_VERSION,
    };
  }

  // Parse the 5-part structured response (D10/D14)
  const structured = parseStructuredResponse(providerResponse.content);
  if (!validateStructuredResponse(structured)) {
    // Malformed output — handle safely (D14)
    structured.limitations += " [Note: AI response did not fully conform to the 5-part structure.]";
  }

  // Persist the assistant message (D3: append-only; D13: token tracking)
  const assistantMsg = await db.aiMessage.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: providerResponse.content,
      structuredResponse: JSON.stringify(structured),
      sources: JSON.stringify(sources),
      tokensUsed: providerResponse.tokensUsed ?? null,
      provider: providerResponse.provider,
      available: true,
    },
  });

  // D8: audit the query
  await audit({
    actorUserId: ctx.user.id,
    action: "ai.chat",
    entityType: "AiConversation",
    entityId: conversation.id,
    newState: {
      questionSummary: input.question.slice(0, 100),
      capability: input.capability ?? "general",
      tokensUsed: providerResponse.tokensUsed ?? 0,
      provider: providerResponse.provider,
      siteId: conversation.siteId,
      promptVersion: SYSTEM_PROMPT_VERSION,
    },
  });

  return {
    conversationId: conversation.id,
    messageId: assistantMsg.id,
    response: structured,
    sources,
    tokensUsed: providerResponse.tokensUsed ?? null,
    available: true,
    provider: providerResponse.provider,
    promptVersion: SYSTEM_PROMPT_VERSION,
  };
}

// ============================================================================
// Conversation history (D3: user-scoped, site-scoped, append-only messages)
// ============================================================================

export async function listConversations(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "ai.chat")) throw new ForbiddenError();
  const where: { userId?: string; siteId?: { in: string[] } } = {};
  // Users see only their own conversations (D3: user isolation)
  // Exception: ai.history.read allows viewing others' conversations (auditor/QM)
  if (!can(ctx, "ai.history.read")) {
    where.userId = ctx.user.id;
  }
  // Site isolation
  if (ctx.resolvedSites !== "*") {
    where.siteId = { in: [...ctx.resolvedSites] };
  }
  const [items, total] = await Promise.all([
    db.aiConversation.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { _count: { select: { messages: true } } } }),
    db.aiConversation.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getConversation(ctx: AuthContext, id: string) {
  if (!can(ctx, "ai.chat")) throw new ForbiddenError();
  const conv = await db.aiConversation.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!conv) throw new NotFoundError("AiConversation");
  // D3: user isolation (unless ai.history.read)
  if (conv.userId !== ctx.user.id && !can(ctx, "ai.history.read")) throw new ForbiddenError("Conversation belongs to another user");
  // D3: site isolation
  assertSiteAccess(ctx, conv.siteId);
  return conv;
}

export async function archiveConversation(ctx: AuthContext, id: string) {
  if (!can(ctx, "ai.history.delete")) throw new ForbiddenError();
  const conv = await db.aiConversation.findUnique({ where: { id } });
  if (!conv) throw new NotFoundError("AiConversation");
  if (conv.userId !== ctx.user.id && !can(ctx, "ai.history.read")) throw new ForbiddenError();
  assertSiteAccess(ctx, conv.siteId);
  // Archive (not delete — AuditEvent records are preserved per D9 condition)
  const updated = await db.aiConversation.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ actorUserId: ctx.user.id, action: "ai.history.archive", entityType: "AiConversation", entityId: id, newState: { status: "ARCHIVED" } });
  return updated;
}

// ============================================================================
// Usage summary (D13: token tracking; for quality_manager / executive_viewer)
// ============================================================================

export async function getUsageSummary(ctx: AuthContext, fromDate: Date, toDate: Date) {
  if (!can(ctx, "ai.history.read")) throw new ForbiddenError();
  const siteFilter = ctx.resolvedSites === "*" ? {} : { siteId: { in: [...ctx.resolvedSites] } };
  const conversations = await db.aiConversation.findMany({
    where: { ...siteFilter, createdAt: { gte: fromDate, lte: toDate } },
    include: { messages: { where: { role: "ASSISTANT", available: true }, select: { tokensUsed: true, createdAt: true } } },
  });
  const byDay: Record<string, number> = {};
  const byCapability: Record<string, number> = {};
  let totalTokens = 0;
  let totalQueries = 0;
  for (const c of conversations) {
    const cap = c.capability ?? "general";
    byCapability[cap] = (byCapability[cap] ?? 0) + c.messages.length;
    totalQueries += c.messages.length;
    for (const m of c.messages) {
      const day = m.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] ?? 0) + (m.tokensUsed ?? 0);
      totalTokens += m.tokensUsed ?? 0;
    }
  }
  return { totalQueries, totalTokens, byDay, byCapability };
}

// ============================================================================
// Provider health (D6)
// ============================================================================

export async function checkHealth() {
  const provider = getProvider();
  return provider.health();
}
