// Circum permission catalog (system-defined). ADR-0004.
// Format: <module>.<resource>.<action>
// This is the single source of truth for permission keys. Seeded into the Permission table
// and referenced by the RBAC can() checks. Phase 1 covers identity/org/audit/session modules;
// later phases add their module permissions using the same convention.

export interface PermissionDef {
  key: string;
  module: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDef[] = [
  // identity.users
  { key: "identity.user.read", module: "identity", description: "Read user accounts" },
  { key: "identity.user.create", module: "identity", description: "Create user accounts" },
  { key: "identity.user.update", module: "identity", description: "Update user profile" },
  { key: "identity.user.disable", module: "identity", description: "Disable a user account" },
  { key: "identity.user.reset-password", module: "identity", description: "Reset a user's password" },
  // identity.roles
  { key: "identity.role.read", module: "identity", description: "Read roles and permissions" },
  { key: "identity.role.create", module: "identity", description: "Create custom roles" },
  { key: "identity.role.update", module: "identity", description: "Update role permission grants" },
  // identity.assignments
  { key: "identity.assignment.read", module: "identity", description: "Read role assignments" },
  { key: "identity.assignment.create", module: "identity", description: "Grant a role assignment" },
  { key: "identity.assignment.delete", module: "identity", description: "Revoke a role assignment" },
  // organization
  { key: "org.site.read", module: "org", description: "Read sites" },
  { key: "org.site.create", module: "org", description: "Create sites" },
  { key: "org.site.update", module: "org", description: "Update sites" },
  { key: "org.site.deactivate", module: "org", description: "Deactivate a site" },
  { key: "org.department.read", module: "org", description: "Read departments" },
  { key: "org.department.create", module: "org", description: "Create departments" },
  { key: "org.department.update", module: "org", description: "Update departments" },
  { key: "org.department.deactivate", module: "org", description: "Deactivate a department" },
  // audit
  { key: "audit.read", module: "audit", description: "Read audit events" },
  { key: "audit.export", module: "audit", description: "Export audit events (CSV)" },
  // session
  { key: "session.sign-in", module: "session", description: "Sign in" },
  { key: "session.sign-out", module: "session", description: "Sign out" },
  // employee
  { key: "org.employee.read", module: "org", description: "Read employees" },
];

// Role system keys (stable enum-like strings). The 19 PRD roles (PRD §3).
export const ROLE_SYSTEM_KEYS = [
  "super_admin",
  "site_admin",
  "plant_manager",
  "production_manager",
  "production_planner",
  "shift_supervisor",
  "operator",
  "quality_manager",
  "qa_reviewer",
  "quality_engineer",
  "lab_technician",
  "validation_engineer",
  "maintenance_manager",
  "maintenance_technician",
  "calibration_technician",
  "warehouse_logistics_manager",
  "lean_manager",
  "auditor",
  "executive_viewer",
] as const;

export type RoleSystemKey = (typeof ROLE_SYSTEM_KEYS)[number];

// Least-privilege default grants per role (ADR-0004 + docs/architecture/rbac-matrix.md).
// NO broad admin perms for convenience. Each entry maps a role systemKey to a list of permission keys.
// super_admin is the ONLY global-scope role and gets full Phase 1 permissions.
export const DEFAULT_ROLE_GRANTS: Record<RoleSystemKey, string[]> = {
  super_admin: [
    "identity.user.read", "identity.user.create", "identity.user.update", "identity.user.disable", "identity.user.reset-password",
    "identity.role.read", "identity.role.create", "identity.role.update",
    "identity.assignment.read", "identity.assignment.create", "identity.assignment.delete",
    "org.site.read", "org.site.create", "org.site.update", "org.site.deactivate",
    "org.department.read", "org.department.create", "org.department.update", "org.department.deactivate",
    "org.employee.read",
    "audit.read", "audit.export",
    "session.sign-in", "session.sign-out",
  ],
  site_admin: [
    "identity.user.read", "identity.user.create", "identity.user.update", "identity.user.disable",
    "identity.role.read",
    "identity.assignment.read", "identity.assignment.create", "identity.assignment.delete",
    "org.site.read", "org.department.read", "org.department.create", "org.department.update", "org.department.deactivate",
    "org.employee.read",
    "audit.read",
    "session.sign-in", "session.sign-out",
  ],
  plant_manager: [
    "identity.user.read", "identity.role.read", "identity.assignment.read",
    "org.site.read", "org.department.read", "org.employee.read",
    "audit.read",
    "session.sign-in", "session.sign-out",
  ],
  production_manager: [
    "identity.user.read", "org.site.read", "org.department.read", "org.employee.read",
    "session.sign-in", "session.sign-out",
  ],
  production_planner: [
    "org.site.read", "org.department.read", "org.employee.read",
    "session.sign-in", "session.sign-out",
  ],
  shift_supervisor: [
    "identity.user.read", "org.department.read", "org.employee.read",
    "session.sign-in", "session.sign-out",
  ],
  operator: [
    "session.sign-in", "session.sign-out",
  ],
  quality_manager: [
    "identity.user.read", "identity.role.read", "identity.assignment.read",
    "org.site.read", "org.department.read", "org.employee.read",
    "audit.read", "audit.export",
    "session.sign-in", "session.sign-out",
  ],
  qa_reviewer: [
    "audit.read", "identity.user.read", "org.site.read", "org.department.read", "org.employee.read",
    "session.sign-in", "session.sign-out",
  ],
  quality_engineer: [
    "audit.read", "identity.user.read", "org.site.read", "org.department.read", "org.employee.read",
    "session.sign-in", "session.sign-out",
  ],
  lab_technician: [
    "session.sign-in", "session.sign-out",
  ],
  validation_engineer: [
    "org.site.read", "org.department.read", "audit.read",
    "session.sign-in", "session.sign-out",
  ],
  maintenance_manager: [
    "identity.user.read", "org.site.read", "org.department.read", "org.employee.read",
    "session.sign-in", "session.sign-out",
  ],
  maintenance_technician: [
    "session.sign-in", "session.sign-out",
  ],
  calibration_technician: [
    "session.sign-in", "session.sign-out",
  ],
  warehouse_logistics_manager: [
    "identity.user.read", "org.site.read", "org.department.read", "org.employee.read",
    "session.sign-in", "session.sign-out",
  ],
  lean_manager: [
    "org.site.read", "org.department.read", "audit.read",
    "session.sign-in", "session.sign-out",
  ],
  auditor: [
    "audit.read", "audit.export",
    "identity.user.read", "identity.role.read", "identity.assignment.read",
    "org.site.read", "org.department.read", "org.employee.read",
    "session.sign-in", "session.sign-out",
  ],
  executive_viewer: [
    "session.sign-in", "session.sign-out",
  ],
};

// Human-readable role display names (i18n keys; the UI resolves via message catalogs).
export const ROLE_DISPLAY_NAMES: Record<RoleSystemKey, string> = {
  super_admin: "Super Administrator",
  site_admin: "Site Administrator",
  plant_manager: "Plant Manager",
  production_manager: "Production Manager",
  production_planner: "Production Planner",
  shift_supervisor: "Shift Supervisor",
  operator: "Operator",
  quality_manager: "Quality Manager",
  qa_reviewer: "QA Reviewer/Approver",
  quality_engineer: "Quality Engineer",
  lab_technician: "Laboratory Technician",
  validation_engineer: "Validation Engineer",
  maintenance_manager: "Maintenance Manager",
  maintenance_technician: "Maintenance Technician",
  calibration_technician: "Calibration Technician",
  warehouse_logistics_manager: "Warehouse/Logistics Manager",
  lean_manager: "Lean Manager",
  auditor: "Auditor",
  executive_viewer: "Executive Viewer",
};

// User status state machine (domain invariant).
export const USER_STATUSES = ["ACTIVE", "LOCKED", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SITE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const AUDIT_OUTCOMES = ["SUCCESS", "FAILURE", "DENIED"] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
