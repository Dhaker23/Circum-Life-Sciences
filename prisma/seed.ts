// Circum Phase 1 synthetic DEMO seed.
// ALL data is synthetic DEMO/TEST. Clearly labelled (isDemo=true on sites/departments/employees;
// demo users use @circum.demo emails). Never represents real Circum operational data (PRD §21).
// Idempotent: safe to re-run (upserts by unique keys).
//
// Run: bun run db:seed   (or: bun run prisma/seed.ts)

import { PrismaClient, type Role, type Permission, type Site, type Department } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import {
  PERMISSION_CATALOG,
  ROLE_SYSTEM_KEYS,
  DEFAULT_ROLE_GRANTS,
  ROLE_DISPLAY_NAMES,
  type RoleSystemKey,
} from "../src/lib/permissions";

const db = new PrismaClient();

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "CircumDemo2025!";
const PEPPER = process.env.AUTH_PEPPER ?? "";

async function hashPassword(password: string): Promise<string> {
  // argon2id, OWASP params. Pepper applied before hashing (ADR-0003).
  return hash(Buffer.concat([Buffer.from(password), Buffer.from(PEPPER)]), {
    algorithm: 2, // argon2id
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 4,
  });
}

interface DemoSiteDef {
  code: string;
  name: string;
  address: string;
  timezone: string;
  departments: { code: string; name: string }[];
}

const DEMO_SITES: DemoSiteDef[] = [
  {
    code: "DEMO-CH-01",
    name: "Circum Geneva (DEMO)",
    address: "Demo Address, Geneva, Switzerland",
    timezone: "Europe/Zurich",
    departments: [
      { code: "PROD", name: "Production" },
      { code: "QA", name: "Quality Assurance" },
      { code: "LAB", name: "Laboratory" },
      { code: "MAINT", name: "Maintenance" },
      { code: "WH", name: "Warehouse" },
    ],
  },
  {
    code: "DEMO-FR-01",
    name: "Circum Lyon (DEMO)",
    address: "Demo Address, Lyon, France",
    timezone: "Europe/Paris",
    departments: [
      { code: "PROD", name: "Production" },
      { code: "QA", name: "Quality Assurance" },
      { code: "LAB", name: "Laboratory" },
      { code: "MAINT", name: "Maintenance" },
    ],
  },
  {
    code: "DEMO-TN-01",
    name: "Circum Tunis (DEMO)",
    address: "Demo Address, Tunis, Tunisia",
    timezone: "Africa/Tunis",
    departments: [
      { code: "PROD", name: "Production" },
      { code: "QA", name: "Quality Assurance" },
      { code: "WH", name: "Warehouse" },
      { code: "MAINT", name: "Maintenance" },
    ],
  },
];

// Demo users: one per representative role, scoped to a site (except super_admin global).
// email convention: <role>.<site>@circum.demo  (all DEMO/TEST)
interface DemoUserDef {
  email: string;
  name: string;
  roleKey: RoleSystemKey;
  siteCode: string | null; // null = global (super_admin only)
  departmentCode?: string;
}

const DEMO_USERS: DemoUserDef[] = [
  { email: "admin@circum.demo", name: "Demo Super Admin", roleKey: "super_admin", siteCode: null },
  { email: "siteadmin.ch@circum.demo", name: "Demo Site Admin (CH)", roleKey: "site_admin", siteCode: "DEMO-CH-01" },
  { email: "qmanager.ch@circum.demo", name: "Demo Quality Manager (CH)", roleKey: "quality_manager", siteCode: "DEMO-CH-01" },
  { email: "operator.tn@circum.demo", name: "Demo Operator (TN)", roleKey: "operator", siteCode: "DEMO-TN-01", departmentCode: "PROD" },
  { email: "auditor.fr@circum.demo", name: "Demo Auditor (FR)", roleKey: "auditor", siteCode: "DEMO-FR-01" },
  { email: "plantmgr.tn@circum.demo", name: "Demo Plant Manager (TN)", roleKey: "plant_manager", siteCode: "DEMO-TN-01" },
];

async function main() {
  console.log("Seeding Circum Phase 1 DEMO data (synthetic, clearly labelled)...");

  // 1. Permissions catalog (system-defined).
  const permByCode: Record<string, Permission> = {};
  for (const def of PERMISSION_CATALOG) {
    const p = await db.permission.upsert({
      where: { key: def.key },
      update: { description: def.description },
      create: { key: def.key, module: def.module, description: def.description },
    });
    permByCode[def.key] = p;
  }
  console.log(`  permissions: ${PERMISSION_CATALOG.length}`);

  // 2. Roles (19 system roles) + least-privilege grants.
  const roleByKey: Record<string, Role> = {};
  for (const key of ROLE_SYSTEM_KEYS) {
    const r = await db.role.upsert({
      where: { systemKey: key },
      update: { name: ROLE_DISPLAY_NAMES[key], isSystem: true, status: "ACTIVE" },
      create: {
        systemKey: key,
        name: ROLE_DISPLAY_NAMES[key],
        isSystem: true,
        status: "ACTIVE",
        description: `System role: ${ROLE_DISPLAY_NAMES[key]}`,
      },
    });
    roleByKey[key] = r;
  }
  console.log(`  roles: ${ROLE_SYSTEM_KEYS.length}`);

  // 3. RolePermission grants (least-privilege, ADR-0004).
  for (const key of ROLE_SYSTEM_KEYS) {
    const role = roleByKey[key];
    const grants = DEFAULT_ROLE_GRANTS[key];
    for (const permKey of grants) {
      const perm = permByCode[permKey];
      if (!perm) {
        throw new Error(`Permission ${permKey} not found for role ${key}`);
      }
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }
  console.log(`  role grants applied`);

  // 4. Sites + departments.
  const siteByCode: Record<string, Site> = {};
  const deptByCode: Record<string, Department> = {};
  for (const sd of DEMO_SITES) {
    const site = await db.site.upsert({
      where: { code: sd.code },
      update: { name: sd.name, address: sd.address, timezone: sd.timezone, isDemo: true, status: "ACTIVE" },
      create: { code: sd.code, name: sd.name, address: sd.address, timezone: sd.timezone, isDemo: true, status: "ACTIVE" },
    });
    siteByCode[sd.code] = site;
    for (const dd of sd.departments) {
      const dept = await db.department.upsert({
        where: { siteId_code: { siteId: site.id, code: dd.code } },
        update: { name: dd.name, isDemo: true, status: "ACTIVE" },
        create: { siteId: site.id, code: dd.code, name: dd.name, isDemo: true, status: "ACTIVE" },
      });
      deptByCode[`${sd.code}:${dd.code}`] = dept;
    }
  }
  console.log(`  sites: ${DEMO_SITES.length}, departments: ${DEMO_SITES.reduce((n, s) => n + s.departments.length, 0)}`);

  // 5. Demo users + assignments (scoped).
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const ud of DEMO_USERS) {
    const role = roleByKey[ud.roleKey];
    const user = await db.user.upsert({
      where: { email: ud.email },
      update: { name: ud.name, passwordHash, status: "ACTIVE" },
      create: { email: ud.email, name: ud.name, passwordHash, status: "ACTIVE", preferredLocale: "en" },
    });
    const siteId = ud.siteCode ? siteByCode[ud.siteCode]?.id : null;
    const departmentId =
      ud.siteCode && ud.departmentCode ? deptByCode[`${ud.siteCode}:${ud.departmentCode}`]?.id : null;
    await db.assignment.upsert({
      where: {
        userId_roleId_siteId_departmentId_moduleScope: {
          userId: user.id,
          roleId: role.id,
          siteId: siteId ?? "",
          departmentId: departmentId ?? "",
          moduleScope: "",
        },
      },
      update: { status: "ACTIVE" },
      create: {
        userId: user.id,
        roleId: role.id,
        siteId: siteId ?? null,
        departmentId: departmentId ?? null,
        status: "ACTIVE",
      },
    });
  }
  console.log(`  demo users: ${DEMO_USERS.length}`);

  // 6. Demo employees (some linked to a User, some not — proves optional link, ADR-0004).
  const employees: { code: string; first: string; last: string; site: string; dept: string; linkEmail?: string }[] = [
    { code: "EMP-0001", first: "Demo", last: "Operator-One", site: "DEMO-TN-01", dept: "PROD", linkEmail: "operator.tn@circum.demo" },
    { code: "EMP-0002", first: "Demo", last: "QA-Officer", site: "DEMO-CH-01", dept: "QA", linkEmail: "qmanager.ch@circum.demo" },
    { code: "EMP-0003", first: "Demo", last: "LineWorker", site: "DEMO-TN-01", dept: "PROD" }, // no login
    { code: "EMP-0004", first: "Demo", last: "LabAnalyst", site: "DEMO-FR-01", dept: "LAB" }, // no login
    { code: "EMP-0005", first: "Demo", last: "WarehouseClerk", site: "DEMO-TN-01", dept: "WH" }, // no login
  ];
  for (const e of employees) {
    const site = siteByCode[e.site];
    const dept = deptByCode[`${e.site}:${e.dept}`];
    let userId: string | null = null;
    if (e.linkEmail) {
      const u = await db.user.findUnique({ where: { email: e.linkEmail } });
      userId = u?.id ?? null;
    }
    await db.employee.upsert({
      where: { employeeCode: e.code },
      update: { firstName: e.first, lastName: e.last, fullName: `${e.first} ${e.last}`, siteId: site.id, departmentId: dept?.id ?? null, userId, isDemo: true, status: "ACTIVE" },
      create: { employeeCode: e.code, firstName: e.first, lastName: e.last, fullName: `${e.first} ${e.last}`, siteId: site.id, departmentId: dept?.id ?? null, userId, isDemo: true, status: "ACTIVE" },
    });
  }
  console.log(`  demo employees: ${employees.length}`);

  // 7. Seed audit event (records that the seed ran).
  await db.auditEvent.create({
    data: {
      action: "system.seed.run",
      entityType: "System",
      entityId: "seed",
      outcome: "SUCCESS",
      reason: "Phase 1 synthetic DEMO seed applied",
      newState: { roles: ROLE_SYSTEM_KEYS.length, demoSites: DEMO_SITES.length, demoUsers: DEMO_USERS.length },
    },
  });
  console.log("  audit: seed-run event recorded");

  console.log("\nDONE. DEMO login (DEMO/TEST only):");
  console.log(`  admin@circum.demo / ${DEMO_PASSWORD}  (Super Admin, global)`);
  console.log(`  qmanager.ch@circum.demo / ${DEMO_PASSWORD}  (Quality Manager @ CH site)`);
  console.log(`  operator.tn@circum.demo / ${DEMO_PASSWORD}  (Operator @ TN site)`);
  console.log(`  auditor.fr@circum.demo / ${DEMO_PASSWORD}  (Auditor @ FR site, read-only)`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
