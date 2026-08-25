// Test helpers: isolated test database + seed. Each test run uses a fresh in-memory/file DB.
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.join(process.cwd(), "db", "test.db");
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

let _db: PrismaClient | null = null;

export function getTestDb(): PrismaClient {
  if (!_db) {
    process.env.DATABASE_URL = TEST_DB_URL;
    _db = new PrismaClient();
  }
  return _db;
}

// Reset the test DB: drop + recreate schema + audit triggers. Run before each test suite.
export async function resetTestDb(): Promise<PrismaClient> {
  const db = getTestDb();
  await db.$disconnect();
  rmSync(TEST_DB_PATH, { force: true });
  rmSync(`${TEST_DB_PATH}-journal`, { force: true });
  rmSync(`${TEST_DB_PATH}-wal`, { force: true });
  rmSync(`${TEST_DB_PATH}-shm`, { force: true });
  // Apply the migration SQL (includes audit triggers).
  execSync(`DATABASE_URL="${TEST_DB_URL}" bunx prisma migrate deploy`, { stdio: "pipe" });
  await db.$connect();
  return db;
}

export async function disconnectTestDb(): Promise<void> {
  if (_db) {
    await _db.$disconnect();
    _db = null;
  }
}
