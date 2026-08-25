# ADR-0004: RBAC Assignment Scoping Model

- **Status:** Accepted (Phase 1)
- **Date:** Phase 1
- **Deciders:** Circum project owner
- **Supersedes:** (none)
- **Related:** ADR-0003 (sessions), `docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md` §6, `docs/architecture/rbac-matrix.md`

## Context

PRD §3 requires least-privilege RBAC with site, department, and module scoping, and enumerates the configurable roles (Super Administrator, Site Administrator, Plant Manager, Production Manager, Production Planner, Shift Supervisor, Operator, Quality Manager, QA Reviewer/Approver, Quality Engineer, Laboratory Technician, Validation Engineer, Maintenance Manager, Maintenance Technician, Calibration Technician, Warehouse/Logistics Manager, Lean Manager, Auditor, Executive Viewer). PRD §11 mandates that authorization logic live "not only in the UI": every sensitive action must be enforceable at the server. The platform is multi-site (CH/FR/TN footprint, PRD §2), so a role like "Quality Manager" must be expressible as "Quality Manager at Site A only", without duplicating the role definition per site.

## Decision

1. **Permission keys are namespaced** `<module>.<resource>.<action>` (e.g. `identity.user.create`, `quality.ncr.approve`, `org.site.deactivate`). Permissions are stored as a system-defined catalog (`Permission` rows, `isSystem: true`). They are not user-editable at runtime; they are extended only via migrations as new modules ship.

2. **The PRD §3 roles are seeded** as `Role` rows with `isSystem: true`. Each role receives a default grant per `docs/architecture/rbac-matrix.md`. Grants are configurable post-seed by a Super Administrator (or by a Site Administrator within their site, for non-global roles), via an audited configuration change.

3. **`Assignment` is the unit of least-privilege.** An Assignment binds a User to a Role within a Scope `{ siteId?, departmentId?, moduleScope? }`. A user may hold multiple assignments; their effective permissions are the union over active assignments. This lets one user be "QA at Site A" and "Lab Tech at Site B" without ambiguity, and keeps the audit of "who could do what, where" precise. A User is never directly attached to a Site or Department; the Assignment is the only binding.

4. **An assignment is active only when** `status = ACTIVE` and `now` is within `[validFrom, validUntil]` (`validUntil` is nullable, meaning open-ended). Inactive or expired assignments contribute nothing to the resolved permission set.

5. **Three-layer enforcement** (defense in depth, PRD §11):
   - **Layer 1, UI:** show, hide, enable, or disable actions based on `AuthContext.permissions`. This is a usability aid only and is **explicitly not authorization**. A hidden action that is invoked directly must still be rejected by layers 2 and 3.
   - **Layer 2, API/middleware:** `middleware.ts` and a per-route `requirePermission(perm, scope)` guard reject unauthorized requests before the handler runs (early reject, HTTP 403).
   - **Layer 3, service/domain:** every use-case re-checks `can(perm, scope, target)` authoritatively, including the site/department scope against the target entity. This is the authoritative check; layer 2 is convenience plus early rejection.

6. **`can(permission, scope, target?)` semantics:**
   - Resolved permissions = the union of permissions over the user's active assignments (`status = ACTIVE`, within `validFrom`/`validUntil`).
   - For a site-scoped target, the matching assignment must have `siteId IS NULL` (global scope, Super Admin only, guarded per point 7) **or** `siteId = target.siteId`. A non-null `departmentId` narrows further: the assignment's department must match the target's department.
   - On any denial, emit an `AuditEvent(action = "authorization.denied")` with actor, attempted action, target, `ipAddress`, and `sessionId` (covered by test T-AUDIT-02).

7. **Super-admin global-scope guard:** an Assignment with `siteId IS NULL` requires the user to hold the `super_admin` role. This is enforced at assignment-create time: the assignment service refuses to create a global-scope assignment for a non-super-admin user. Global-scope assignment creation is itself audited. This prevents accidental global-scope grants.

8. **Default seeded grants are intentionally narrow** (least privilege). No role starts with destructive or global permissions it does not need. In particular: Auditor is read-only across identity, org, and audit (no writes anywhere); Executive Viewer is dashboards and aggregate only; Operator can read only their own profile. There are **no broad admin grants for developer convenience** (owner constraint).

9. **Multi-site isolation:** the repository layer appends `WHERE siteId IN (resolvedSites)` (or the equivalent join) to every site-scoped query (PRD §10/§11, ADR-0002). `resolvedSites = "*"` (all sites, Super Admin) or an explicit list. Cross-site data leakage is a **critical defect** (covered by test T-ISOL-01).

## Alternatives considered

- **Role-only without scope** (a user "has a role" globally): rejected. Cannot express "QA at Site A only". Forces either over-granting (QA everywhere) or duplicating role definitions per site (role explosion, unmaintainable).
- **Permissions directly on the user** (no role aggregation): rejected. No least-privilege aggregation; every grant is per-user, so reviewing "who can do X" requires scanning every user. Error-prone and the opposite of least privilege.
- **ABAC (attribute-based) instead of RBAC:** rejected for Phase 1. RBAC with scope is sufficient for PRD §3 and is far simpler to audit. ABAC may be layered later for fine-grained rules without changing the Assignment model.
- **Single-layer enforcement** (UI only, or API only): rejected. PRD §11 explicitly requires logic not only in the UI. A single server layer is fragile: a new endpoint that forgets the guard is a hole. The three-layer model makes the service layer the authoritative check, so even a missing UI hint or a missing API guard cannot authorize an action the service refuses.

## Consequences

- **Positive:** precise site, department, and module scoping; an auditable "who could do what, where" record; a multi-site isolation foundation; extensibility to new modules (`production.*`, `quality.*`, etc.) by adding permission keys and grants without changing the model.
- **Negative / cost:** three checks per sensitive action (UI, API, service). The CPU cost is small and is dominated by the DB read for `AuthContext` (cached, see ADR-0003). The real cost is developer discipline: every new endpoint and service method must call `can()` and pass the target's site and department. Mitigated by a lint/test rule and code review.
- **The default matrix** (`docs/architecture/rbac-matrix.md`) is the seed; deviations from it require an audited configuration change.
- **Reversibility:** high for the grant set (re-seedable); medium for the model (the Assignment and Scope are foundational; changing them later would require a migration of all assignments).

## Compliance note

This ADR records an authorization-model decision and engineering controls (layered enforcement, scope, denial auditing). It is not a claim of ISO 13485, FDA 21 CFR Part 11, or Part 820 compliance. Compliance depends on intended use, validated configuration, procedures, and evidence (PRD §17).
