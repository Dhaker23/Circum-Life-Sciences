// AuditEvent repository + audit() helper (ADR-0005). Append-only: create + read ONLY.
// No update/delete methods exist on this repository (code-level invariant).
// DB triggers (SQLite) reject UPDATE/DELETE at the storage layer (defense in depth).

import { db } from "./db";
import type { AuditOutcome } from "./permissions";

export interface AuditInput {
  actorUserId?: string | null;
  action: string; // e.g. "identity.user.create"
  entityType: string; // e.g. "User"
  entityId?: string | null;
  previousState?: unknown;
  newState?: unknown;
  reason?: string | null;
  outcome?: AuditOutcome;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Write an audit event. Never throws to break the calling flow; logs on failure.
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        previousState: (input.previousState ?? null) as never,
        newState: (input.newState ?? null) as never,
        reason: input.reason ?? null,
        outcome: input.outcome ?? "SUCCESS",
        sessionId: input.sessionId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (e) {
    // Audit failure must not silently pass; log loudly but do not crash the request.
    console.error("[audit] FAILED to write audit event:", input.action, e);
  }
}

// Read-side: filter parameters for audit queries.
export interface AuditQuery {
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  outcome?: AuditOutcome;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export async function queryAuditEvents(q: AuditQuery) {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 50));
  const where = {
    ...(q.actorUserId ? { actorUserId: q.actorUserId } : {}),
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.action ? { action: q.action } : {}),
    ...(q.outcome ? { outcome: q.outcome } : {}),
    ...(q.from || q.to
      ? {
          occurredAt: {
            ...(q.from ? { gte: q.from } : {}),
            ...(q.to ? { lte: q.to } : {}),
          },
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.auditEvent.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditEvent.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

// CSV export of audit events (tamper-evident: sequential row number + sha256 of row fields).
import { createHash } from "node:crypto";
export async function exportAuditEventsCsv(q: AuditQuery): Promise<string> {
  const { items } = await queryAuditEvents({ ...q, page: 1, pageSize: 200 });
  const header = [
    "row",
    "id",
    "occurredAt",
    "actorUserId",
    "action",
    "entityType",
    "entityId",
    "outcome",
    "reason",
    "ipAddress",
    "rowHash",
  ];
  const lines = [header.join(",")];
  items.forEach((e, i) => {
    const row = [
      String(i + 1),
      e.id,
      e.occurredAt.toISOString(),
      e.actorUserId ?? "",
      e.action,
      e.entityType,
      e.entityId ?? "",
      e.outcome,
      (e.reason ?? "").replace(/"/g, '""'),
      e.ipAddress ?? "",
    ];
    const rowHash = createHash("sha256")
      .update(row.join("|"))
      .digest("hex")
      .slice(0, 16);
    lines.push([...row, rowHash].map((c) => `"${c}"`).join(","));
  });
  return lines.join("\n");
}

// NOTE: There is intentionally NO updateAuditEvent or deleteAuditEvent function here.
// The AuditEventRepository interface exposes only create + read. DB triggers enforce this at storage.
