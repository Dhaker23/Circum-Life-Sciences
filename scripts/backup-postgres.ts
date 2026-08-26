#!/usr/bin/env bun
// Phase 13 D3: PostgreSQL backup script.
// Uses pg_dump with custom format. Requires DATABASE_URL pointing to PostgreSQL.
// Usage: bun run scripts/backup-postgres.ts [output-dir]
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || !DATABASE_URL.startsWith("postgresql")) {
  console.error("ERROR: DATABASE_URL must be a PostgreSQL connection string");
  process.exit(1);
}

const OUTPUT_DIR = process.argv[2] ?? "./backups";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTPUT_PATH = join(OUTPUT_DIR, `postgres-${TIMESTAMP}.dump`);

mkdirSync(OUTPUT_DIR, { recursive: true });

try {
  execSync(`pg_dump --format=custom --file="${OUTPUT_PATH}" "${DATABASE_URL}"`, { stdio: "inherit" });
  console.log(`✓ PostgreSQL backup created: ${OUTPUT_PATH}`);
} catch {
  console.error("ERROR: pg_dump failed. Is PostgreSQL available and pg_dump installed?");
  process.exit(1);
}
