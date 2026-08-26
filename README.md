# Circum — Medical Device Manufacturing & QMS Platform

A production-grade Medical Device Manufacturing & Quality Management (QMS) Platform for a regulated CDMO environment. Validation-minded, local-first, multilingual (FR/EN/AR+RTL), and audit-ready.

## Project Status

**Development roadmap COMPLETE (Phases 0-14).** All 15 phases approved and closed.

- **Final commit:** `05e3c74`
- **Prisma models:** 71
- **Permissions:** 168
- **Tests:** 402/402 PASS
- **E2E specs:** 36 (7 critical workflows)
- **Typecheck:** 0 errors
- **Lint:** 0 errors / 115 warnings
- **ADRs:** 11
- **i18n:** FR / EN / AR + RTL

## Technology Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Database:** Prisma ORM + SQLite (development) / PostgreSQL (production, ADR-0002)
- **Authentication:** NextAuth.js v4 (DB sessions, argon2id + pepper)
- **UI:** Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons + recharts
- **State:** Zustand (client) + TanStack Query (server)
- **AI:** z-ai-web-dev-sdk (advisory-only, provider-abstracted)
- **Observability:** pino structured logging
- **Testing:** Vitest (integration) + Playwright (E2E)

## Quick Start (Local Development)

### Prerequisites

- Node.js v22+
- Bun v1.1+
- Git

### Installation

```bash
# Clone the repository
git clone <repo-url> circum
cd circum

# Install dependencies
bun install

# Copy environment template
cp .env.example .env

# Generate secrets (run 3 times, paste into .env)
openssl rand -base64 32  # → NEXTAUTH_SECRET
openssl rand -base64 32  # → AUTH_PEPPER
openssl rand -base64 32  # → INTEGRATION_ENCRYPTION_KEY
```

### Database Setup

```bash
# Create database directory
mkdir -p db

# Apply migrations (non-destructive)
bunx prisma migrate deploy

# Generate Prisma client
bunx prisma generate

# Load DEMO/TEST data
bun run db:seed
```

### Start Development Server

```bash
bun run dev
```

Open `http://localhost:3000` in your browser.

## Demo Credentials (DEMO/TEST only)

| Email | Role | Password |
|---|---|---|
| `admin@circum.demo` | Super Admin (global) | `CircumDemo2025!` |
| `qmanager.ch@circum.demo` | Quality Manager (CH site) | `CircumDemo2025!` |
| `operator.tn@circum.demo` | Operator (TN site) | `CircumDemo2025!` |
| `auditor.fr@circum.demo` | Auditor (FR site) | `CircumDemo2025!` |

## Available Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start development server (port 3000) |
| `bun run build` | Production build (standalone) |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | TypeScript type check |
| `bun run test` | Run integration tests (Vitest) |
| `bun run test:e2e` | Run E2E tests (Playwright) |
| `bun run db:push` | Push schema to database |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:migrate` | Create + apply migration |
| `bun run db:seed` | Load DEMO data |

## Environment Variables

See `.env.example` for the full template. Required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite (dev) or PostgreSQL (prod) connection string |
| `NEXTAUTH_SECRET` | NextAuth JWT signing secret |
| `NEXTAUTH_URL` | Canonical application URL |
| `AUTH_PEPPER` | Password hashing pepper (never change after data exists) |
| `INTEGRATION_ENCRYPTION_KEY` | AES-256-GCM key for integration credentials |

## Architecture

```
Presentation (Next.js App Router)
    → API Routes (ok/fail envelope)
      → Application Services (domain modules)
        → Domain Logic (state machines, zod schemas)
          → Infrastructure (Prisma, audit, auth, RBAC)
            → Database (SQLite/PostgreSQL) + Cache + Events
```

### Key Architectural Principles

1. **Priority:** Safety > Quality > Traceability > Data Integrity > Controlled Workflows > Validation > Security > Efficiency > Lean > AI
2. **Local-First:** Core workflows operate on factory LAN without Internet
3. **AI is advisory-only:** AI never mutates, approves, or releases
4. **Site isolation:** Cross-site data leakage is a CRITICAL defect
5. **Audit immutability:** AuditEvent is append-only (DB triggers)

## Documentation

- **PRD:** `docs/PRD/CIRCUM_MASTER_PRD_FINAL.md` + 14 phase plans + 14 validation reports
- **Decisions:** `docs/adr/` (11 ADRs)
- **Domain:** `CONTEXT.md` + `DOMAIN_GLOSSARY.md`
- **Operations:** `docs/operations/` (secrets, deployment, backup, PostgreSQL cutover)
- **Agent instructions:** `CLAUDE.md`

## Modules (15 domain modules)

| Module | Path | Phase |
|---|---|---|
| Identity / RBAC / Audit | `src/modules/identity/` + `src/modules/audit/` | 1 |
| Manufacturing Master Data | `src/modules/manufacturing/` | 2 |
| Production Execution | `src/modules/production/` | 3 |
| Quality (NCR/Deviation/CAPA) | `src/modules/quality/` | 4 |
| Laboratory / Inspection | `src/modules/laboratory/` | 5 |
| Traceability / Genealogy | `src/modules/traceability/` | 6 |
| Document Control / Training | `src/modules/docs/` + `src/modules/supplieraudit/` | 7 |
| Equipment / Calibration | `src/modules/equipment/` | 8 |
| Cleanroom / Packaging / Sterilization / Batch Review | `src/modules/phase9/` | 9 |
| Lean / OEE / VSM | `src/modules/lean/` | 10 |
| Analytics / Dashboards | `src/modules/analytics/` | 11 |
| AI Assistant | `src/modules/ai/` | 12 |
| Integrations Framework | `src/modules/integration/` | 13 |

## Production Readiness

See `docs/PRD/PHASE-14-VALIDATION-REPORT.md` for the final Production Readiness Checklist.

### Verified (in development environment)
Architecture, Database (SQLite), Authentication, RBAC, Site isolation, Audit, Data integrity, Manufacturing traceability, Quality workflows, Equipment/calibration, Cleanroom, Packaging, Sterilization, Batch release, Lean/OEE/VSM, Analytics, AI governance, Integration framework, Backup/recovery, Observability, Security, i18n.

### Environment-Blocked (require production environment)
PostgreSQL cutover + RLS, Docker build/runtime, Production Z.ai cloud provider, Playwright E2E execution, Load testing.

### Deferred (future enhancement)
Redis/distributed rate limiting, pgvector/vector search, Automated backup scheduling.

### Not Implemented (require real target system + owner decision + ADR)
Concrete ERP/MES/LIMS/PLC-SCADA/IoT/Barcode-RFID/PLM/HR/maintenance adapters, Push integrations.

## Compliance Note

This software supports medical-device manufacturing and QMS workflows. It does NOT claim automatic ISO 13485 / FDA 21 CFR Part 11 / GxP compliance. Compliance depends on intended use, validated configuration, infrastructure, and evidence (PRD §17).

## License

Proprietary. All rights reserved.
