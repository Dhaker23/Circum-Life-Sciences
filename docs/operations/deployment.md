# Circum — Deployment Guide

> Phase 13 D2. Docker/Docker Compose deployment for development and production.

## Prerequisites

- Docker 24+ and Docker Compose v2+
- `.env` file with required secrets (see `docs/operations/secrets.md`)

## Required environment variables

| Variable | Purpose | Required |
|---|---|---|
| `NEXTAUTH_SECRET` | Signs next-auth JWTs + cookies | Yes |
| `AUTH_PEPPER` | Server-side pepper for password hashing | Yes |
| `INTEGRATION_ENCRYPTION_KEY` | AES-256-GCM key for integration credentials | Yes |
| `POSTGRES_PASSWORD` | PostgreSQL password (prod profile only) | Prod only |
| `NEXTAUTH_URL` | Canonical app URL (prod profile only) | Prod only |

Generate secrets:
```bash
openssl rand -base64 32  # for NEXTAUTH_SECRET, AUTH_PEPPER, INTEGRATION_ENCRYPTION_KEY
```

## Development profile (SQLite)

```bash
docker compose --profile dev up --build
```

- App: http://localhost:3000
- Database: SQLite (file in `dev-data` volume)
- No PostgreSQL required

## Production profile (PostgreSQL)

**Prerequisite:** Run the SQLite → PostgreSQL cutover first (see `docs/operations/postgres-cutover.md`).

```bash
docker compose --profile prod up --build -d
```

- App: http://localhost:3000
- Database: PostgreSQL 16 (in `pg-data` volume)
- Health check: `GET /api/health`
- Migrations: run `bunx prisma migrate deploy` inside the container after first start

## Health checks

The Dockerfile includes a `HEALTHCHECK` that polls `GET /api/health` every 30s.

## Persistent volumes

- `dev-data`: SQLite database file (dev profile)
- `pg-data`: PostgreSQL data (prod profile)

## Backup

See `docs/operations/backup-recovery.md`.

## Security notes

- Secrets must come from environment variables or a secrets manager (never baked into the image).
- The production profile does NOT expose PostgreSQL externally (only to the app container).
- Security headers (CSP, X-Frame-Options, etc.) are configured in `next.config.ts`.
- D9: No container registry push in Phase 13. Build locally.
