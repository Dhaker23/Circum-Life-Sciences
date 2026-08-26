# Circum — Vercel Readiness Report

> **Task:** Post-development Vercel deployment readiness assessment (Task 11)
> **Date:** Post-Phase 14 closure
> **Purpose:** Assess Vercel Preview deployment compatibility. DO NOT DEPLOY.

## Assessment Summary

| Category | Status |
|---|---|
| Build readiness | ❌ FAIL (pre-existing proxy.ts issue) |
| Environment variables | ✅ READY (documented in .env.example) |
| Database | ⚠️ REQUIRES OWNER DECISION (SQLite vs PostgreSQL) |
| Authentication | ✅ READY (NextAuth v4) |
| AI provider | ⚠️ ENVIRONMENT-BLOCKED (cloud provider verification) |
| Integration framework | ✅ READY (framework only; no concrete adapters) |
| Docker | ⚠️ ENVIRONMENT-BLOCKED (Docker not tested in sandbox) |

## Detailed Assessment

### 1. Next.js Version

| Requirement | Status |
|---|---|
| Next.js 16.1.3 | ✅ VERIFIED |
| React 19 | ✅ VERIFIED |
| Turbopack | ✅ VERIFIED (dev + build) |
| Standalone output | ✅ VERIFIED (`next.config.ts: output: "standalone"`) |

**Vercel compatibility:** Next.js 16 is supported on Vercel. Standalone output is the recommended production mode.

### 2. Node.js Requirement

| Requirement | Status |
|---|---|
| Node.js 22+ | ✅ VERIFIED (required by Next.js 16 + React 19) |
| Vercel Node.js 22 | ✅ AVAILABLE (Vercel supports Node.js 22) |

### 3. Build Command

| Requirement | Status |
|---|---|
| Install command | `bun install` ✅ |
| Build command | `bun run build` (or `next build`) ✅ |
| Build succeeds? | ❌ **FAIL** — pre-existing `proxy.ts` route segment config error |

**Build failure detail:**
```
Error: Route segment config is not allowed in Proxy file at "./src/proxy.ts".
Proxy always runs on Node.js runtime.
```

**Fix required (REQUIRES OWNER APPROVAL):** Remove `export const config` and `export const runtime` from `src/proxy.ts`. The proxy function's internal routing logic handles all cases correctly without the `matcher` config.

### 4. Environment Variables

| Variable | Required | Vercel config | Status |
|---|---|---|---|
| `DATABASE_URL` | Yes | Vercel env var | ✅ Documented in .env.example |
| `NEXTAUTH_SECRET` | Yes | Vercel env var (secret) | ✅ Documented |
| `NEXTAUTH_URL` | Yes | Vercel deployment URL | ✅ Documented |
| `AUTH_PEPPER` | Yes | Vercel env var (secret) | ✅ Documented |
| `INTEGRATION_ENCRYPTION_KEY` | Yes | Vercel env var (secret) | ✅ Documented |
| `SEED_DEMO_PASSWORD` | Optional | Vercel env var | ✅ Documented |
| `AI_PROVIDER` | Optional | Vercel env var | ✅ Documented |
| `LOG_LEVEL` | Optional | Vercel env var | ✅ Documented |

**Status: READY.** All env vars documented in `.env.example`.

### 5. Prisma Generation

| Requirement | Status |
|---|---|
| `prisma generate` in build | ⚠️ REQUIRES OWNER DECISION |
| Prisma client in node_modules | ✅ VERIFIED |
| Post-install script | Not configured |

**Issue:** Vercel's build process may need `prisma generate` to run before `next build`. The `package.json` does not have a `postinstall` script for `prisma generate`. Two options:
1. Add `"postinstall": "prisma generate"` to `package.json` (REQUIRES OWNER APPROVAL — modifies package.json).
2. Configure Vercel build command as `bunx prisma generate && bun run build` (no code change; Vercel dashboard config).

**Recommendation:** Option 2 (Vercel build command override) — no code change needed.

### 6. Database Requirements

| Requirement | Status |
|---|---|
| SQLite (development) | ✅ VERIFIED (works locally) |
| PostgreSQL (production) | ⚠️ REQUIRES OWNER DECISION |
| Vercel Postgres | ⚠️ REQUIRES OWNER DECISION |
| External PostgreSQL | ⚠️ REQUIRES OWNER DECISION |

**Issue:** Vercel is a serverless platform. SQLite (file-based) does NOT work on Vercel because:
- Vercel serverless functions have an ephemeral filesystem (no persistent file storage).
- SQLite writes to a file; the file is lost when the function instance is recycled.

**Options:**
1. **Vercel Postgres** (managed PostgreSQL) — requires PostgreSQL migration (ADR-0002 cutover script). Set `DATABASE_URL` to the Vercel Postgres connection string.
2. **External PostgreSQL** (e.g., Supabase, Neon, self-hosted) — same migration requirement.
3. **Do not deploy to Vercel** — deploy to a VPS/container platform that supports persistent filesystem (Docker, per Phase 13 Dockerfile).

**Status: REQUIRES OWNER DECISION.** SQLite cannot be used on Vercel. PostgreSQL migration (ADR-0002) must be executed first.

### 7. Authentication Requirements

| Requirement | Status |
|---|---|
| NextAuth v4 | ✅ VERIFIED |
| `NEXTAUTH_SECRET` | ✅ Documented |
| `NEXTAUTH_URL` | ✅ Documented (set to Vercel deployment URL) |
| DB sessions (ADR-0003) | ✅ VERIFIED (requires database — see Database section) |
| argon2id password hashing | ✅ VERIFIED (`@node-rs/argon2` — native binary; Vercel supports Linux x86_64) |

**Status: READY** (once database is resolved).

### 8. AI Provider Requirements

| Requirement | Status |
|---|---|
| `z-ai-web-dev-sdk` | ✅ INSTALLED |
| Server-side only | ✅ VERIFIED (only in `ZaiProvider`) |
| Cloud AI reachable from Vercel | ⚠️ ENVIRONMENT-BLOCKED |
| API key/credentials | ⚠️ ENVIRONMENT-BLOCKED |

**Issue:** The `z-ai-web-dev-sdk` requires server-side credentials and network access to the Z.ai cloud API. Vercel serverless functions have Internet access, but the Z.ai API key/credentials must be configured as Vercel env vars.

**Status: ENVIRONMENT-BLOCKED.** Must verify Z.ai provider credentials + network access in a real Vercel environment. The D6 Local-First fallback ("AI provider unavailable") will display if the provider is unreachable — this is the correct behavior.

### 9. Integration Requirements

| Requirement | Status |
|---|---|
| Integration framework | ✅ VERIFIED (Phase 13) |
| Concrete adapters | ❌ NOT IMPLEMENTED (require real target systems) |
| `INTEGRATION_ENCRYPTION_KEY` | ✅ Documented |
| Pull-only | ✅ VERIFIED |

**Status: READY** (framework only; no concrete adapters needed for deployment).

### 10. Docker Assumptions

| Requirement | Status |
|---|---|
| Dockerfile | ✅ EXISTS (Phase 13) |
| docker-compose.yml | ✅ EXISTS (Phase 13) |
| Docker build tested | ⚠️ ENVIRONMENT-BLOCKED |

**Note:** Vercel does NOT use Docker. Vercel builds from source using the framework's native build command. The Dockerfile is for alternative deployment (VPS, container platform).

**Status: N/A for Vercel.** Docker is for non-Vercel deployment.

### 11. Filesystem Write Assumptions

| Requirement | Status |
|---|---|
| SQLite file writes | ❌ INCOMPATIBLE with Vercel serverless |
| Log file writes (`tee dev.log`) | ❌ INCOMPATIBLE with Vercel serverless |
| Backup file writes | ❌ INCOMPATIBLE with Vercel serverless |
| Upload directory | ⚠️ REQUIRES REVIEW |

**Issue:** The `dev` script uses `tee dev.log` which writes to the filesystem. On Vercel, this would fail silently or be ignored. The production `start` script also uses `tee server.log`.

**Fix required (REQUIRES OWNER APPROVAL):** For Vercel deployment, use `next build` + Vercel's default start command (not the custom `start` script with `tee`). The `dev` script's `tee dev.log` is development-only and does not affect Vercel.

### 12. Background Process Assumptions

| Requirement | Status |
|---|---|
| Long-running dev server | ❌ INCOMPATIBLE with Vercel serverless (but Vercel handles this natively) |
| WebSocket/mini-services | ⚠️ REQUIRES REVIEW (mini-services directory is empty placeholder) |
| Rate limiting (in-memory) | ⚠️ REQUIRES REVIEW (in-memory rate limiting does not persist across Vercel serverless instances) |

**Issue:** In-memory rate limiting (Phase 12 AI: 20/5min) does not work reliably on Vercel serverless because each function invocation may be a different instance. This is a known DEFERRED item (distributed rate limiting requires Redis).

**Status: DEFERRED.** In-memory rate limiting works for single-instance deployment (Docker/VPS). For Vercel multi-instance, Redis-based distributed rate limiting is needed (Phase 14 DEFERRED item).

---

## Summary

| Requirement | Category |
|---|---|
| Next.js 16 + React 19 | ✅ VERIFIED |
| Node.js 22 | ✅ VERIFIED |
| Environment variables | ✅ READY |
| Prisma client generation | ⚠️ REQUIRES OWNER DECISION (postinstall or Vercel build command) |
| Authentication | ✅ READY (once DB resolved) |
| AI provider | ⚠️ ENVIRONMENT-BLOCKED (credentials + network verification) |
| Integration framework | ✅ READY |
| **Build command** | ❌ **FAIL** (pre-existing proxy.ts issue; REQUIRES OWNER DECISION to fix) |
| **Database** | ⚠️ **REQUIRES OWNER DECISION** (SQLite incompatible with Vercel; PostgreSQL migration required) |
| **Rate limiting** | ⚠️ **DEFERRED** (in-memory does not work on serverless; needs Redis) |
| Docker | ⚠️ ENVIRONMENT-BLOCKED (not tested; N/A for Vercel) |

## Vercel Deployment Prerequisites (before deployment)

1. **Fix proxy.ts build error** (REQUIRES OWNER APPROVAL) — remove `export const config` and `export const runtime` from `src/proxy.ts`.
2. **Migrate to PostgreSQL** (ADR-0002) — execute the cutover script; set `DATABASE_URL` to Vercel Postgres or external PostgreSQL.
3. **Configure Vercel env vars** — all secrets from `.env.example`.
4. **Configure Vercel build command** — `bunx prisma generate && bun run build` (or add `postinstall` to package.json).
5. **Verify Z.ai provider** — configure API credentials; test AI assistant.
6. **Accept rate-limiting limitation** — in-memory rate limiting will not persist across instances; or defer Vercel deployment until Redis is configured.

**DO NOT DEPLOY TO VERCEL.** Awaiting owner authorization.
