# Circum RBAC Permission Matrix (Phase 1 Defaults)

> **Status:** Phase 1 default seed. Configurable post-seed by a Super Administrator (or by a Site Administrator within their site, for non-global roles) via an audited configuration change.
> **Related:** ADR-0004 (RBAC assignment scoping model), `docs/PRD/PHASE-1-IMPLEMENTATION-PLAN.md` §6, `DOMAIN_GLOSSARY.md` §1.
> **Scope of this document:** the identity, organization, audit, and session permission groups required by Phase 1 itself. Later phases add their own module permissions (`production.*`, `quality.*`, `equipment.*`, `validation.*`, `cleanroom.*`, `lab.*`, `lean.*`, etc.) without changing this matrix's structure or the model in ADR-0004.

## 1. How to read this matrix

- **Rows** = the configurable roles seeded in Phase 1 (`Role.isSystem = true`), per PRD §3 and `DOMAIN_GLOSSARY.md` §1.
- **Columns** = permission groups. Each group contains one or more permission keys of the form `<module>.<resource>.<action>` (ADR-0004). The action tokens granted to a role are listed in the cell.
- **Cells** = the actions granted to that role by default. `—` means no permission in that group.
- **Scope qualifiers** in parentheses (e.g. `(own site)`, `(self only)`, `(operators)`) describe the typical seeded assignment scope for that role. Per ADR-0004, scope is carried by the **Assignment** (`siteId?`, `departmentId?`, `moduleScope?`), not by the role. A role's permissions are scoped by each assignment a user holds; the qualifiers here document the expected default assignment shape, not a property of the role itself.
- **Least privilege** (owner constraint): no role starts with destructive or global permissions it does not need. There are **no broad admin grants for developer convenience**. The Super Administrator is the only global-scope role, and global-scope assignment is guarded at assignment-create (ADR-0004 point 7).

### Action token legend

| Token | Meaning | Typical permission key |
|---|---|---|
| R | read | `identity.user.read`, `org.site.read`, `audit.read`, etc. |
| C | create | `identity.user.create`, `org.site.create`, etc. |
| U | update | `identity.user.update`, `org.site.update`, etc. |
| D | delete | `identity.assignment.delete`, `identity.role.delete` |
| A | approve | (reserved for quality/workflow approvals in later phases) |
| X | export | `audit.export` |
| dis | disable a user | `identity.user.disable` |
| rp | reset a user's password | `identity.user.reset-password` |
| ap | assign a permission to a role | `identity.role.assign-permission` |
| deact | deactivate a site or department | `org.site.deactivate`, `org.department.deactivate` |
| rev | force-revoke another user's session | `session.revoke` |
| — | no permission in this group | |

### Permission groups and their keys (Phase 1 seed)

| Group | Permission keys seeded |
|---|---|
| `identity.users` | `identity.user.read`, `identity.user.create`, `identity.user.update`, `identity.user.disable`, `identity.user.reset-password`, `identity.user.delete` |
| `identity.roles` | `identity.role.read`, `identity.role.create`, `identity.role.update`, `identity.role.assign-permission`, `identity.role.delete` |
| `identity.assignments` | `identity.assignment.read`, `identity.assignment.create`, `identity.assignment.delete` |
| `org.sites` | `org.site.read`, `org.site.create`, `org.site.update`, `org.site.deactivate` |
| `org.departments` | `org.department.read`, `org.department.create`, `org.department.update`, `org.department.deactivate` |
| `audit` | `audit.read`, `audit.export` |
| `session` | `session.sign-in`, `session.sign-out`, `session.revoke`, `session.read` (admin view of active sessions) |

Every authenticated user can sign themselves in and out (`session.sign-in`, `session.sign-out`); those keys are not listed per role below because they are self-scoped, not admin-granted. The `session` column below covers admin management of other users' sessions (`session.read`, `session.revoke`).

## 2. Default permission matrix

| # | Role | identity.users | identity.roles | identity.assignments | org.sites | org.departments | audit | session |
|---|---|---|---|---|---|---|---|---|
| 1 | Super Administrator | R, C, U, D, dis, rp | R, C, U, D, ap | R, C, D | R, C, U, deact | R, C, U, deact | R, X | R, rev |
| 2 | Site Administrator | R, C, U, dis | — | R, C, D | R | R, C, U, deact | R | R, rev (own site) |
| 3 | Plant Manager | R (own site) | R | R (own site) | R (own site) | R (own site) | R (own site) | — |
| 4 | Production Manager | R (operators, own site) | — | — | R (own site) | R (own site) | — | — |
| 5 | Production Planner | R (limited, own site) | — | — | R (own site) | R (own site) | — | — |
| 6 | Shift Supervisor | R (operators, own dept) | — | — | — | R (own dept) | — | — |
| 7 | Operator | R (self only) | — | — | — | — | — | — |
| 8 | Quality Manager | R (own site) | R | R (own site) | R (own site) | R (own site) | R, X | — |
| 9 | QA Reviewer / Approver | R (own site) | R | R (own site) | R (own site) | R (own site) | R | — |
| 10 | Quality Engineer | R (own site) | R | R (own site) | R (own site) | R (own site) | R | — |
| 11 | Laboratory Technician | R (self only) | — | — | R (own site) | R (own site) | — | — |
| 12 | Validation Engineer | — | — | — | R (own site) | R (own site) | R | — |
| 13 | Maintenance Manager | R (maint techs, own site) | — | — | R (own site) | R (own site) | — | — |
| 14 | Maintenance Technician | R (self only) | — | — | — | — | — | — |
| 15 | Calibration Technician | R (self only) | — | — | — | — | — | — |
| 16 | Warehouse / Logistics Manager | R (warehouse staff, own site) | — | — | R (own site) | R (own site) | — | — |
| 17 | Lean Manager | — | — | — | R (own site) | R (own site) | R | — |
| 18 | Auditor | R | R | R | R | R | R, X | — |
| 19 | Executive Viewer | — | — | — | — | — | — | — |

### Notes on individual roles

- **Super Administrator (1):** the only global-scope role. `siteId IS NULL` assignments require the `super_admin` role, enforced at assignment-create (ADR-0004 point 7). Granted all actions across all Phase 1 groups. Audit delete is **not** granted to anyone (audit is append-only by trigger, ADR-0005); the Super Administrator can read and export audit but cannot delete rows through the application.
- **Site Administrator (2):** manages users, assignments, and departments **within their own site**. Cannot manage roles, cannot create or deactivate sites, cannot delete users, cannot reset passwords (escalate to Super Admin), cannot export audit, cannot act globally. `identity.assignments` create/delete is scoped to non-global roles within their own site (a Site Administrator cannot create a global-scope assignment).
- **Plant Manager (3):** read-only visibility across identity, org, and audit **within their own site**. No creates, updates, or deletes. Oversight role.
- **Production Manager (4):** reads operators and org structure **within their own site**. No audit access (production oversight, not compliance). No identity writes.
- **Production Planner (5):** reads org and a limited identity view (e.g. operator availability for planning) **within their own site**. No audit.
- **Shift Supervisor (6):** reads operators and their own department only. No site-wide reads, no audit.
- **Operator (7):** reads their own profile only. Nothing else. This is the shop-floor default.
- **Quality Manager (8):** reads identity and org **within their own site**, plus `audit.read` and `audit.export`. No identity writes (separation of duties: QA does not create users). Audit export supports regulatory review.
- **QA Reviewer / Approver (9):** reads identity, org, and audit **within their own site**. No writes, no export. Reviewer role for quality records (the `approve` action on quality records ships in a later phase, not in this matrix).
- **Quality Engineer (10):** same Phase 1 footprint as QA Reviewer / Approver. Differentiates in later phases (e.g. `quality.ncr.create`, `quality.deviation.update`).
- **Laboratory Technician (11):** reads their own profile and org structure. No audit. Lab sample/test permissions ship in a later phase.
- **Validation Engineer (12):** reads org and audit. No identity reads (validation works on equipment and processes, not user accounts). Validation protocol permissions ship in a later phase.
- **Maintenance Manager (13):** reads maintenance technicians and org. No audit. Equipment and calibration permissions ship in a later phase.
- **Maintenance Technician (14):** reads their own profile only.
- **Calibration Technician (15):** reads their own profile only.
- **Warehouse / Logistics Manager (16):** reads warehouse staff and org. No audit. Material lot and inventory permissions ship in a later phase.
- **Lean Manager (17):** reads org and audit (for OEE/VSM visibility and trend review). No identity reads. Lean module permissions ship in a later phase.
- **Auditor (18):** read-only across identity, org, and audit, plus `audit.export`. **No writes anywhere.** This is the internal/external auditor role; it must be able to inspect everything and change nothing. A denied write attempt by an Auditor emits `authorization.denied` (ADR-0004 point 6).
- **Executive Viewer (19):** dashboards and aggregate metrics only. No access to identity, org, or audit detail tables. Dashboard and KPI permissions ship in a later phase; in Phase 1 this role has no grants in the matrix above (it is created and held in reserve so executive users can be assigned it now and gain dashboard access when that module ships).

## 3. Scope and enforcement

- **Scope is on the Assignment, not the Role.** A role defines *what* actions are permitted; an assignment defines *where* (which site, which department) and *when* (`validFrom`/`validUntil`, `status = ACTIVE`). A user's resolved permissions are the union over their active assignments (ADR-0004 point 6).
- **Three-layer enforcement** (ADR-0004 point 5): (1) UI hides or disables actions (usability only, **not** authorization); (2) API/middleware `requirePermission(perm, scope)` rejects early; (3) the service/domain layer re-checks `can(perm, scope, target)` authoritatively, including the target's site and department.
- **Multi-site isolation:** every site-scoped repository query appends `WHERE siteId IN (resolvedSites)` (ADR-0002, Phase 1 plan §8). Cross-site data leakage is a critical defect (test T-ISOL-01).
- **Denied attempts are audited:** every `can()` failure emits an `AuditEvent(action = "authorization.denied")` with actor, attempted action, target, `ipAddress`, and `sessionId` (ADR-0004 point 6, ADR-0005, test T-AUDIT-02).

## 4. Defaults, not hard-coding

- These grants are **defaults**. They are seeded by a migration and are configurable post-seed. Any change to a system role's grants, or any new assignment, is itself an audited event (`identity.role.assign-permission`, `identity.assignment.create`/`delete`).
- A Super Administrator (or a Site Administrator within their site, for non-global roles) may narrow or widen a role's grants within the limits above. Widening a role to include destructive permissions it does not have by default (e.g. granting `identity.user.delete` to a Site Administrator) is allowed but is audited and should be justified by a change-control record.
- The Super Administrator role itself should be edited only through a documented, owner-approved change (it is the trust root of the system).

## 5. Extending the matrix in later phases

- Later phases add module permission groups (`production.*`, `quality.*`, `equipment.*`, `validation.*`, `cleanroom.*`, `lab.*`, `packaging.*`, `sterilization.*`, `lean.*`, `documents.*`, `training.*`, etc.) by:
  1. Adding new `Permission` rows (system-defined, via migration).
  2. Granting the new permissions to the appropriate system roles (e.g. `quality.ncr.approve` to QA Reviewer / Approver and Quality Manager; `production.workorder.create` to Production Planner and Production Manager).
  3. Updating this matrix document with the new groups and grants.
- The naming convention `<module>.<resource>.<action>` extends unchanged. The Assignment and Scope model (ADR-0004) does not change. The three-layer enforcement does not change.
- The Phase 1 groups above (identity, org, audit, session) are **not** re-granted by later phases; they remain the trust foundation.

## 6. Role count note

The PRD (§3) and `DOMAIN_GLOSSARY.md` (§1) describe the configurable role set as "18 roles" but enumerate 19 distinct names (the list includes both Super Administrator and Executive Viewer alongside the 17 functional roles). This matrix includes all 19 enumerated roles. The count discrepancy (18 vs 19) is a documentation item to confirm with the owner; it does not affect the model, the seed, or enforcement. If the owner confirms 18, one role (most likely Super Administrator, which is structural rather than functional, or Executive Viewer, which has no Phase 1 grants) would be reclassified, but the matrix structure is unchanged either way.

## Compliance note

This matrix records the default Phase 1 permission grants and the authorization model. It is an engineering control supporting least privilege and auditability, not a claim of ISO 13485, FDA 21 CFR Part 11, or Part 820 compliance. Compliance depends on intended use, validated configuration, procedures, and evidence (PRD §17).
