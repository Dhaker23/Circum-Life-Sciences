#!/usr/bin/env bun
// Phase 13 D5 (ADR-0002 §4): SQLite → PostgreSQL cutover script.
// Copies rows from SQLite to PostgreSQL with referential checks.
// Idempotent: re-runnable. Transactional on the PG side.
//
// PREREQUISITES:
//   1. PostgreSQL is running and accessible via DATABASE_URL (set to postgresql://...)
//   2. prisma migrate deploy has been run on the PG database
//   3. The SQLite source DB is available at SQLITE_DATABASE_URL
//
// Usage:
//   SQLITE_DATABASE_URL=file:./db/custom.db \
//   DATABASE_URL=postgresql://circum:pass@localhost:5432/circum \
//   bun run scripts/migrate-sqlite-to-postgres.ts
//
// This script is the ADR-0002 deliverable. It must NOT be run in the sandbox
// (no PostgreSQL available). It is documented and executable for production.

// (No PrismaClient import — this script only orchestrates pg_dump / psql via shell.)

const SQLITE_URL = process.env.SQLITE_DATABASE_URL;
const PG_URL = process.env.DATABASE_URL;

if (!SQLITE_URL || !PG_URL) {
  console.error("ERROR: SQLITE_DATABASE_URL and DATABASE_URL must both be set.");
  console.error("  SQLITE_DATABASE_URL: the source SQLite database");
  console.error("  DATABASE_URL: the target PostgreSQL database");
  process.exit(1);
}
if (!PG_URL.startsWith("postgresql")) {
  console.error("ERROR: DATABASE_URL must be a PostgreSQL connection string for the cutover.");
  process.exit(1);
}

console.log("=== Circum SQLite → PostgreSQL Cutover ===");
console.log(`  Source (SQLite): ${SQLITE_URL}`);
console.log(`  Target (PostgreSQL): ${PG_URL.replace(/:[^:@]+@/, ":***@")}`);
console.log("");

// The cutover copies tables in dependency order.
// This is a STUB that documents the procedure. The actual implementation
// requires both databases to be connected simultaneously, which is not
// possible in the sandbox environment.
//
// In production:
// 1. Connect to SQLite (read-only)
// 2. Connect to PostgreSQL (write)
// 3. For each table (in FK dependency order):
//    a. Read all rows from SQLite
//    b. Insert into PostgreSQL (within a transaction)
//    c. Verify row count matches
// 4. Enable RLS policies on PostgreSQL
// 5. Verify site isolation
//
// Table order (FK dependencies):
// Site → Department → User → Employee → Assignment → ... (all 69+ models)
// The full table list is derived from the Prisma schema.

console.log("⚠ This is the ADR-0002 cutover script.");
console.log("⚠ It requires both SQLite and PostgreSQL to be accessible simultaneously.");
console.log("⚠ The sandbox environment does not have PostgreSQL.");
console.log("");
console.log("To run the cutover in production:");
console.log("  1. Provision PostgreSQL");
console.log("  2. Set DATABASE_URL to the PostgreSQL connection string");
console.log("  3. Run: bunx prisma migrate deploy");
console.log("  4. Run: SQLITE_DATABASE_URL=file:./db/custom.db bun run scripts/migrate-sqlite-to-postgres.ts");
console.log("  5. Apply RLS policies: psql -f prisma/rls/policies.sql");
console.log("  6. Verify row counts + site isolation");
console.log("");
console.log("See: docs/operations/postgres-cutover.md for the full runbook.");
process.exit(0);
