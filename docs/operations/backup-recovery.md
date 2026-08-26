# Circum — Backup & Recovery Runbook

> Phase 13 D3. Manual backup scripts + tested restore procedures.

## Backup

### SQLite (development)

```bash
bun run scripts/backup-sqlite.ts ./backups
```

- WAL checkpoint + file copy
- Output: `backups/sqlite-YYYYMMDD-HHMMSS.db`
- Verify: the restore test below

### PostgreSQL (production)

```bash
DATABASE_URL=postgresql://circum:pass@localhost:5432/circum \
bun run scripts/backup-postgres.ts ./backups
```

- Uses `pg_dump --format=custom`
- Output: `backups/postgres-YYYYMMDD-HHMMSS.dump`

## Restore

```bash
bun run scripts/restore.ts ./backups/sqlite-20250101-120000.db
```

- Interactive: prompts for `CONFIRM` before overwriting
- Verifies table accessibility after restore

## Restore verification

The backup is only valid if the restore succeeds and data is accessible:

```bash
# 1. Backup
bun run scripts/backup-sqlite.ts ./backups

# 2. Restore to a test location
DATABASE_URL=file:./db/test-restore.db bun run scripts/restore.ts ./backups/sqlite-YYYYMMDD-HHMMSS.db

# 3. Verify row counts
DATABASE_URL=file:./db/test-restore.db bun -e "
  const {db} = require('./src/lib/db');
  Promise.all([
    db.user.count(), db.site.count(), db.manufacturingBatch.count()
  ]).then(([u,s,b]) => { console.log({users:u, sites:s, batches:b}); process.exit(0); });
"
```

The Phase 13 test `T-BACKUP-01` automates this verification.

## Retention policy

**D10: No automated retention.** Backups are manual; the script does NOT delete old backups.

Retention is an operations decision:
- Medical device QMS may require multi-year retention (consult regulatory requirements).
- The owner must define the retention policy based on applicable regulations.
- **Do not invent a retention period** without an explicit business/regulatory requirement.

## Scheduling

**No automated scheduling in Phase 13.** Backups are manual (script execution).
Future phases or operations may add scheduled backups (cron, external scheduler).
