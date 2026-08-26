# Task s4-ui — Phase 12 AI Assistant UI

**Agent:** s4-ui (Z.ai Code)
**Task:** Build the `/ai-assistant` chat page and floating `AskAiButton` component. The AI API, i18n strings, and sidebar entry were already built. UI must be ADVISORY-ONLY with a 5-part structured response, sources transparency, unavailable banner, and no client-side AI logic.

## What was built

### `src/app/[locale]/(app)/ai-assistant/page.tsx`
Full chat interface with:
- **Two-column layout** on `lg:` (conversation sidebar ~30% / chat panel ~70%); mobile collapses sidebar into a shadcn `Sheet`.
- **Conversation sidebar** (shared component): "New conversation" button, list of past conversations (GET `/api/ai/conversations?page=1&pageSize=50`, auto-refetch every 30s), each item with title/capability badge/message count/created date. Click loads conversation (GET `/api/ai/conversations/[id]`). Archive button (POST `/api/ai/conversations/[id]/archive`) only when `permissions.has("ai.history.delete")`. Empty state: `t("noConversations")`.
- **Chat panel**: site selector (GET `/api/org/sites?pageSize=100`), capability selector (7 capabilities), persistent amber advisory banner, message list, input area.
- **Message rendering**:
  - User: right-aligned, `bg-primary text-primary-foreground` bubble.
  - Assistant available: left-aligned Card with 5-part structured response:
    - **Answer** (default text, prominent)
    - **Evidence** (muted card, Database icon header)
    - **Interpretation** (blue-tinted card `bg-blue-50 dark:bg-blue-950/30`, Info icon — informational blue is acceptable per task spec, not brand color)
    - **Recommendation** (amber card `bg-amber-50 dark:bg-amber-950/30`, Lightbulb icon)
    - **Limitations** (red-tinted card `bg-red-50 dark:bg-red-950/30`, ShieldAlert icon)
    - **Sources consulted** (small Badge list of `service` names)
    - **tokens used** (tiny footer)
  - Assistant unavailable: gray Alert with AlertTriangle icon + `t("unavailable")`.
- **Advisory banner** (persistent amber Alert at top of chat panel): `t("advisoryNotice")` = "AI-generated advisory information. Not an approval or official decision. Human review required."
- **Input area**: Textarea + Send button, Enter ↵ to send, Shift+Enter for newline.
- **Loading state**: "AI is thinking..." Card with spinner.
- **Error state**: red Alert; special-cases HTTP 429 (rate-limited), 403 (unavailable), other !ok (unavailable).
- **State**: useState for siteId/capability/conversationId/input/messages/sending/errorMsg/mobileSidebarOpen. useQuery for me/sites/conversations/conversation-detail. useQueryClient to invalidate conversations list after first chat (creates new conversation) or archive.
- **Accessibility**: `aria-live="polite"` on messages container; keyboard-navigable conversation items (Enter/Space); `aria-label` on inputs/buttons/selects; sr-only DialogHeader/SheetTitle for sheet.

### `src/components/ai/ask-ai-button.tsx`
Floating `AskAiButton` component (for embedding on analytics/quality/traceability pages):
- Fixed bottom-end rounded-full Button with Sparkles icon + label.
- Opens shadcn `Dialog` (`sm:max-w-2xl`) with compact chat interface:
  - Amber advisory banner.
  - Inline SitePicker (native `<select>`).
  - Messages list (max-h-[40vh], aria-live polite) — user bubbles right (primary), assistant Cards left with `CompactStructuredResponse` (same 5-part structure but `text-xs` sizing).
  - Input area (Textarea + Send, Enter to send / Shift+Enter newline).
  - Loading/error/rate-limit/unavailable handling same as the full page.
- Uses `useTransition` for async send.
- Props: `initialQuestion?`, `context?` (entityType/entityId), `capability?` (default "general"), `label?`, `className?`.
- Exports: `AskAiButton`, `CompactStructuredResponse`, and types `StructuredResponse`, `AiSource`, `DialogMessage`.

## Architecture rules respected

1. **Advisory-only** — persistent amber banner in both the page and the floating dialog.
2. **5-part structured response** — every available assistant message displays Answer/Evidence/Interpretation/Recommendation/Limitations with distinct visual treatment.
3. **Unavailable state** — gray Alert with warning icon, "AI provider unavailable. Core workflows continue to function normally."
4. **Sources transparency** — `sources[]` rendered as small badges listing each Phase 1-11 service consulted.
5. **`"use client"`** directive on both files.
6. **Desktop-first responsive** — `lg:grid-cols-[30%_1fr]` two-column; mobile sidebar collapses to Sheet.
7. **No client-side AI logic** — only POST `/api/ai/chat` and render the response.
8. **i18n** — all strings via `useTranslations("ai")` (en/fr/ar already present).
9. **Colors** — no indigo/blue. The Interpretation section uses `bg-blue-50` which is explicitly allowed per task spec for informational sections (not a brand color).
10. **Accessibility** — ARIA live regions, keyboard nav, screen-reader labels.

## Typecheck / Lint

- `bunx tsc --noEmit` — **0 errors in my new files**. 4 pre-existing errors remain in `src/modules/ai/service/index.ts` (lines 112-114) — these are pre-existing backend bugs from the Phase 12 backend implementation (untracked, not built by me). Left UNTOUCHED per task rule "No client-side AI logic" + "The AI API is ALREADY BUILT".
  - Specifically: `contextHint.entityType` typed as `string` vs the `GenealogyTreeSchema`'s strict enum; `n.type`/`n.label` instead of `TraceabilityNode`'s `entityType`/`name`; `summary.nodeCount`/`summary.edgeCount` instead of `summary.totalNodes`/`graph.edges.length`.
- `bun run lint` — **0 errors / 199 warnings** (down from 2 errors / 202 warnings — the 2 errors I introduced were setState-in-effect issues, fixed by deriving `effectiveSiteId` instead of using a setState effect, and by using a `handleOpen` click callback instead of a reset-on-open effect). The 3 fewer warnings were unused imports I removed (`Trash2`, `CardHeader`, `CardTitle`, `X`, `ScrollArea`).

## Notes for future agents

- The page uses inline TypeScript interfaces mirroring the API contract (not imported from the AI module) to avoid coupling UI to backend internals and to keep the "no client-side AI logic" rule clean.
- The `parseStructured` and `parseSources` helpers handle JSON-string fields (`structuredResponse`, `sources`) from the conversation detail API gracefully — returning `null`/`[]` on malformed JSON.
- The conversation list auto-refetches every 30s to surface newly created conversations (after the first chat message in a new conversation, `qc.invalidateQueries(["ai","conversations"])` triggers an immediate refetch).
- `effectiveSiteId` is derived (not state) so the Select always shows the first authorized site even before the user picks one — without triggering setState-in-effect lint errors.
- The floating `AskAiButton` is NOT yet wired into any analytics/quality/traceability page (per task spec — just the component file for Phase 12). Future agents can import it: `import { AskAiButton } from "@/components/ai/ask-ai-button"` and place `<AskAiButton initialQuestion="..." capability="kpi-analysis" />` near the bottom of any page.
- The 4 pre-existing TS errors in `src/modules/ai/service/index.ts` (lines 112-114) are a traceability-graph API contract drift — the backend AI service calls `genealogyTree()` with extra params (`direction`, `maxDepth`) that aren't in `GenealogyTreeSchema`, and accesses `summary.nodeCount`/`summary.edgeCount` which don't exist (should be `summary.totalNodes`/`graph.edges.length`). Easy fix for the next backend-touching agent.
