# CIRCUM — PHASE 13 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 13 — Integrations / Deployment / Backup / Recovery / Observability
> **Predecessor:** Phases 1-12 (all approved/closed). 69 models. 366/366 tests pass. ADR-0002 (PostgreSQL migration) remains the top production blocker.
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only).
> **Source of truth:** Circum Master PRD §13 (Integrations), §11 (Architecture), §12 (Local-First), §10 (Security/Data Integrity), §18 (Phase 13 roadmap), §19/§20 (Phase Gate / Validation Report).
> **Critical owner constraints:**
> - "Do not invent entities, terminology, workflows, regulatory requirements, permissions, formulas, or business rules."
> - "Use controlled adapters for ERP, MES, PLC, SCADA, IoT, Barcode/RFID, LIMS, PLM, HR and maintenance systems. Avoid tight coupling to one vendor." (PRD §13)
> - "Core factory workflows must operate on the internal factory LAN without continuous Internet access." (PRD §12)
> - "Database constraints and transactions must prevent duplicates, broken references, impossible quantities/timestamps and unauthorized state transitions." (PRD §10)
> - "Normal users cannot edit/delete controlled audit history." (PRD §10)
> - "NO AUTONOMOUS ADVANCEMENT. NO AUTONOMOUS CRON. NO PHASE 14."

---

## 0. Context: what Phase 13 covers

PRD §18 Phase 13: **"Integrations / deployment / backup / recovery / observability."**

PRD §13 defines the integration scope:

> "Use controlled adapters for ERP, MES, PLC, SCADA, IoT, Barcode/RFID, LIMS, PLM, HR and maintenance systems. Avoid tight coupling to one vendor."

This is **10 integration categories** + **deployment** + **backup/recovery** + **observability**. This is an extremely large scope. The owner's "do not invent" rule means Phase 13 cannot build all 10 integrations speculatively — each requires a real external system, credentials, and a concrete business need.

### 0.1 The fundamental tension

PRD §13 lists 10 integration types. But:
- The project has **zero existing integration code** (confirmed: no ERP/MES/LIMS/PLC adapters).
- The project has **no Docker, no Redis, no observability infrastructure** (confirmed: package.json has none of these).
- The project is **SQLite-only** (ADR-0002: PostgreSQL migration is the top production blocker, not yet done).
- The sandbox environment **cannot reach external systems** (ERP, MES, LIMS, PLC, SCADA are factory-floor systems not present in this dev environment).
- The owner's rule: "Do not invent entities, terminology, workflows, regulatory requirements, permissions, formulas, or business rules."

**Therefore:** Phase 13 cannot implement concrete integrations to ERP/MES/PLC/SCADA/IoT/LIMS/PLM/HR/maintenance systems in this environment. Those require:
1. A real target system (vendor, credentials, API spec).
2. A production deployment environment (not this sandbox).
3. The PostgreSQL migration (ADR-0002) to be complete first.

**Phase 13's realistic scope** is therefore:
1. **Integration adapter framework** — the *seam* (interfaces, base classes) that future concrete adapters will implement. Not the adapters themselves.
2. **Deployment infrastructure** — Docker/Docker Compose configuration (PRD §11 specifies "Docker/Docker Compose").
3. **Backup/recovery** — database backup + restore procedures + scripts.
4. **Observability** — structured logging, health checks, basic monitoring (PRD §10 "monitoring").
5. **PostgreSQL migration readiness** — the cutover script (ADR-0002 §4) stubbed since Phase 1; make it executable.
6. **Production hardening** — security headers verification, rate-limiting review, secrets management review.

**Out of scope for Phase 13** (deferred to Phase 14 or future maintenance tasks):
- Concrete ERP/MES/PLC/SCADA/IoT/LIMS/PLM/HR/maintenance adapters (require real target systems).
- Distributed rate limiting (Redis-based; Phase 14).
- Vector search for RAG (pgvector; Phase 14+).
- Final production validation (Phase 14).

### 0.2 The non-negotiable seam (codebase-design)

```
┌─────────────────────────────────────────────────────────────┐
│  EXTERNAL SYSTEMS (ERP, MES, LIMS, PLC, SCADA, IoT, etc.)   │
│  — NOT present in this environment —                         │
│  — each requires a real vendor + credentials + API spec —    │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  INTEGRATION ADAPTER FRAMEWORK (src/modules/integration)     │
│  - IntegrationAdapter interface (the seam)                    │
│  - IntegrationEvent (append-only log of sync attempts)       │
│  - IntegrationConfig (per-adapter configuration, encrypted)  │
│  - Controlled: every sync is audited; every failure logged   │
│  - Local-First: adapters are pull-only by default; no push   │
│    to external systems without explicit approval              │
└──────────────────────────────────┬──────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│  CONCRETE ADAPTERS (future phases, per real target system)   │
│  - ErpAdapter, MesAdapter, LimsAdapter, etc.                 │
│  - Each implemented only when a real target system exists    │
│  - Each requires an OWNER DECISION + ADR                     │
└─────────────────────────────────────────────────────────────┘
```

This is a **deep module** (codebase-design): the `IntegrationAdapter` interface is small (`sync()`, `health()`, `getConfig()`), but the framework behind it (event logging, config encryption, audit, rate-limiting, retry, Local-First fallback) is deep. Future concrete adapters cross the same seam.

---

## 1. Objectives

1. **Integration adapter framework** — a controlled seam (`IntegrationAdapter` interface + `IntegrationEvent` append-only log + `IntegrationConfig` entity) that future concrete adapters (ERP, MES, LIMS, etc.) will implement. **No concrete adapters in Phase 13** — only the framework.
2. **Docker/Docker Compose deployment** (PRD §11) — containerize the Next.js app + (future) PostgreSQL for production deployment.
3. **Database backup/recovery** — scripts + documented procedures for SQLite (now) and PostgreSQL (future) backup + restore. Tested.
4. **Observability** — structured logging (pino or equivalent), health-check endpoint aggregation, basic application metrics (request count, error rate, DB connection status).
5. **PostgreSQL migration readiness** — make the ADR-0002 cutover script executable; document the cutover runbook.
6. **Production hardening review** — security headers, rate-limiting, secrets management, CORS, CSP — verify and document.
7. **Full RBAC + audit + multi-site + Local-First** — reuse Phase 1-12 infrastructure.

**Out of scope:** Concrete ERP/MES/PLC/SCADA/IoT/LIMS/PLM/HR/maintenance adapters (require real target systems + OWNER DECISION + ADR per adapter). Distributed rate limiting (Phase 14). Vector search (Phase 14+). Final production validation (Phase 14).

---

## 2. Requirements (PRD traceability)

| # | Requirement (PRD) | Phase 13 coverage | Owner decision |
|---|---|---|---|
| R1 | Controlled adapters for ERP/MES/PLC/SCADA/IoT/Barcode/RFID/LIMS/PLM/HR/maintenance (§13) | Integration adapter FRAMEWORK only; no concrete adapters | **D1 — which adapters, if any, in Phase 13?** |
| R2 | Avoid tight coupling to one vendor (§13) | Adapter interface is vendor-agnostic | — |
| R3 | Docker/Docker Compose (§11) | Dockerfile + docker-compose.yml | **D2 — include PostgreSQL in compose or app-only?** |
| R4 | Backup/recovery (§18) | Scripts + procedures + tested restore | **D3 — backup strategy** |
| R5 | Observability/monitoring (§10, §18) | Structured logging + health aggregation + basic metrics | **D4 — logging library + metrics scope** |
| R6 | PostgreSQL migration readiness (ADR-0002) | Cutover script executable + runbook | — |
| R7 | Local-First (§12) | Adapters are pull-only; no push without approval; factory LAN operation | — |
| R8 | Security/data integrity (§10) | Production hardening review | — |
| R9 | Phase Gate (§19) + Phase Validation Report (§20) | Full gate | — |

---

## 3. Domain model (grill-with-docs + domain-modeling)

### 3.1 Integration adapter framework scope (D1 — CRITICAL, OWNER DECISION REQUIRED)

**Question:** Does Phase 13 build the adapter framework only, or also one or more concrete adapters?

**Analysis:**
- PRD §13 lists 10 integration types. Building all 10 speculatively would violate "do not invent" — each requires a real target system.
- Building zero integration infrastructure would ignore PRD §13/§18.
- The middle ground: build the **framework** (interface + event log + config entity + audit) so future concrete adapters have a controlled seam. This is like Phase 6 (traceability framework) or Phase 12 D1 (AI provider abstraction) — the seam is the deliverable, not the concrete implementation.

**Proposed resolution (D1):** **Phase 13 builds the integration adapter FRAMEWORK only. No concrete adapters.** The framework includes:
- `IntegrationAdapter` interface — `sync()`, `health()`, `getConfig()`, `getName()`.
- `IntegrationConfig` entity — per-adapter configuration (encrypted credentials, endpoint URLs, sync schedule). Site-scoped.
- `IntegrationEvent` entity — append-only log of every sync attempt (start, success, failure, records synced, errors). Auditable.
- `IntegrationRegistry` — a registry of available adapters (initially empty; future phases register concrete adapters).
- An admin UI to view integration status + event log (read-only; no configuration changes without OWNER DECISION).

**Concrete adapters (ERP, MES, LIMS, etc.) are explicitly deferred** to future phases, each requiring:
- A real target system (vendor, credentials, API spec).
- An OWNER DECISION confirming the business need.
- An ADR recording the integration architecture.
- A dedicated implementation phase or maintenance task.

**Recommendation: framework only; no concrete adapters.** **Please confirm D1.**

### 3.2 Docker/deployment scope (D2 — OWNER DECISION REQUIRED)

**Question:** Does Phase 13's Docker Compose include PostgreSQL, or app-only?

**Analysis:**
- PRD §11 specifies "Docker/Docker Compose."
- ADR-0002 says PostgreSQL migration is the top production blocker, but the sandbox has no PostgreSQL.
- A Docker Compose that includes PostgreSQL would let the owner run the full stack locally/production — but the cutover script (ADR-0002 §4) must run first to migrate data.
- Options: (a) app-only Dockerfile + Compose with SQLite (dev); (b) app + PostgreSQL Compose (production-ready, but requires cutover first); (c) both (dev SQLite + prod PostgreSQL profiles).

**Proposed resolution (D2):** **Both profiles.** A `docker-compose.yml` with two profiles:
- `dev` profile: Next.js app + SQLite (for local development).
- `prod` profile: Next.js app + PostgreSQL (for production, requires cutover script run first).
- A `Dockerfile` (multi-stage build, standalone output per `next.config.ts`).
- Documentation: `docs/operations/deployment.md` covering both profiles.

**Recommendation: both dev + prod profiles.** **Please confirm D2.**

### 3.3 Backup/recovery strategy (D3 — OWNER DECISION REQUIRED)

**Question:** What backup/recovery strategy does Phase 13 implement?

**Analysis:**
- SQLite (current): backup = file copy (with WAL checkpoint). Simple, but no incremental.
- PostgreSQL (future): `pg_dump` / `pg_basebackup` / PITR (point-in-time recovery).
- PRD §10: "backup/recovery" is mandatory but no specific strategy is prescribed.
- Regulatory context: medical device QMS may require validated backup/restore (PRD §17).

**Proposed resolution (D3):**
- **SQLite backup script** (`scripts/backup-sqlite.ts`): WAL checkpoint + file copy to a timestamped backup directory. Tested restore.
- **PostgreSQL backup script** (`scripts/backup-postgres.ts`): `pg_dump` with custom format. Tested restore (when PG is available).
- **Restore script** (`scripts/restore.ts`): restores from a backup file (SQLite or PostgreSQL), with a confirmation prompt.
- **Backup verification**: a test that backs up + restores + verifies row counts match.
- **Documentation**: `docs/operations/backup-recovery.md` with the runbook.
- **No scheduled/automated backups** in Phase 13 (requires cron/external scheduler; deferred to Phase 14 or operations). Backups are manual (script execution).

**Recommendation: manual scripts + tested restore + documentation; no automation.** **Please confirm D3.**

### 3.4 Observability scope (D4 — OWNER DECISION REQUIRED)

**Question:** What observability does Phase 13 implement?

**Analysis:**
- PRD §10 mentions "monitoring" but doesn't specify tools.
- PRD §11 mentions "Redis only where justified" — observability may justify Redis for log/metric buffering, but that's Phase 14.
- Current state: `console.error` / `console.warn` are used in the codebase (lint flags them). No structured logging library.
- Options: (a) pino (fast, structured, JSON); (b) winston (feature-rich, heavier); (c) no library (console + custom formatter).

**Proposed resolution (D4):** **Structured logging with pino + health-check aggregation + basic metrics.**
- **pino** for structured JSON logging (request logs, error logs, audit-relevant events). Replaces ad-hoc `console.error` calls.
- **Health endpoint** (`GET /api/health`): aggregates DB connection, AI provider health (Phase 12), and (future) integration adapter health. Returns `{ status: "healthy"|"degraded"|"unhealthy", checks: {...} }`.
- **Basic metrics** (in-memory, no Prometheus/Grafana in Phase 13): request count, error count, average response time, per-endpoint. Exposed at `GET /api/metrics` (super_admin only).
- **No Redis, no Prometheus, no Grafana** in Phase 13 (infrastructure deferred to Phase 14 or operations).

**Recommendation: pino + health aggregation + in-memory metrics; no external monitoring infra.** **Please confirm D4.**

### 3.5 Integration push vs pull (D5 — CRITICAL, OWNER DECISION REQUIRED)

**Question:** Can integration adapters push data to external systems, or only pull?

**Analysis:**
- PRD §13: "controlled adapters" — implies bidirectional but controlled.
- PRD §12: Local-First — core workflows must not depend on external systems.
- Push (writing to ERP/MES) is higher-risk: a bug could corrupt an external system. Pull (reading from ERP/MES) is lower-risk.
- The owner's AI governance model (Phase 12) is advisory-only (no mutations). A similar conservative stance for integrations is appropriate.

**Proposed resolution (D5):** **Phase 13 adapters are PULL-ONLY by default.** The `IntegrationAdapter` interface supports `sync()` which is pull (read from external, write to Circum as a cached/imported record). **Push (writing to external systems) is explicitly deferred** — it requires:
- An OWNER DECISION per integration.
- An ADR documenting the push architecture + safety controls.
- A dedicated implementation phase.
- Human approval for every push operation (no autonomous push).

**Rationale:** Pull-only is the conservative, Local-First-aligned default. Push is higher-risk and should be a separate, explicitly-approved capability.

**Recommendation: pull-only in Phase 13; push requires future OWNER DECISION + ADR.** **Please confirm D5.**

### 3.6 Integration config encryption (D6 — OWNER DECISION REQUIRED)

**Question:** How are integration credentials (API keys, tokens) stored?

**Analysis:**
- `IntegrationConfig` will store endpoint URLs + credentials for external systems.
- Storing credentials in plaintext in the DB is a security defect.
- SQLite has no native encryption. PostgreSQL has `pgcrypto`.
- Options: (a) encrypt credentials with a server-side key (AES-256-GCM) before storing; (b) store credentials in env vars only (no DB); (c) defer encryption to Phase 14.

**Proposed resolution (D6):** **Server-side AES-256-GCM encryption for IntegrationConfig credentials.**
- A new `src/lib/crypto.ts` module: `encrypt(plaintext)` / `decrypt(ciphertext)` using `crypto.createCipheriv("aes-256-gcm", key, iv)`.
- The encryption key is stored in `INTEGRATION_ENCRYPTION_KEY` env var (32 bytes, base64).
- `IntegrationConfig.credentials` (encrypted text) + `IntegrationConfig.credentialsIv` (IV).
- Credentials are never logged, never exposed to the client.
- **If the env var is missing, integration config creation fails** (no silent plaintext fallback).

**Recommendation: AES-256-GCM server-side encryption.** **Please confirm D6.**

### 3.7 Permissions — integration module (D7 — OWNER DECISION REQUIRED)

**Proposed resolution (D7):** New permission module `integration`:

| Key | Module | Description | Who |
|---|---|---|---|
| `integration.read` | integration | View integration configs + event log (credentials masked) | super_admin, site_admin, auditor |
| `integration.config.manage` | integration | Create/update/delete integration configs (human-only) | super_admin, site_admin |
| `integration.sync` | integration | Trigger a manual sync (pull-only) | super_admin, site_admin |

**No AI principal gets integration permissions.** Integrations are human-controlled.

**Recommendation: 3 perms; human-only; no AI.** **Please confirm D7.**

### 3.8 Observability permissions (D8 — OWNER DECISION REQUIRED)

**Proposed resolution (D8):**
- `GET /api/health` — public (no auth; returns status only, no sensitive data).
- `GET /api/metrics` — `audit.read` permission (super_admin, quality_manager, auditor, executive_viewer). Metrics are operational, not manufacturing data.

**Recommendation: health public; metrics require audit.read.** **Please confirm D8.**

### 3.9 Deployment target (D9 — OWNER DECISION REQUIRED)

**Question:** What is the deployment target for the Docker image?

**Analysis:**
- PRD §11: "Docker/Docker Compose."
- The `next.config.ts` already has `output: "standalone"` (production-ready).
- Options: (a) Docker Hub / container registry; (b) self-hosted registry; (c) build locally only (no registry push).

**Proposed resolution (D9):** **Build locally only in Phase 13.** The Dockerfile produces a production image; `docker-compose.yml` builds from the Dockerfile. No container registry push (requires credentials + registry account). The owner can push to a registry in operations.

**Recommendation: local build only; no registry push.** **Please confirm D9.**

### 3.10 Backup retention policy (D10 — OWNER DECISION REQUIRED)

**Question:** How long are backups retained?

**Analysis:**
- Medical device QMS may have regulatory retention requirements (years).
- Phase 13 has no automated scheduler; backups are manual.
- Retention policy is an operations decision, not a code decision.

**Proposed resolution (D10):** **No automated retention in Phase 13.** Backups are manual; the script creates timestamped files. Retention is an operations policy (documented in `docs/operations/backup-recovery.md`). The script does NOT delete old backups (no automated deletion).

**Recommendation: no automated retention; manual operations policy.** **Please confirm D10.**

### 3.11 Summary of proposed domain decisions

| # | Decision | Proposed | Recommendation | Owner decision |
|---|---|---|---|---|
| D1 | Integration scope | Framework only; no concrete adapters | Confirm | **REQUIRED** |
| D2 | Docker scope | Both dev (SQLite) + prod (PostgreSQL) profiles | Confirm | **REQUIRED** |
| D3 | Backup strategy | Manual scripts (SQLite + PostgreSQL) + tested restore + docs | Confirm | **REQUIRED** |
| D4 | Observability | pino + health aggregation + in-memory metrics; no external infra | Confirm | **REQUIRED** |
| D5 | Push vs pull | Pull-only in Phase 13; push requires future OWNER DECISION + ADR | Confirm | **REQUIRED** |
| D6 | Config encryption | AES-256-GCM server-side; env var key | Confirm | **REQUIRED** |
| D7 | Integration permissions | 3 perms (read/config.manage/sync); human-only; no AI | Confirm | **REQUIRED** |
| D8 | Observability permissions | Health public; metrics require audit.read | Confirm | **REQUIRED** |
| D9 | Deployment target | Local build only; no registry push | Confirm | **REQUIRED** |
| D10 | Backup retention | No automated retention; manual operations policy | Confirm | **REQUIRED** |

---

## 4. Database schema (proposed, pending §3 confirmation)

**Phase 13 introduces 2 new entities** (`IntegrationConfig` + `IntegrationEvent`). No changes to existing 69 models.

```prisma
model IntegrationConfig {
  id              String   @id @default(cuid())
  adapterType     String   // "ERP" | "MES" | "LIMS" | "PLM" | "HR" | "MAINTENANCE" | "BARCODE_RFID" | "PLC_SCADA" | "IOT" | "OTHER" (future concrete adapters register their type)
  name            String   // human-readable, e.g. "SAP ERP - Geneva"
  siteId          String?  // null = global; set = site-scoped
  endpointUrl     String   // the external system's API URL
  credentials     String   // AES-256-GCM encrypted JSON (API key, token, etc.)
  credentialsIv   String   // initialization vector for decryption
  syncSchedule    String?  // cron expression (future; not automated in Phase 13)
  status          String   @default("ACTIVE") // ACTIVE | INACTIVE | ERROR
  lastSyncAt      DateTime?
  lastSyncStatus  String?  // SUCCESS | FAILURE | PARTIAL
  isDemo          Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  site    Site?              @relation(fields: [siteId], references: [id], onDelete: SetNull)
  events  IntegrationEvent[]

  @@unique([adapterType, name])
  @@index([siteId])
  @@index([status])
}

model IntegrationEvent {
  id              String   @id @default(cuid())
  configId        String
  eventType       String   // SYNC_START | SYNC_SUCCESS | SYNC_FAILURE | SYNC_PARTIAL | HEALTH_CHECK
  recordsSynced   Int      @default(0)
  recordsFailed   Int      @default(0)
  errorDetail     String?  // error message (no credentials/secrets)
  durationMs      Int?
  triggeredByUserId String?
  createdAt       DateTime @default(now())
  // NOTE: no updatedAt — append-only. No update/delete methods.

  config IntegrationConfig @relation(fields: [configId], references: [id], onDelete: Cascade)

  @@index([configId])
  @@index([eventType])
  @@index([createdAt])
}
```

**Relation additions:** `Site` gets `integrationConfigs[]`.

---

## 5. API design

New permission module `integration.*`. All routes use `requirePermission()` + `assertSiteAccess()` + `ok()/fail()`.

```
# Integration configs (human-only)
GET    /api/integration/configs              (list — integration.read)
POST   /api/integration/configs              (create — integration.config.manage; credentials encrypted)
GET    /api/integration/configs/:id          (detail — credentials MASKED in response)
PUT    /api/integration/configs/:id          (update — integration.config.manage)
DELETE /api/integration/configs/:id          (deactivate — integration.config.manage; no hard delete)

# Integration events (append-only log)
GET    /api/integration/configs/:id/events   (list events — integration.read)

# Manual sync (pull-only; D5)
POST   /api/integration/configs/:id/sync     (trigger sync — integration.sync; audited)

# Integration health
GET    /api/integration/health               (aggregate adapter health — integration.read)

# Observability
GET    /api/health                           (public; DB + AI provider + integration aggregate)
GET    /api/metrics                          (audit.read; request/error/latency metrics)
```

---

## 6. UI architecture

Pages under `[locale]/(app)/integration/`:

```
integration/
├── page.tsx                    (overview: adapter types + status cards)
├── configs/page.tsx            (list of IntegrationConfig; create button)
├── configs/[id]/page.tsx       (detail: config (credentials masked) + event log)
```

**Nav:** add "Integration" group to sidebar (icon: Plug/Network; permission: `integration.read`).

**Observability:** no dedicated UI page in Phase 13 (health/metrics are API-only; a future operations dashboard may be Phase 14).

**i18n:** FR/EN/AR + RTL for all new strings.

---

## 7. Deployment architecture

### 7.1 Dockerfile (multi-stage)

```dockerfile
# Stage 1: deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install -g bun && bun install --frozen-lockfile

# Stage 2: build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run prisma generate && bun run build

# Stage 3: runner (standalone)
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

### 7.2 docker-compose.yml (two profiles)

```yaml
# dev profile: app + SQLite
# prod profile: app + PostgreSQL
# Usage: docker compose --profile dev up
```

### 7.3 Documentation

`docs/operations/deployment.md` — covering both profiles, env vars, secrets, cutover runbook.

---

## 8. Backup/recovery

### 8.1 Scripts

- `scripts/backup-sqlite.ts` — WAL checkpoint + file copy to `backups/sqlite-YYYYMMDD-HHMMSS.db`.
- `scripts/backup-postgres.ts` — `pg_dump --format=custom` to `backups/postgres-YYYYMMDD-HHMMSS.dump`.
- `scripts/restore.ts` — interactive restore (prompts for confirmation; verifies backup integrity).

### 8.2 Testing

- **T-BACKUP-01:** backup + restore + verify row counts match (SQLite).
- **T-BACKUP-02:** restore fails gracefully on corrupted backup.

### 8.3 Documentation

`docs/operations/backup-recovery.md` — runbook: when to backup, how to restore, retention policy (manual).

---

## 9. Observability

### 9.1 Structured logging (pino)

- `src/lib/logger.ts` — pino instance with JSON output.
- Request logging middleware (method, path, status, duration, userId).
- Error logging (structured, no secrets).
- Replaces ad-hoc `console.error` / `console.warn` calls (reduces lint warnings as a side benefit).

### 9.2 Health endpoint

`GET /api/health` (public):
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "...",
  "checks": {
    "database": { "status": "healthy", "latencyMs": 5 },
    "aiProvider": { "status": "healthy" | "unavailable", "provider": "zai" },
    "integrations": { "status": "healthy", "activeCount": 0 }
  }
}
```

### 9.3 Metrics endpoint

`GET /api/metrics` (audit.read):
- Request count, error count, average response time (in-memory, reset on restart).
- DB connection pool status.
- No Prometheus/Grafana in Phase 13.

---

## 10. PostgreSQL migration readiness (ADR-0002)

- **Cutover script** (`scripts/migrate-sqlite-to-postgres.ts`): make the Phase 1 stub executable. Copies rows with referential checks, idempotently and transactionally.
- **Runbook** (`docs/operations/postgres-cutover.md`): step-by-step cutover procedure.
- **RLS policy scripts** (`prisma/rls/`): PostgreSQL Row-Level Security policies keyed on `current_setting('app.site_scope')`, set per request from `AuthContext`. Applied after cutover.
- **No cutover execution in Phase 13** (requires a real PostgreSQL instance; the script + runbook + RLS policies are the deliverable).

---

## 11. Testing

**Target: ~25-30 new tests.** All 366 Phase 1-12 tests must continue to pass.

### 11.1 Integration framework
- **T-INTEG-01:** IntegrationAdapter interface is defined and swappable.
- **T-INTEG-02:** IntegrationConfig credentials are encrypted (plaintext not in DB).
- **T-INTEG-03:** IntegrationEvent is append-only (UPDATE/DELETE rejected).
- **T-INTEG-04:** Manual sync creates an event log entry (SYNC_START → SYNC_SUCCESS/FAILURE).
- **T-INTEG-05:** Credentials are masked in API responses.

### 11.2 Backup/recovery
- **T-BACKUP-01:** backup + restore + verify row counts.
- **T-BACKUP-02:** restore fails gracefully on corrupted backup.

### 11.3 Observability
- **T-OBS-01:** health endpoint returns aggregated status.
- **T-OBS-02:** metrics endpoint requires audit.read.
- **T-OBS-03:** structured logging produces JSON output.

### 11.4 Security
- **T-SEC-13:** integration credentials never exposed to client.
- **T-SEC-13b:** encryption key missing → config creation fails.
- **T-SEC-13c:** site isolation on integration configs.

### 11.5 Regression
- **All 366 Phase 1-12 tests must pass unchanged.**

---

## 12. Technical-debt implications

- **Lint warnings:** Phase 12 = 202. Phase 13 should not increase net (replacing `console.error` with pino may actually reduce warnings).
- **`vitest.config.ts` typecheck issue:** pre-existing; remains documented.
- **PostgreSQL migration (ADR-0002):** Phase 13 makes the cutover script executable + RLS policies — this directly addresses the top production blocker.
- **Distributed rate limiting:** deferred to Phase 14 (requires Redis).
- **Concrete integration adapters:** deferred (require real target systems).
- **Automated backup scheduling:** deferred (requires cron/external scheduler).

---

## 13. OWNER DECISION REQUIRED — summary

**All 10 domain decisions (D1-D10) require owner confirmation.** The most critical:

1. **D1 — Integration scope** (framework only vs concrete adapters). This determines whether Phase 13 is infrastructure-only or includes real integrations.
2. **D5 — Push vs pull** (pull-only is the conservative default; push requires future approval).
3. **D2 — Docker scope** (dev + prod profiles).
4. **D4 — Observability** (pino + health + metrics; no external infra).

The remaining (D3, D6, D7, D8, D9, D10) have sensible defaults proposed.

---

## 14. Critical rules (restated)

- **Local-First (PRD §12):** core workflows must not depend on integrations. If an integration is unavailable, the system continues normally.
- **Pull-only (D5):** Phase 13 adapters pull from external systems; they do not push. Push requires future OWNER DECISION + ADR.
- **Controlled adapters (PRD §13):** every adapter goes through the `IntegrationAdapter` seam; no tight coupling to one vendor.
- **Credentials encrypted (D6):** AES-256-GCM; never exposed to client; never logged.
- **Audit (D7/D8):** every sync is audited via `IntegrationEvent` (append-only) + `AuditEvent`.
- **Cross-site leakage = CRITICAL DEFECT.**

---

## 15. NO INVENTED REQUIREMENTS (restated)

Phase 13 does **not** invent: concrete integration adapters (only the framework), integration workflows, regulatory requirements, vendor-specific protocols, formulas, or business rules. Where the PRD is ambiguous → **OWNER DECISION REQUIRED** (D1-D10). No silent interpretation.

---

## 16. PHASE 13 IMPLEMENTATION MUST NOT START

After this plan is produced:

**STOP.**

Do NOT:
- implement Phase 13 UI
- implement Phase 13 APIs
- create Phase 13 migrations
- create Docker/backup/observability infrastructure
- begin Phase 14

Wait for explicit owner approval of this plan **and** all 10 OWNER DECISION REQUIRED items (D1-D10).

---

## 17. Required workflow

```
PLAN → OWNER REVIEW → APPROVAL → IMPLEMENT → TEST → SELF-REVIEW →
SECURITY REVIEW → FIX → FULL REGRESSION → VALIDATION REPORT →
STOP → OWNER APPROVAL
```

**Never advance automatically.** (CLAUDE.md: the host's standing 15-min `webDevReview` cron is superseded by Circum's "never advance automatically / wait for owner approval" rule, owner-approved Phase 0 Q5.)

---

```
PHASE 13 PLAN STATUS: WAITING FOR OWNER APPROVAL (and D1-D10 confirmation)
```

**I am stopping here.** Awaiting your approval and confirmation of D1-D10.
