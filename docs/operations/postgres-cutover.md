# Circum — PostgreSQL Migration Runbook (ADR-0002)

> Phase 13 D5. SQLite → PostgreSQL cutover procedure.

## Status

- **Sandbox environment:** NOT EXECUTED (no PostgreSQL available).
- **Production:** Execute this runbook when PostgreSQL is provisioned.

## Prerequisites

1. PostgreSQL 14+ provisioned and accessible
2. `psql` client installed
3. The Circum SQLite database is accessible (source)
4. Downtime window scheduled (cutover requires brief read-only period)

## Cutover steps

### 1. Provision PostgreSQL

```bash
# Create database + user
psql -U postgres -c "CREATE USER circum WITH PASSWORD '<secure-password>';"
psql -U postgres -c "CREATE DATABASE circum OWNER circum;"
```

### 2. Set environment

```bash
export SQLITE_DATABASE_URL=file:./db/custom.db
export DATABASE_URL=postgresql://circum:<password>@localhost:5432/circum
```

### 3. Run migrations on PostgreSQL

```bash
DATABASE_URL=postgresql://circum:<password>@localhost:5432/circum \
bunx prisma migrate deploy
```

### 4. Run the cutover script

```bash
bun run scripts/migrate-sqlite-to-postgres.ts
```

- Copies all rows from SQLite to PostgreSQL in FK dependency order
- Transactional on the PG side
- Idempotent (re-runnable)
- Verifies row counts

### 5. Apply RLS policies

```bash
psql -d circum -f prisma/rls/policies.sql
```

- Enables Row-Level Security on all site-owned tables
- Creates the `site_scope_setting_has_site()` helper function
- Creates `site_isolation` policies

### 6. Verify

```bash
# Row counts match
psql -d circum -c "SELECT COUNT(*) FROM users;"
psql -d circum -c "SELECT COUNT(*) FROM sites;"
psql -d circurm -c "SELECT COUNT(*) FROM manufacturing_batches;"

# Site isolation (RLS)
psql -d circum -c "SET app.site_scope = '<siteA-id>'; SELECT COUNT(*) FROM material_lots;"  # should return only siteA's lots
psql -d circum -c "SET app.site_scope = '*'; SELECT COUNT(*) FROM material_lots;"  # should return all
```

### 7. Switch the application

```bash
# Update .env to use PostgreSQL
DATABASE_URL=postgresql://circum:<password>@localhost:5432/circum

# Restart the app
docker compose --profile prod up --build -d
```

## Rollback

If the cutover fails:
1. Revert `DATABASE_URL` to SQLite
2. Restart the app
3. The SQLite database is unchanged (cutover is non-destructive to the source)

## Post-cutover

- Verify the application starts cleanly
- Run the test suite against PostgreSQL
- Monitor for RLS policy violations (query failures)
- Update `docs/operations/secrets.md` with the new DATABASE_URL

## RLS tables

The following tables have RLS enabled (see `prisma/rls/policies.sql`):
- MaterialLot, WorkOrder, ManufacturingBatch, DeviceLot, OperationExecution
- NCR, Deviation, Investigation, CAPA, ChangeControl, RiskAssessment
- Equipment, MaintenanceRecord, CalibrationRecord
- DowntimeEvent, AiConversation, IntegrationConfig

Global tables (no siteId, no RLS): Product, ProductRevision, BOM, BOMLine, Material, MaterialSupplier, Supplier, Routing, Operation, ControlledDocument, RequiredTraining, etc.
