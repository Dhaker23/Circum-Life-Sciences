// In-memory account lockout + rate limiting (ADR-0003). Local-first (no Redis, PRD §12).
// Lockout: 5 failed attempts lock the account for 15 minutes.
// Rate limit: token bucket per IP+email on the sign-in route.

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Account lockout state is persisted on the User row (failedAttempts, lockedUntil) by the auth service.
// This module exposes the policy constants + helpers.

export const LOCKOUT_POLICY = {
  maxFailedAttempts: MAX_FAILED_ATTEMPTS,
  lockDurationMs: LOCK_DURATION_MS,
} as const;

export function isLocked(lockedUntil: Date | null): boolean {
  return !!lockedUntil && lockedUntil.getTime() > Date.now();
}

export function shouldLock(failedAttempts: number): boolean {
  return failedAttempts >= MAX_FAILED_ATTEMPTS;
}

export function nextLockUntil(): Date {
  return new Date(Date.now() + LOCK_DURATION_MS);
}

// --- In-memory token-bucket rate limiter (per key, e.g. IP+email) ---
interface Bucket {
  tokens: number;
  lastRefill: number;
}
const RATE_LIMIT_CAPACITY = 10; // 10 sign-in attempts per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // per minute
const REFILL_PER_MS = RATE_LIMIT_CAPACITY / RATE_LIMIT_WINDOW_MS;
const buckets = new Map<string, Bucket>();

export function rateLimitCheck(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: RATE_LIMIT_CAPACITY - 1, lastRefill: now };
    buckets.set(key, b);
    return { allowed: true, retryAfterMs: 0 };
  }
  const elapsed = now - b.lastRefill;
  b.tokens = Math.min(RATE_LIMIT_CAPACITY, b.tokens + elapsed * REFILL_PER_MS);
  b.lastRefill = now;
  if (b.tokens < 1) {
    const retryAfterMs = Math.ceil((1 - b.tokens) / REFILL_PER_MS);
    return { allowed: false, retryAfterMs };
  }
  b.tokens -= 1;
  return { allowed: true, retryAfterMs: 0 };
}

// Test helper: clear rate-limit state.
export function __resetRateLimit(): void {
  buckets.clear();
}
