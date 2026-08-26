// Phase 13 Integration adapter framework (D1).
// CRITICAL: This is the SEAM. Concrete adapters (ERP, MES, LIMS, etc.) implement this interface.
// The framework is vendor-neutral (D1: no hard-coded SAP/Siemens/Rockwell/Oracle behavior).
// D5: PULL-ONLY — adapters read from external systems; they must NOT push/write.
// D6: credentials are decrypted only for the execution scope, never logged.
// D7: AI has ZERO integration permissions.

export interface IntegrationAdapter {
  /** The adapter type identifier (e.g., "ERP", "MES", "MOCK_TEST"). */
  readonly type: string;

  /** Human-readable name of the adapter. */
  readonly displayName: string;

  /**
   * Pull data from the external system (D5: pull-only).
   * MUST NOT perform any write/push operation to the external system.
   * @param config - the integration config (with decrypted credentials)
   * @returns the sync result
   */
  sync(config: ResolvedIntegrationConfig): Promise<IntegrationSyncResult>;

  /** Check the health/connectivity of the external system (no credentials in response). */
  health(config: ResolvedIntegrationConfig): Promise<IntegrationHealthResult>;
}

export interface ResolvedIntegrationConfig {
  id: string;
  adapterType: string;
  name: string;
  siteId: string | null;
  endpointUrl: string;
  credentials: Record<string, unknown>; // decrypted JSON (exists only for this execution scope)
}

export interface IntegrationSyncResult {
  success: boolean;
  recordsSynced: number;
  recordsFailed: number;
  errors?: string[]; // NO credentials/secrets in error messages (D6 redaction)
}

export interface IntegrationHealthResult {
  available: boolean;
  latencyMs?: number;
  error?: string; // NO credentials/secrets
}

// The adapter registry. Concrete adapters register here.
// Phase 13 includes only the MockTestAdapter (explicitly TEST/MOCK ONLY — D1).
// Future concrete adapters (ERP, MES, LIMS, etc.) require REAL TARGET SYSTEM + OWNER DECISION + ADR.
const adapterRegistry = new Map<string, IntegrationAdapter>();

export function registerAdapter(adapter: IntegrationAdapter): void {
  adapterRegistry.set(adapter.type, adapter);
}

export function getAdapter(type: string): IntegrationAdapter | undefined {
  return adapterRegistry.get(type);
}

export function listRegisteredAdapters(): Array<{ type: string; displayName: string }> {
  return Array.from(adapterRegistry.values()).map((a) => ({ type: a.type, displayName: a.displayName }));
}
