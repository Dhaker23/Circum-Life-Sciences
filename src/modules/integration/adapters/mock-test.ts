// MockTestAdapter — TEST/MOCK ONLY (D1 condition).
// CRITICAL: This is explicitly a TEST/MOCK adapter for validating the integration framework.
// It must NEVER appear as an actual production integration.
// It does NOT connect to any real external system.
// It simulates a pull-only sync with deterministic results for testing.

import type {
  IntegrationAdapter,
  IntegrationSyncResult,
  IntegrationHealthResult,
  ResolvedIntegrationConfig,
} from "../domain";

export class MockTestAdapter implements IntegrationAdapter {
  readonly type = "MOCK_TEST";
  readonly displayName = "Mock Test Adapter (TEST/MOCK ONLY — not a production integration)";

  async sync(config: ResolvedIntegrationConfig): Promise<IntegrationSyncResult> {
    // Simulate a pull-only sync. D5: no push/write to any external system.
    // The mock "syncs" a deterministic number of records based on the config name length.
    // This is purely for framework validation — no real data is exchanged.
    const recordsSynced = config.name.length % 10; // deterministic pseudo-count
    return {
      success: true,
      recordsSynced,
      recordsFailed: 0,
    };
  }

  async health(_config: ResolvedIntegrationConfig): Promise<IntegrationHealthResult> {
    // The mock is always "available" (it's not a real external system).
    return { available: true, latencyMs: 1 };
  }
}

// Self-register the mock adapter (only if not already registered)
import { registerAdapter } from "../domain";
let _registered = false;
if (!_registered) {
  registerAdapter(new MockTestAdapter());
  _registered = true;
}
