import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import path from "node:path";

// CRITICAL: set DATABASE_URL to the test DB BEFORE any test file imports @/lib/db.
// @/lib/db uses a global singleton (globalForPrisma.prisma) created at module-load time.
// If this env var isn't set before that import, the singleton connects to the dev DB (db/custom.db)
// instead of the test DB (db/test.db), causing service-layer writes (audit, etc.) to go to the wrong DB.
// test-db.ts also sets this inside getTestDb(), but that runs in beforeAll — too late for @/lib/db's import.
process.env.DATABASE_URL = `file:${path.join(process.cwd(), "db", "test.db")}`;

// MSW server setup for API mocking in unit/integration tests.
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
