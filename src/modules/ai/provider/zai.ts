// ZaiProvider: default AiProvider implementation using z-ai-web-dev-sdk (D1).
// CRITICAL: z-ai-web-dev-sdk MUST be used in backend code only (never client-side).
// This is the ONLY place in the codebase that imports z-ai-web-dev-sdk directly.
// The orchestration layer calls getProvider().chat(...) — never imports the SDK.

import ZAI from "z-ai-web-dev-sdk";
import type { AiProvider, ChatMessage, ChatOptions, ChatResponse } from "./index";

export class ZaiProvider implements AiProvider {
  name = "zai";
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  private async getClient() {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
    return this.zai;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const client = await this.getClient();
    // z-ai-web-dev-sdk expects the first message with role "assistant" as the system prompt
    // (per the SDK documentation). We normalize: if messages[0].role === "system", convert.
    const sdkMessages = messages.map((m) => ({
      role: m.role === "system" ? ("assistant" as const) : m.role,
      content: m.content,
    }));

    const completion = await client.chat.completions.create({
      messages: sdkMessages,
      thinking: { type: options?.thinking ? "enabled" : "disabled" },
    } as Parameters<typeof client.chat.completions.create>[0]);

    const content = completion.choices[0]?.message?.content ?? "";
    // Token usage if available from the provider response
    const tokensUsed = (completion as { usage?: { total_tokens?: number } }).usage?.total_tokens;

    return {
      content,
      tokensUsed,
      provider: this.name,
      // raw is kept for server-side debugging; never serialized to the client
    };
  }

  async health(): Promise<{ available: boolean; latencyMs?: number; error?: string }> {
    try {
      const start = Date.now();
      // Lightweight health check: just verify the client can be created
      await this.getClient();
      return { available: true, latencyMs: Date.now() - start };
    } catch (e) {
      return { available: false, error: e instanceof Error ? e.message : "Unknown error" };
    }
  }
}
