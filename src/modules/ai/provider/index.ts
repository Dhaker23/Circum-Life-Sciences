// Phase 12 AI Provider abstraction (D1).
// CRITICAL: The orchestration layer communicates with the provider through this interface.
// Business logic must NOT depend directly on z-ai-web-dev-sdk calls.
// Future provider replacement must not require rewriting the AI domain/orchestration layer.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  thinking?: boolean; // enable chain-of-thought (provider-specific)
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  tokensUsed?: number; // prompt + completion tokens
  provider: string;
  raw?: unknown; // raw provider response (for debugging; never exposed to client)
}

// The provider interface. Implementations: ZaiProvider (default), future providers.
export interface AiProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  health(): Promise<{ available: boolean; latencyMs?: number; error?: string }>;
}
