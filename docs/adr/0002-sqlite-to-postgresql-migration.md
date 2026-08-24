# ADR-0002: SQLite as Temporary Database with PostgreSQL Migration Path

- **Status:** Accepted (owner-approved Phase 0 Q4, conditional)
- **Date:** Phase 0 closure
- **Deciders:** Circum project owner
- **Supersedes:** —
- **Related:** ADR-0001 (Matt Pocock skills), `docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md` §4/§14a

## Context

Circum Master PRD §11 specifies the preferred stack including **PostgreSQL**. The host development environment, however, provides **SQLite only** — confirmed by environment inspection: no `psql`/`postgres`/`pg_ctl`/`pg_isready` binaries, no listener on port 5432, and only the `libpq5`/`libpq-dev` client libraries installed. The host's standing environment rule states "SQLite client only" and "no additional middleware (MySQL, Redis, etc.)."

The owner's Phase 0 decision (Q4) was conditional: *"Use PostgreSQL from the beginning **if the environment supports it**."* Since the environment does not support PostgreSQL, the owner's fallback applies: *"SQLite is only a temporary fallback."*

This ADR records that fact and defines the migration path so that Phase 1+ development is not blocked, while keeping the system PostgreSQL-ready.

## Decision

1. **Use SQLite now** (`provider = "sqlite"`) as the development/demo database for Phase 1 (and subsequent phases until PostgreSQL becomes available).
2. **Design the Prisma schema for PostgreSQL portability** from day one:
   - No SQLite-only types.
   - Enums modeled as `String` + a zod schema that is the single source of truth for allowed values + a domain state-machine layer.
   - `DateTime` for all timestamps.
   - `Json` for flexible snapshots (works on both SQLite and PostgreSQL).
   - Foreign keys and `@@unique` / `@@index` used throughout (portable).
3. **Adopt `prisma migrate dev`** for versioned migration history (validation evidence, PRD §17) instead of `db:push`-only. SQLite migrations are forward-compatible to PostgreSQL.
4. **Write a one-time cutover script** (`scripts/migrate-sqlite-to-postgres.ts`) — stubbed and documented in Phase 1, executable when PostgreSQL lands. It copies rows with referential checks, idempotently and transactionally on the PG side, with the SQLite source read-only during cutover.
5. **When PostgreSQL is available:** flip `datasource.provider` to `postgresql`, set `DATABASE_URL`, run `prisma migrate deploy`, run the cutover script, and add **Row-Level Security (RLS) policies** keyed on `current_setting('app.site_scope')` (set per request from `AuthContext`). The repository-layer site-scope filters (Phase 1) remain as defense-in-depth; RLS becomes the DB-level backstop. No application code change required.
6. **Enable SQLite WAL mode** for Phase 1 to improve read/write concurrency on the LAN.

## Alternatives considered

- **PostgreSQL now (override host rule):** rejected — no PG server is installed, and the host rule prohibits installing additional middleware. Would block all Phase 1 work.
- **SQLite throughout (reject PRD §11):** rejected — inadequate for multi-site concurrency, row-level security, and some Part 11 expectations at scale; the owner explicitly called SQLite "temporary."
- **Defer Phase 1 until PG is available:** rejected — blocks all progress; the portability design + cutover script make SQLite safe as a temporary fallback.

## Consequences

- **Positive:** unblocks Phase 1+ immediately; schema is portable; migration is a documented, scripted, idempotent operation; repository-layer scope filtering already enforces multi-site isolation (RLS is a future hardening, not a prerequisite).
- **Negative / cost:** SQLite lacks native enums (string+zod adds a small enforcement burden), lacks RLS (isolation enforced in app code until PG), and has lower write concurrency (mitigated by WAL + LAN-scale load). These are accepted, time-bounded trade-offs.
- **Risk:** enum-as-string drift between app and DB. Mitigated by a single zod schema shared by the app and a migration validator script.
- **Reversibility:** high until real data exists; the cutover script makes the move deterministic. After real data exists, the script is re-runnable and transactional.

## Compliance note

This ADR records an infrastructure constraint and its mitigation, not a compliance claim. Multi-site data isolation is enforced at the application layer in Phase 1 (see `docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md` §8) and will be hardened at the DB layer when PostgreSQL is available. Compliance depends on validated configuration, infrastructure, and evidence (PRD §17).
