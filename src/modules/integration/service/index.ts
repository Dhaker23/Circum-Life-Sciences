// Phase 13 Integration service.
// D1: framework only (concrete adapters via registry). D5: PULL-ONLY (no push).
// D6: AES-256-GCM credential encryption; decrypted only for execution scope.
// D7: 3 perms (human-only; AI has ZERO integration permissions).
// D8: credentials masked in API responses. Local-First: sync failure is non-blocking.

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { assertSiteAccess } from "@/lib/site-scope";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { AuthContext } from "@/lib/rbac";
import { encrypt, decrypt, isEncryptionConfigured } from "@/lib/crypto";
import { getAdapter, listRegisteredAdapters } from "../domain";
import type { ResolvedIntegrationConfig } from "../domain";
import type z from "zod";
import "./../adapters/mock-test"; // side-effect: register MockTestAdapter

// ============================================================================
// Config CRUD (D6: credentials encrypted; D7: human-only; D8: masked in response)
// ============================================================================

// Mask credentials in API responses (D8: never expose to client)
function maskConfig(config: {
  id: string; adapterType: string; name: string; siteId: string | null;
  endpointUrl: string; credentials: string; credentialsIv: string;
  syncSchedule: string | null; status: string; lastSyncAt: Date | null;
  lastSyncStatus: string | null; isDemo: boolean; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: config.id,
    adapterType: config.adapterType,
    name: config.name,
    siteId: config.siteId,
    endpointUrl: config.endpointUrl,
    credentials: "***REDACTED***", // D8: never expose
    hasCredentials: !!config.credentials,
    syncSchedule: config.syncSchedule,
    status: config.status,
    lastSyncAt: config.lastSyncAt,
    lastSyncStatus: config.lastSyncStatus,
    isDemo: config.isDemo,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

export async function listConfigs(ctx: AuthContext, page: number, pageSize: number) {
  if (!can(ctx, "integration.read")) throw new ForbiddenError();
  const where: { siteId?: { in: string[] } } = {};
  if (ctx.resolvedSites !== "*") where.siteId = { in: [...ctx.resolvedSites] };
  // Also include global configs (siteId = null) for all users with integration.read
  const whereFinal = ctx.resolvedSites === "*"
    ? {}
    : { OR: [{ siteId: { in: [...ctx.resolvedSites] } }, { siteId: null }] };
  const [items, total] = await Promise.all([
    db.integrationConfig.findMany({ where: whereFinal, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.integrationConfig.count({ where: whereFinal }),
  ]);
  return { items: items.map(maskConfig), total, page, pageSize };
}

export async function getConfig(ctx: AuthContext, id: string) {
  if (!can(ctx, "integration.read")) throw new ForbiddenError();
  const config = await db.integrationConfig.findUnique({ where: { id } });
  if (!config) throw new NotFoundError("IntegrationConfig");
  if (config.siteId) assertSiteAccess(ctx, config.siteId);
  return maskConfig(config);
}

export async function createConfig(
  ctx: AuthContext,
  input: z.infer<typeof import("../domain/schemas").CreateIntegrationConfigSchema>,
) {
  if (!can(ctx, "integration.config.manage")) throw new ForbiddenError();
  if (input.siteId) assertSiteAccess(ctx, input.siteId);
  // D6: encryption must be configured
  if (!isEncryptionConfigured()) {
    throw new ValidationError("INTEGRATION_ENCRYPTION_KEY is not configured. Cannot store integration credentials.");
  }
  // Verify adapter type is registered (or is a known type for future adapters)
  getAdapter(input.adapterType);
  // Allow creating configs for adapter types even if no concrete adapter is registered yet
  // (the config is stored; sync will fail with "adapter not registered" until a concrete adapter is added)

  // Check uniqueness
  const existing = await db.integrationConfig.findUnique({ where: { adapterType_name: { adapterType: input.adapterType, name: input.name } } });
  if (existing) throw new ValidationError("IntegrationConfig with this adapterType+name already exists");

  // D6: encrypt credentials
  const credentialsJson = JSON.stringify(input.credentials);
  const encrypted = encrypt(credentialsJson);

  const config = await db.integrationConfig.create({
    data: {
      adapterType: input.adapterType,
      name: input.name,
      siteId: input.siteId ?? null,
      endpointUrl: input.endpointUrl,
      credentials: encrypted.ciphertext,
      credentialsIv: encrypted.iv,
      syncSchedule: input.syncSchedule,
      status: "ACTIVE",
      isDemo: input.adapterType === "MOCK_TEST",
    },
  });

  await audit({
    actorUserId: ctx.user.id,
    action: "integration.config.create",
    entityType: "IntegrationConfig",
    entityId: config.id,
    newState: { adapterType: input.adapterType, name: input.name, siteId: input.siteId, endpointUrl: input.endpointUrl },
    // NOTE: credentials are NOT included in the audit record (D6)
  });

  return maskConfig(config);
}

export async function updateConfig(
  ctx: AuthContext,
  id: string,
  input: z.infer<typeof import("../domain/schemas").UpdateIntegrationConfigSchema>,
) {
  if (!can(ctx, "integration.config.manage")) throw new ForbiddenError();
  const config = await db.integrationConfig.findUnique({ where: { id } });
  if (!config) throw new NotFoundError("IntegrationConfig");
  if (config.siteId) assertSiteAccess(ctx, config.siteId);

  const data: {
    endpointUrl?: string;
    credentials?: string;
    credentialsIv?: string;
    syncSchedule?: string;
    status?: string;
  } = {};
  if (input.endpointUrl) data.endpointUrl = input.endpointUrl;
  if (input.syncSchedule !== undefined) data.syncSchedule = input.syncSchedule;
  if (input.status) data.status = input.status;
  if (input.credentials) {
    if (!isEncryptionConfigured()) throw new ValidationError("INTEGRATION_ENCRYPTION_KEY not configured");
    const encrypted = encrypt(JSON.stringify(input.credentials));
    data.credentials = encrypted.ciphertext;
    data.credentialsIv = encrypted.iv;
  }

  const updated = await db.integrationConfig.update({ where: { id }, data });
  await audit({
    actorUserId: ctx.user.id,
    action: "integration.config.update",
    entityType: "IntegrationConfig",
    entityId: id,
    newState: { ...data, credentials: data.credentials ? "***REDACTED***" : undefined },
  });
  return maskConfig(updated);
}

export async function deactivateConfig(ctx: AuthContext, id: string) {
  if (!can(ctx, "integration.config.manage")) throw new ForbiddenError();
  const config = await db.integrationConfig.findUnique({ where: { id } });
  if (!config) throw new NotFoundError("IntegrationConfig");
  if (config.siteId) assertSiteAccess(ctx, config.siteId);
  // D7: deactivate (not hard delete — audit trail preserved)
  const updated = await db.integrationConfig.update({ where: { id }, data: { status: "INACTIVE" } });
  await audit({
    actorUserId: ctx.user.id,
    action: "integration.config.deactivate",
    entityType: "IntegrationConfig",
    entityId: id,
    newState: { status: "INACTIVE" },
  });
  return maskConfig(updated);
}

// ============================================================================
// Event log (append-only; D6: no credentials in errorDetail)
// ============================================================================

export async function listEvents(ctx: AuthContext, configId: string, page: number, pageSize: number) {
  if (!can(ctx, "integration.read")) throw new ForbiddenError();
  const config = await db.integrationConfig.findUnique({ where: { id: configId } });
  if (!config) throw new NotFoundError("IntegrationConfig");
  if (config.siteId) assertSiteAccess(ctx, config.siteId);
  const [items, total] = await Promise.all([
    db.integrationEvent.findMany({ where: { configId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.integrationEvent.count({ where: { configId } }),
  ]);
  return { items, total, page, pageSize };
}

// ============================================================================
// Manual sync (D5: PULL-ONLY; D7: integration.sync; Local-First: non-blocking)
// ============================================================================

export async function triggerSync(ctx: AuthContext, configId: string) {
  if (!can(ctx, "integration.sync")) throw new ForbiddenError();
  const config = await db.integrationConfig.findUnique({ where: { id: configId } });
  if (!config) throw new NotFoundError("IntegrationConfig");
  if (config.siteId) assertSiteAccess(ctx, config.siteId);
  if (config.status !== "ACTIVE") throw new ValidationError("IntegrationConfig is not ACTIVE");

  // Log SYNC_START (append-only)
  await db.integrationEvent.create({
    data: { configId, eventType: "SYNC_START", triggeredByUserId: ctx.user.id },
  });

  const startTime = Date.now();

  // Resolve the adapter
  const adapter = getAdapter(config.adapterType);
  if (!adapter) {
    // No concrete adapter registered for this type
    const durationMs = Date.now() - startTime;
    await db.integrationEvent.create({
      data: {
        configId,
        eventType: "SYNC_FAILURE",
        recordsSynced: 0,
        recordsFailed: 0,
        errorDetail: `No adapter registered for type "${config.adapterType}". Concrete adapters require REAL TARGET SYSTEM + OWNER DECISION + ADR.`,
        durationMs,
        triggeredByUserId: ctx.user.id,
      },
    });
    await db.integrationConfig.update({ where: { id: configId }, data: { lastSyncAt: new Date(), lastSyncStatus: "FAILURE" } });
    await audit({ actorUserId: ctx.user.id, action: "integration.sync", entityType: "IntegrationConfig", entityId: configId, outcome: "FAILURE", newState: { reason: "adapter not registered" } });
    return { success: false, error: "adapter not registered", durationMs };
  }

  // D6: decrypt credentials only for this execution scope
  let resolvedConfig: ResolvedIntegrationConfig;
  try {
    const credentialsJson = decrypt({ ciphertext: config.credentials, iv: config.credentialsIv });
    resolvedConfig = {
      id: config.id,
      adapterType: config.adapterType,
      name: config.name,
      siteId: config.siteId,
      endpointUrl: config.endpointUrl,
      credentials: JSON.parse(credentialsJson),
    };
  } catch (e) {
    const durationMs = Date.now() - startTime;
    const errorMsg = e instanceof Error ? e.message : "decryption failed";
    await db.integrationEvent.create({
      data: { configId, eventType: "SYNC_FAILURE", errorDetail: `Credential decryption failed: ${errorMsg}`, durationMs, triggeredByUserId: ctx.user.id },
    });
    await audit({ actorUserId: ctx.user.id, action: "integration.sync", entityType: "IntegrationConfig", entityId: configId, outcome: "FAILURE", reason: "decryption failed" });
    return { success: false, error: "decryption failed", durationMs };
  }

  // D5: call adapter.sync() (PULL-ONLY — the adapter must NOT push)
  try {
    const result = await adapter.sync(resolvedConfig);
    const durationMs = Date.now() - startTime;
    const eventType = result.success ? "SYNC_SUCCESS" : "SYNC_PARTIAL";
    await db.integrationEvent.create({
      data: {
        configId,
        eventType,
        recordsSynced: result.recordsSynced,
        recordsFailed: result.recordsFailed,
        errorDetail: result.errors?.join("; ") ?? null,
        durationMs,
        triggeredByUserId: ctx.user.id,
      },
    });
    await db.integrationConfig.update({
      where: { id: configId },
      data: { lastSyncAt: new Date(), lastSyncStatus: result.success ? "SUCCESS" : "PARTIAL" },
    });
    await audit({ actorUserId: ctx.user.id, action: "integration.sync", entityType: "IntegrationConfig", entityId: configId, newState: { recordsSynced: result.recordsSynced, recordsFailed: result.recordsFailed, durationMs } });
    return { success: result.success, recordsSynced: result.recordsSynced, recordsFailed: result.recordsFailed, durationMs };
  } catch (e) {
    // D6: redact credentials from error messages
    const durationMs = Date.now() - startTime;
    const errorMsg = e instanceof Error ? e.message : "sync failed";
    // Strip any potential credential leakage from error messages
    const safeError = errorMsg.replace(/password|token|key|secret|credential/gi, "***REDACTED***");
    await db.integrationEvent.create({
      data: { configId, eventType: "SYNC_FAILURE", errorDetail: safeError, durationMs, triggeredByUserId: ctx.user.id },
    });
    await db.integrationConfig.update({ where: { id: configId }, data: { lastSyncAt: new Date(), lastSyncStatus: "FAILURE" } });
    await audit({ actorUserId: ctx.user.id, action: "integration.sync", entityType: "IntegrationConfig", entityId: configId, outcome: "FAILURE", reason: safeError });
    return { success: false, error: safeError, durationMs };
  }
}

// ============================================================================
// Integration health (aggregate)
// ============================================================================

export async function getIntegrationHealth(ctx: AuthContext) {
  if (!can(ctx, "integration.read")) throw new ForbiddenError();
  const where = ctx.resolvedSites === "*"
    ? {}
    : { OR: [{ siteId: { in: [...ctx.resolvedSites] } }, { siteId: null }] };
  const configs = await db.integrationConfig.findMany({ where, select: { id: true, adapterType: true, name: true, status: true, lastSyncStatus: true } });
  return {
    registeredAdapters: listRegisteredAdapters(),
    activeConfigs: configs.filter((c) => c.status === "ACTIVE").length,
    totalConfigs: configs.length,
    configs: configs.map((c) => ({ id: c.id, adapterType: c.adapterType, name: c.name, status: c.status, lastSyncStatus: c.lastSyncStatus })),
  };
}
