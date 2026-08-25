# Circum — Secrets & Environment

> Required environment variables. NEVER commit real secrets. Copy `.env.example` to `.env` and fill real values.

## Required for Phase 1

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Prisma datasource. SQLite (dev) / PostgreSQL (prod, ADR-0002). | `file:/home/z/my-project/db/custom.db` |
| `NEXTAUTH_SECRET` | Signs next-auth JWTs + cookies. Generate: `openssl rand -base64 32`. | (32+ char random) |
| `NEXTAUTH_URL` | Canonical app URL. | `http://localhost:3000` |
| `AUTH_PEPPER` | Server-side pepper applied to passwords before argon2id hashing. Changing it invalidates ALL existing password verifications. Generate: `openssl rand -base64 32`. Never logged, never committed. | (32+ char random) |
| `SEED_DEMO_PASSWORD` | Password for the synthetic DEMO/TEST seed users. DEMO only. | `CircumDemo2025!` |

## Generation

```bash
openssl rand -base64 32   # for NEXTAUTH_SECRET and AUTH_PEPPER
```

## DEMO credentials (DEMO/TEST only — never real Circum data)

After `bun run db:seed`, these synthetic accounts exist (all clearly labelled DEMO):

| Email | Role | Scope | Password |
|---|---|---|---|
| admin@circum.demo | Super Administrator | global | CircumDemo2025! |
| siteadmin.ch@circum.demo | Site Administrator | CH site | CircumDemo2025! |
| qmanager.ch@circum.demo | Quality Manager | CH site | CircumDemo2025! |
| operator.tn@circum.demo | Operator | TN site / Production | CircumDemo2025! |
| auditor.fr@circum.demo | Auditor (read-only) | FR site | CircumDemo2025! |
| plantmgr.tn@circum.demo | Plant Manager | TN site | CircumDemo2025! |

## Production checklist (Phase 13)

- [ ] Migrate SQLite → PostgreSQL (ADR-0002) BEFORE production.
- [ ] Generate fresh `NEXTAUTH_SECRET` and `AUTH_PEPPER` (not reused from dev).
- [ ] Serve over TLS; set session cookie `Secure` (automatic when `NEXTAUTH_URL` is https).
- [ ] Restrict `DATABASE_URL` network exposure (factory LAN).
- [ ] Configure backup + recovery for the database.
- [ ] Add Row-Level Security policies on PostgreSQL (ADR-0002/0004).
- [ ] No secrets in source control; rotate on personnel change.
