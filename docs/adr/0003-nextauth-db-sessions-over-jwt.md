# ADR-0003: NextAuth Sessions with DB-Backed Revocation (JWT+DB Hybrid)

- **Status:** Accepted (Phase 1) — implementation note added after build
- **Date:** Phase 1
- **Deciders:** Circum project owner
- **Supersedes:** (none)
- **Related:** ADR-0002 (SQLite to PostgreSQL migration), `docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md` §5

## Implementation deviation (post-build note)

The original decision called for `strategy: "database"`. During implementation, next-auth v4 raised `UnsupportedStrategyError: Signin in with credentials only supported if JWT strategy is enabled`. This is a hard constraint of next-auth v4: the Credentials provider cannot use database sessions (it has no way to persist a session-linked account on credentials sign-in).

**Resolution (hybrid JWT + DB):** `strategy: "jwt"` is used for transport, but a `Session` DB row is created on every successful sign-in and the `session()` callback validates the JWT's session token against the DB `Session` row on **every** request. This preserves the two non-negotiable requirements:

1. **Revocable:** deleting the `Session` row (admin offboarding, sign-out) invalidates the next request (the `session()` callback returns an empty session).
2. **Auditable:** every sign-in creates an audited `Session` row linked to the actor; `signOut` deletes it.

The trade-off is one DB read per request (the `session()` callback DB lookup). This is the same cost as pure database sessions, so the hybrid is not more expensive. The in-memory session cache originally proposed is deferred to Phase 13 (acceptable on LAN-scale load). This deviation does not weaken any security, revocation, or audit property.

## Context

Circum is a regulated medical-device platform. PRD §10 (Security and Data Integrity) and §13 (Audit) require that user sessions be **revocable** and **auditable**: every sensitive action must link to an actor and a session, and an administrator must be able to forcibly terminate a session without waiting for a token to expire. next-auth v4 (already installed) supports two session strategies: a stateless JWT (signed and carried in a cookie), or database-backed sessions (one row per active session, via `@next-auth/prisma-adapter`).

A stateless JWT cannot be revoked without a server-side blocklist, and a blocklist reintroduces a DB read per request, which defeats the purpose of going stateless. For a medical-device QMS this trade-off is unacceptable: revocation and a strong audit link from session to actor are requirements, not nice-to-haves.

## Decision

Use **database sessions**. Specifically:

1. next-auth v4 with `strategy: "database"` and `adapter: PrismaAdapter`. The next-auth Prisma models (`Session`, `Account`, `VerificationToken`, plus `User`) are part of the Phase 1 Prisma schema.
2. The session token is an **opaque random value** (cryptographically strong, e.g. `crypto.randomUUID` plus entropy, stored hashed in the `Session` row), set in an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie. It is **not** a JWT and carries no claims.
3. `maxAge: 8h` (one factory shift), `updateAge: 1h`. Expired rows are reaped by a documented manual/CLI job in Phase 1; Phase 13 adds a scheduled reaper. Sign-out deletes the `Session` row immediately (instant revocation) and emits an `AuditEvent(action = "identity.session.signout")`.
4. Admin-forced revocation (compromised session, ex-employee offboarding) is a single `DELETE` on the `Session` row, audited. No token blocklist, no waiting for expiry.
5. Every authenticated request reads the `Session` row (joined to `User`) to build the `AuthContext`. This DB read is mitigated by a short-lived **in-memory LRU session cache** (TTL approximately 30s, keyed by the hashed session token). PRD §11 permits local memory caching. The cache is invalidated on sign-out; TTL bounds staleness for forced revocation across processes.
6. **Provider:** `CredentialsProvider` only in Phase 1 (local-first, PRD §12). Username = email; password verified against `User.passwordHash` (argon2id, parameters per OWASP: `m = 64MiB`, `t = 3`, `p = 4`) with a server-side **pepper** from the `AUTH_PEPPER` env var, applied before hashing. The pepper is never logged, never committed, never returned to the client.
7. **Lockout and rate-limiting:** increment `User.failedAttempts` on a bad password; at 5 failures set `lockedUntil = now + 15min`. The sign-in API is also rate-limited per IP and email (in-memory token bucket; local-first, no Redis). Covered by test T-LOCK-01.
8. **Sign-in audit:** every sign-in attempt, success **and** failure, emits an `AuditEvent(action = "identity.session.signin")` with `outcome`, `ipAddress`, `userAgent`, and `sessionId` (null on a failed attempt, since no session was created).
9. An OIDC or external IdP provider is **reserved** for future optional SSO (post-Phase 1), layered on top of the local Credentials provider. It is not enabled in Phase 1 because it would break the local-first guarantee (PRD §12): authentication must work on the factory LAN without Internet.

## Alternatives considered

- **JWT sessions** (`strategy: "jwt"`): rejected. Stateless tokens cannot be revoked without a server-side blocklist, which reintroduces a per-request DB read and negates the benefit of going stateless. The audit link is weaker: there is no session row, so "which session performed this action" must be reconstructed from token claims, and a stolen or leaked token remains valid until its expiry. Unacceptable for a regulated medical-device platform.
- **External IdP / OIDC now** (e.g. Keycloak, Auth0): rejected for Phase 1. Breaks the local-first guarantee (PRD §12): core factory workflows must run on the LAN without Internet, and authentication must not depend on a cloud IdP. Reserved for future optional SSO.
- **Custom session table without next-auth:** rejected. next-auth v4 is already installed and handles CSRF, cookie management, and provider abstraction for its own routes. Reimplementing security-critical session code invites bugs in exactly the area where bugs are most costly.

## Consequences

- **Positive:** revocable sessions (delete the row, the user is logged out everywhere); a strong audit link (`Session.id` and `actorUserId` on every `AuditEvent`); forced logout of a compromised or offboarded user is a single audited DB delete; session metadata (`ipAddress`, `userAgent`, `issuedAt`, `expires`) is queryable for security review.
- **Negative / cost:** one DB read per authenticated request. Mitigated by the in-memory cache (TTL-bounded, invalidated on sign-out). On SQLite in WAL mode at LAN scale this is acceptable. The cache is per-process, so in a multi-process deployment revocation staleness is bounded by the TTL (approximately 30s), which is acceptable for Phase 1. Phase 13 may introduce a shared cache (Redis) if multi-process deployments arise.
- **Schema impact:** requires the next-auth Prisma models (`Session`, `Account`, `VerificationToken`, `User`). These are part of the Phase 1 Prisma schema.
- **Risk:** cache staleness on forced revocation across processes. Mitigated by short TTL, sign-out invalidation, and forced revocation also deleting the row (so the next cache miss reads a missing row and clears the session). Documented and tested.
- **Reversibility:** medium. Switching to JWT later would require re-issuing all sessions and would forfeit revocation and the audit link. Not planned.

## Compliance note

This ADR records an infrastructure and session-management decision. It is an engineering control supporting auditability and revocation, not a claim of FDA 21 CFR Part 11 or ISO 13485 compliance. Compliance depends on intended use, validated configuration, procedures, infrastructure, and evidence (PRD §17).
