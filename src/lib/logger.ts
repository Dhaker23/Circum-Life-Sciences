// Phase 13 D4: Structured logging with pino.
// CRITICAL: Logs must NEVER contain passwords, API keys, encryption keys,
// authentication tokens, integration credentials, or unnecessary sensitive data.
// This logger auto-redacts known sensitive field names.

import pino from "pino";

const redactPaths = [
  "password",
  "passwordHash",
  "credentials",
  "credentialsIv",
  "apiKey",
  "api_key",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "AUTH_PEPPER",
  "NEXTAUTH_SECRET",
  "INTEGRATION_ENCRYPTION_KEY",
  "DATABASE_URL",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.credentials",
  "*.token",
  "*.secret",
  "*.apiKey",
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: redactPaths,
    censor: "***REDACTED***",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: { app: "circum", env: process.env.NODE_ENV ?? "development" },
});

// Helper for request logging
export function logRequest(method: string, path: string, status: number, durationMs: number, userId?: string) {
  logger.info({ method, path, status, durationMs, userId }, "request");
}

// Helper for error logging (no secrets — pino redacts automatically)
export function logError(error: unknown, context?: Record<string, unknown>) {
  if (error instanceof Error) {
    logger.error({ err: { message: error.message, name: error.name, stack: error.stack }, ...context }, "error");
  } else {
    logger.error({ error, ...context }, "error");
  }
}
