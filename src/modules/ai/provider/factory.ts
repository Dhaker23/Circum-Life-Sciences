// Provider factory (D1). Returns the configured AI provider.
// Default: ZaiProvider. Future providers can be added via env AI_PROVIDER.
import type { AiProvider } from "./index";
import { ZaiProvider } from "./zai";

let _provider: AiProvider | null = null;

export function getProvider(): AiProvider {
  if (!_provider) {
    const providerName = process.env.AI_PROVIDER ?? "zai";
    switch (providerName) {
      case "zai":
      default:
        _provider = new ZaiProvider();
        break;
      // Future: case "openai": _provider = new OpenAiProvider(); break;
    }
  }
  return _provider;
}

// Test-only: inject a mock provider
export function setProviderForTest(p: AiProvider): void {
  _provider = p;
}

export type { AiProvider, ChatMessage, ChatOptions, ChatResponse } from "./index";
