# ADR-0005: Audit Immutability via Database Triggers

- **Status:** Accepted (Phase 1)
- **Date:** Phase 1
- **Deciders:** Circum project owner
- **Supersedes:** (none)
- **Related:** ADR-0002 (SQLite to PostgreSQL migration), ADR-0003 (sessions, sessionId link), ADR-0004 (`authorization.denied`), `docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md` §9

## Context

PRD §10 (Security and Data Integrity) and §13 (Audit) require that the audit trail be **immutable**: "normal users cannot edit/delete audit history." An audit trail that can be silently mutated, even by a privileged user or a future buggy code path, fails the regulatory intent. The Phase 1 plan §9 specifies an `AuditEvent` table and a repository that exposes only `create()` and `read()`. Application-level enforcement alone is not enough: a future buggy service method, a `prisma.executeRaw` call, a migration script, or direct DB access (DBA, backup restore) could mutate audit rows without the application noticing. The database itself must refuse the mutation.

On SQLite (the Phase 1 database, ADR-0002), row-level immutability is achievable via `BEFORE UPDATE` and `BEFORE DELETE` triggers that call `RAISE(ABORT)`. SQLite supports this in the standard distribution.

## Decision

1. **`AuditEvent` is append-only.** The `AuditEventRepository` interface exposes only `create()` and `read()` (plus read helpers: `list`, `count`, `export`). There are **no** `update()` or `delete()` methods. This is a code-level invariant enforced by the interface shape and by code review.

2. **Database-level enforcement (SQLite, Phase 1).** Create two triggers that abort any mutation:

   ```sql
   CREATE TRIGGER audit_no_update
   BEFORE UPDATE ON AuditEvent
   BEGIN
     SELECT RAISE(ABORT, 'AuditEvent is append-only: UPDATE rejected');
   END;

   CREATE TRIGGER audit_no_delete
   BEFORE DELETE ON AuditEvent
   BEGIN
     SELECT RAISE(ABORT, 'AuditEvent is append-only: DELETE rejected');
   END;
   ```

   These prevent **any** `UPDATE` or `DELETE` on `AuditEvent`, including via raw SQL, a `prisma.executeRaw` call, or a future buggy code path. Covered by test T-AUDIT-01 (a direct `DELETE FROM AuditEvent` is rejected by the trigger).

3. **PostgreSQL equivalent** (when PG lands, ADR-0002): create a function that raises an exception and bind it to `BEFORE UPDATE` and `BEFORE DELETE` triggers, for example:

   ```sql
   CREATE OR REPLACE FUNCTION raise_audit_immutable() RETURNS trigger AS $$
   BEGIN
     RAISE EXCEPTION 'AuditEvent is append-only: % rejected', TG_OP;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER audit_no_update BEFORE UPDATE ON "AuditEvent"
     FOR EACH ROW EXECUTE FUNCTION raise_audit_immutable();
   CREATE TRIGGER audit_no_delete BEFORE DELETE ON "AuditEvent"
     FOR EACH ROW EXECUTE FUNCTION raise_audit_immutable();
   ```

   As an additional defense-in-depth on PostgreSQL, `REVOKE UPDATE, DELETE ON "AuditEvent" FROM <app_role>`. The SQLite trigger SQL is authored to be trivially portable; the migration that creates `AuditEvent` creates the triggers, and a test asserts they exist and function after every migration.

4. **Purge/archival carve-out.** Only a documented, audited **purge or archival** operation may touch historical rows, and only per the Phase 13 retention policy. In Phase 1 this is **not exposed as an API**. When it ships, it will be a one-off, versioned script (run by an operator, not by the application runtime) that, within a single transaction: (a) disables the triggers, (b) deletes or archives only rows older than the retention threshold, (c) re-enables the triggers, and (d) writes its own `AuditEvent` recording the purge (`actor = system`, `action = "audit.purge"`, `reason = retention policy reference`, `previousState`/`newState` = summary counts of rows affected). The script is reviewed and approved per the change-control process. There is no application code path that performs this; it is operator-initiated only.

5. **`AuditEvent` fields per PRD §13:** `actorUserId` (nullable; `ON DELETE SET NULL` so audit outlives user deletion), `action`, `entityType`, `entityId`, `previousState` (Json, snapshot before), `newState` (Json, snapshot after), `reason` (free text; required for sensitive actions and for denials), `outcome` (`SUCCESS` | `FAILURE` | `DENIED`), `sessionId` (nullable; links to the `Session` row, ADR-0003), `ipAddress`, `userAgent`, `occurredAt` (indexed). Indexed on `(occurredAt)`, `(actorUserId)`, `(entityType, entityId)`, `(action)`.

6. **Capture points (Phase 1):** `identity.session.signin` (success and failure), `identity.session.signout`; `identity.user.create`/`update`/`disable`/`reset-password`; `identity.role.create`/`update`/`assign-permission`; `identity.assignment.create`/`delete`; `org.site.create`/`update`/`deactivate`; `org.department.create`/`update`/`deactivate`; `authorization.denied` (every `can()` failure, ADR-0004). Every sensitive state transition writes both `previousState` and `newState`.

7. **Read access:** `audit.read` permission (Auditor, Quality Manager, Super Administrator, and other read-only roles per the matrix). Queryable by actor, entity, action, and time range. `audit.export` produces a CSV (Phase 1: basic sequential numbering; Phase 13 adds per-row hashes for tamper-evidence).

## Alternatives considered

- **App-only enforcement** (repository interface shape, no DB triggers): rejected. A future buggy service method, a `prisma.executeRaw` call, or direct DB access (DBA, migration script, backup restore) could mutate audit rows without the application noticing. The trigger makes the DB itself refuse the mutation, regardless of the caller.
- **Soft-delete flag** (`isDeleted` on `AuditEvent`): rejected. A soft delete is still a mutation of the row (an `UPDATE`), which is exactly what this ADR forbids. It also leaves the "deleted" row present, which is not the same as immutability of the recorded event.
- **Separate append-only store** (e.g. a write-once log file or an event store): rejected for Phase 1. It adds operational complexity (a second datastore, a separate backup and restore story, a separate query story) for no marginal benefit over a triggered table. The `AuditEvent` table is already queryable, indexed, and transactional with the rest of the schema. Reserved as a future option if throughput or tamper-evidence requirements grow (Phase 13).
- **`REVOKE`-only on PostgreSQL** (GRANT/REVOKE, no triggers): viable on PostgreSQL but not portable to SQLite (no equivalent table-level REVOKE). Triggers work on both, so triggers are the portable choice. `REVOKE` can be added as defense-in-depth when PostgreSQL lands.

## Consequences

- **Positive:** regulatory-grade immutability. Even a Super Administrator cannot silently edit or delete an audit row through the application; only the documented purge script can, and it leaves its own audit trail. Audit outlives user deletion (`actorUserId` `ON DELETE SET NULL`: the event remains, the actor becomes null). Covered by tests T-AUDIT-01 (`DELETE` rejected by trigger) and T-AUDIT-02 (a denied `can()` emits an `authorization.denied` event).
- **Negative / cost:** the purge/archival script must manage trigger disable and re-enable within a transaction. This is a documented, reviewed operation, not an everyday path. Migration risk: the triggers must be created in the migration that creates `AuditEvent`, and re-created if the table is ever rebuilt. A test asserts the triggers exist and function after every migration.
- **Risk:** a migration that drops and recreates `AuditEvent` would lose both data and triggers. Mitigated by: migrations never `DROP AuditEvent`; the purge script is the only sanctioned mutation path; backup and restore procedures preserve triggers (standard for SQLite and PostgreSQL).
- **Reversibility:** low. Immutability is a one-way door: once audit rows are append-only, removing that guarantee is itself a compliance-relevant change requiring owner approval.

## Compliance note

This ADR records an immutability engineering control (an append-only table, plus database triggers, plus a repository interface that exposes no mutation methods). It is not a claim of full FDA 21 CFR Part 11 compliance. Part 11 compliance depends on intended use, validated configuration, procedures, infrastructure, and evidence (PRD §17).
