#!/usr/bin/env bun
// Phase 13 D3: Restore script (interactive; prompts for confirmation).
// Usage: bun run scripts/restore.ts <backup-file>
import { copyFileSync, existsSync, statSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const BACKUP_FILE = process.argv[2];
if (!BACKUP_FILE) {
  console.error("ERROR: Usage: bun run scripts/restore.ts <backup-file>");
  process.exit(1);
}
if (!existsSync(BACKUP_FILE)) {
  console.error(`ERROR: Backup file not found: ${BACKUP_FILE}`);
  process.exit(1);
}

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") ?? "./db/custom.db";
const isPostgres = process.env.DATABASE_URL?.startsWith("postgresql");

const rl = createInterface({ input: stdin, output: stdout });
console.log(`⚠ WARNING: This will OVERWRITE the current database.`);
console.log(`  Backup file: ${BACKUP_FILE} (${(statSync(BACKUP_FILE).size / 1024).toFixed(1)} KB)`);
console.log(`  Target: ${DB_PATH}`);
const answer = await rl.question("Type 'CONFIRM' to proceed: ");
rl.close();

if (answer !== "CONFIRM") {
  console.log("Restore cancelled.");
  process.exit(0);
}

if (isPostgres) {
  const { execSync } = await import("node:child_process");
  try {
    execSync(`pg_restore --clean --if-exists --dbname="${process.env.DATABASE_URL}" "${BACKUP_FILE}"`, { stdio: "inherit" });
    console.log("✓ PostgreSQL restore completed");
  } catch (e) {
    console.error("ERROR: pg_restore failed.");
    process.exit(1);
  }
} else {
  copyFileSync(BACKUP_FILE, DB_PATH);
  console.log("✓ SQLite restore completed");
}

// Verify
console.log("Verifying restore...");
const { execSync } = await import("node:child_process");
try {
  const count = execSync(`bunx prisma db execute --stdin <<< "SELECT COUNT(*) as c FROM User;" --url "${process.env.DATABASE_URL}"`, { encoding: "utf-8" });
  console.log(`✓ Verification: User table accessible`);
} catch {
  console.warn("⚠ Verification: could not verify tables (may need prisma generate)");
}
