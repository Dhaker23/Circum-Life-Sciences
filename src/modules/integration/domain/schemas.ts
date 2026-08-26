// Phase 13 Integration zod schemas + types.

import { z } from "zod";

export const ADAPTER_TYPES = [
  "ERP", "MES", "LIMS", "PLM", "HR", "MAINTENANCE",
  "BARCODE_RFID", "PLC_SCADA", "IOT", "OTHER", "MOCK_TEST",
] as const;

export const CreateIntegrationConfigSchema = z.object({
  adapterType: z.enum(ADAPTER_TYPES),
  name: z.string().min(2).max(100),
  siteId: z.string().cuid().nullable().optional(),
  endpointUrl: z.string().url().max(500),
  credentials: z.record(z.string(), z.unknown()), // plaintext JSON; encrypted before storage (D6)
  syncSchedule: z.string().max(100).optional(), // cron expression (future; not automated)
});
export type CreateIntegrationConfigInput = z.infer<typeof CreateIntegrationConfigSchema>;

export const UpdateIntegrationConfigSchema = z.object({
  endpointUrl: z.string().url().max(500).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  syncSchedule: z.string().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateIntegrationConfigInput = z.infer<typeof UpdateIntegrationConfigSchema>;

export const TriggerSyncSchema = z.object({});
