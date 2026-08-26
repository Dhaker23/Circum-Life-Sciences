// Phase 12 AI domain: types + zod schemas + capability definitions.
// D3: AiConversation + AiMessage entities. D9: AI has ZERO mutation permissions.
// D10: 5-part structured response (Answer/Evidence/Interpretation/Recommendation/Limitations).
// D11: capabilities (optional; shape context, not permissions). D13: token tracking.

import { z } from "zod";

// Capabilities (D11) — shape the context builder; advisory, not permission-affecting
export const CAPABILITIES = [
  "general",
  "batch-investigation",
  "root-cause",
  "recurrence",
  "trend-explanation",
  "kpi-analysis",
  "report-draft",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

// The 5-part structured response contract (PRD §9, D10)
export interface StructuredResponse {
  answer: string;
  evidence: string;
  interpretation: string;
  recommendation: string;
  limitations: string;
}

// A source record consulted by the AI (transparency)
export interface AiSource {
  service: string; // e.g., "analytics.getOeeDashboard", "traceability.genealogyTree"
  entityCode?: string;
  entityType?: string;
}

// Zod schemas
export const ChatRequestSchema = z.object({
  question: z.string().min(1).max(2000),
  siteId: z.string().cuid(),
  conversationId: z.string().cuid().optional(),
  capability: z.enum(CAPABILITIES).optional(),
  context: z.object({
    entityType: z.string().max(50).optional(),
    entityId: z.string().cuid().optional(),
  }).optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Rate limit config (D7: 20 requests / 5 minutes / user)
export const RATE_LIMIT_MAX_REQUESTS = 20;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Token/context limits (D5: simple context-stuffing with limits)
export const MAX_CONTEXT_TOKENS = 8000; // approximate; provider-specific
export const MAX_DOCUMENT_CHARS = 8000; // for RAG context-stuffing

// Parse a provider response into the 5-part structured response.
// The provider is asked to format with labeled sections; this parser extracts them.
// If parsing fails, the raw content goes into "answer" and limitations notes the parsing issue.
export function parseStructuredResponse(raw: string): StructuredResponse {
  const sections: StructuredResponse = {
    answer: "",
    evidence: "",
    interpretation: "",
    recommendation: "",
    limitations: "",
  };

  // Try to extract labeled sections (case-insensitive, flexible separators)
  const patterns: Array<{ key: keyof StructuredResponse; regex: RegExp }> = [
    { key: "answer", regex: /(?:^|\n)\s*(?:\*\*)?ANSWER(?:\*\*)?\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:EVIDENCE|INTERPRETATION|RECOMMENDATION|LIMITATIONS)(?:\*\*)?\s*[:\-]|$)/i },
    { key: "evidence", regex: /(?:^|\n)\s*(?:\*\*)?EVIDENCE(?:\*\*)?\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:INTERPRETATION|RECOMMENDATION|LIMITATIONS|ANSWER)(?:\*\*)?\s*[:\-]|$)/i },
    { key: "interpretation", regex: /(?:^|\n)\s*(?:\*\*)?INTERPRETATION(?:\*\*)?\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:RECOMMENDATION|LIMITATIONS|ANSWER|EVIDENCE)(?:\*\*)?\s*[:\-]|$)/i },
    { key: "recommendation", regex: /(?:^|\n)\s*(?:\*\*)?RECOMMENDATION(?:\*\*)?\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:LIMITATIONS|ANSWER|EVIDENCE|INTERPRETATION)(?:\*\*)?\s*[:\-]|$)/i },
    { key: "limitations", regex: /(?:^|\n)\s*(?:\*\*)?LIMITATIONS(?:\*\*)?\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:\*\*)?(?:ANSWER|EVIDENCE|INTERPRETATION|RECOMMENDATION)(?:\*\*)?\s*[:\-]|$)/i },
  ];

  let parsedAny = false;
  for (const { key, regex } of patterns) {
    const match = raw.match(regex);
    if (match && match[1]) {
      sections[key] = match[1].trim();
      parsedAny = true;
    }
  }

  // Fallback: if no sections parsed, put the raw content in answer + note in limitations
  if (!parsedAny) {
    sections.answer = raw.trim();
    sections.limitations = "The AI response did not contain the expected 5-part structure. Raw content is shown in ANSWER. Treat with caution.";
  }

  // Ensure all sections have content (PRD §9: do not silently omit)
  if (!sections.evidence) sections.evidence = "No specific evidence cited.";
  if (!sections.interpretation) sections.interpretation = "No interpretation provided.";
  if (!sections.recommendation) sections.recommendation = "No recommendation provided.";
  if (!sections.limitations) sections.limitations = "No limitations noted.";

  return sections;
}

// Validate the structured response (D14: structured-response validation)
export function validateStructuredResponse(sr: StructuredResponse): boolean {
  return sr.answer.length > 0 && sr.evidence.length > 0 && sr.interpretation.length > 0 &&
    sr.recommendation.length > 0 && sr.limitations.length > 0;
}
