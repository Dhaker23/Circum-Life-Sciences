#!/usr/bin/env bun
// Phase 13 D3: SQLite backup script.
// WAL checkpoint + file copy to a timestamped backup file.
// Usage: bun run scripts/backup-sqlite.ts [output-dir]
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") ?? "./db/custom.db";
const OUTPUT_DIR = process.argv[2] ?? "./backups";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUTPUT_PATH = join(OUTPUT_DIR, `sqlite-${TIMESTAMP}.db`);

if (!existsSync(DB_PATH)) {
  console.error(`ERROR: Database file not found: ${DB_PATH}`);
  process.exit(1);
}

mkdirSync(OUTPUT_DIR, { recursive: true });

// WAL checkpoint (flush WAL to main DB file)
try {
  execSync(`bunx prisma db execute --stdin <<< "PRAGMA wal_checkpoint(TRUNCATE);"`, { stdio: "pipe" });
  console.log("✓ WAL checkpoint completed");
} catch {
  console.warn("⚠ WAL checkpoint failed (continuing with file copy)");
}

// File copy
copyFileSync(DB_PATH, OUTPUT_PATH);
console.log(`✓ Backup created: ${OUTPUT_PATH}`);
console.log(`  Size: ${(statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);
