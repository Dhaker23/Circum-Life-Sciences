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

// Phase 2: Manufacturing master data seed (synthetic DEMO/TEST).
// Products (DEVICE IIa/IIb + COMPONENT), Revisions (EFFECTIVE + DRAFT), BOMs with lines,
// Materials, Suppliers (APPROVED/CONDITIONAL/DISQUALIFIED), MaterialSupplier links,
// site-owned MaterialLots in various statuses. All isDemo=true.
async function seedManufacturing(siteByCode: Record<string, Site>) {
  console.log("Seeding Phase 2 manufacturing DEMO data...");

  // Suppliers
  const suppliers = [
    { code: "SUP-DEMO-01", name: "Demo Supplier Alpha (APPROVED)", qualificationStatus: "APPROVED", contact: "demo@alpha.test" },
    { code: "SUP-DEMO-02", name: "Demo Supplier Beta (CONDITIONAL)", qualificationStatus: "CONDITIONAL", contact: "demo@beta.test" },
    { code: "SUP-DEMO-03", name: "Demo Supplier Gamma (DISQUALIFIED)", qualificationStatus: "DISQUALIFIED", contact: "demo@gamma.test" },
  ];
  const supplierByCode: Record<string, { id: string; code: string }> = {};
  for (const s of suppliers) {
    const sup = await db.supplier.upsert({
      where: { code: s.code },
      update: { name: s.name, qualificationStatus: s.qualificationStatus, contact: s.contact, isDemo: true, status: "ACTIVE" },
      create: { ...s, isDemo: true, status: "ACTIVE" },
    });
    supplierByCode[s.code] = sup;
  }
  console.log(`  suppliers: ${suppliers.length}`);

  // Materials
  const materials = [
    { code: "MAT-DEMO-001", name: "Demo Polymer Resin", materialType: "RAW", defaultUnit: "kg" },
    { code: "MAT-DEMO-002", name: "Demo Stainless Component", materialType: "COMPONENT", defaultUnit: "pcs" },
    { code: "MAT-DEMO-003", name: "Demo Packaging Foil", materialType: "PACKAGING", defaultUnit: "m" },
    { code: "MAT-DEMO-004", name: "Demo Sterile Pouch", materialType: "PACKAGING", defaultUnit: "pcs" },
    { code: "MAT-DEMO-005", name: "Demo Cleaning Solvent", materialType: "CONSUMABLE", defaultUnit: "L" },
  ];
  const materialByCode: Record<string, { id: string; code: string; defaultUnit: string }> = {};
  for (const m of materials) {
    const mat = await db.material.upsert({
      where: { code: m.code },
      update: { name: m.name, materialType: m.materialType, defaultUnit: m.defaultUnit, isDemo: true, status: "ACTIVE" },
      create: { ...m, isDemo: true, status: "ACTIVE" },
    });
    materialByCode[m.code] = mat;
  }
  console.log(`  materials: ${materials.length}`);

  // MaterialSupplier links (M:N, D5). MAT-001 -> SUP-01 (preferred) + SUP-02; MAT-002 -> SUP-01.
  const links: Array<{ material: string; supplier: string; isPreferred: boolean; supplierPartCode?: string }> = [
    { material: "MAT-DEMO-001", supplier: "SUP-DEMO-01", isPreferred: true, supplierPartCode: "A-RESIN-1" },
    { material: "MAT-DEMO-001", supplier: "SUP-DEMO-02", isPreferred: false, supplierPartCode: "B-RESIN-1" },
    { material: "MAT-DEMO-002", supplier: "SUP-DEMO-01", isPreferred: true, supplierPartCode: "A-COMP-1" },
    { material: "MAT-DEMO-003", supplier: "SUP-DEMO-02", isPreferred: true },
    { material: "MAT-DEMO-004", supplier: "SUP-DEMO-01", isPreferred: true },
  ];
  for (const l of links) {
    await db.materialSupplier.upsert({
      where: { materialId_supplierId: { materialId: materialByCode[l.material].id, supplierId: supplierByCode[l.supplier].id } },
      update: { isPreferred: l.isPreferred, supplierPartCode: l.supplierPartCode ?? null },
      create: { materialId: materialByCode[l.material].id, supplierId: supplierByCode[l.supplier].id, isPreferred: l.isPreferred, supplierPartCode: l.supplierPartCode ?? null },
    });
  }
  console.log(`  material-supplier links: ${links.length}`);

  // Products + Revisions + BOMs
  const products = [
    { code: "DEV-DEMO-001", name: "Demo Catheter Device", productType: "DEVICE", deviceClass: "IIa" },
    { code: "DEV-DEMO-002", name: "Demo Surgical Kit", productType: "DEVICE", deviceClass: "IIb" },
    { code: "DEV-DEMO-003", name: "Demo Handle Component", productType: "COMPONENT", deviceClass: null },
  ];
  for (const p of products) {
    const product = await db.product.upsert({
      where: { code: p.code },
      update: { name: p.name, productType: p.productType, deviceClass: p.deviceClass, isDemo: true, status: "ACTIVE" },
      create: { ...p, deviceClass: p.deviceClass ?? null, isDemo: true, status: "ACTIVE" },
    });
    // Rev A (EFFECTIVE) + Rev B (DRAFT) for each product
    const revA = await db.productRevision.upsert({
      where: { productId_revisionCode: { productId: product.id, revisionCode: "REV-A" } },
      update: { status: "EFFECTIVE", effectiveFrom: new Date("2025-01-01"), isDemo: true },
      create: { productId: product.id, revisionCode: "REV-A", description: "Initial release", status: "EFFECTIVE", effectiveFrom: new Date("2025-01-01"), isDemo: true },
    });
    const revB = await db.productRevision.upsert({
      where: { productId_revisionCode: { productId: product.id, revisionCode: "REV-B" } },
      update: { status: "DRAFT", isDemo: true },
      create: { productId: product.id, revisionCode: "REV-B", description: "Draft revision (pending change)", status: "DRAFT", isDemo: true },
    });
    // BOM for Rev A (EFFECTIVE -> frozen, status EFFECTIVE)
    const bomA = await db.bOM.upsert({
      where: { productRevisionId: revA.id },
      update: { status: "EFFECTIVE" },
      create: { productRevisionId: revA.id, status: "EFFECTIVE", version: 1 },
    });
    // BOM lines for Rev A (3 lines)
    const linesA = [
      { materialId: materialByCode["MAT-DEMO-001"].id, quantity: "0.5", unit: "kg", sequence: 1 },
      { materialId: materialByCode["MAT-DEMO-002"].id, quantity: "1", unit: "pcs", sequence: 2 },
      { materialId: materialByCode["MAT-DEMO-004"].id, quantity: "2", unit: "pcs", sequence: 3 },
    ];
    for (const ln of linesA) {
      await db.bOMLine.upsert({
        where: { bomId_materialId: { bomId: bomA.id, materialId: ln.materialId } },
        update: { quantity: ln.quantity, unit: ln.unit, sequence: ln.sequence },
        create: { bomId: bomA.id, ...ln },
      });
    }
    // BOM for Rev B (DRAFT -> editable)
    const bomB = await db.bOM.upsert({
      where: { productRevisionId: revB.id },
      update: { status: "DRAFT" },
      create: { productRevisionId: revB.id, status: "DRAFT", version: 1 },
    });
    const linesB = [
      { materialId: materialByCode["MAT-DEMO-001"].id, quantity: "0.45", unit: "kg", sequence: 1 },
      { materialId: materialByCode["MAT-DEMO-002"].id, quantity: "1", unit: "pcs", sequence: 2 },
    ];
    for (const ln of linesB) {
      await db.bOMLine.upsert({
        where: { bomId_materialId: { bomId: bomB.id, materialId: ln.materialId } },
        update: { quantity: ln.quantity, unit: ln.unit, sequence: ln.sequence },
        create: { bomId: bomB.id, ...ln },
      });
    }
  }
  console.log(`  products: ${products.length} (x2 revisions each, with BOMs)`);

  // Material Lots (SITE-OWNED, various statuses). Demonstrates multi-site isolation + lifecycle.
  const lots = [
    { lotCode: "LOT-CH-001", material: "MAT-DEMO-001", supplier: "SUP-DEMO-01", site: "DEMO-CH-01", qty: "100", unit: "kg", status: "APPROVED" },
    { lotCode: "LOT-CH-002", material: "MAT-DEMO-002", supplier: "SUP-DEMO-01", site: "DEMO-CH-01", qty: "50", unit: "pcs", status: "QUARANTINE" },
    { lotCode: "LOT-CH-003", material: "MAT-DEMO-004", supplier: "SUP-DEMO-01", site: "DEMO-CH-01", qty: "200", unit: "pcs", status: "EXHAUSTED" },
    { lotCode: "LOT-TN-001", material: "MAT-DEMO-001", supplier: "SUP-DEMO-02", site: "DEMO-TN-01", qty: "80", unit: "kg", status: "APPROVED" },
    { lotCode: "LOT-TN-002", material: "MAT-DEMO-003", supplier: "SUP-DEMO-02", site: "DEMO-TN-01", qty: "30", unit: "m", status: "RECEIVED" },
    { lotCode: "LOT-TN-003", material: "MAT-DEMO-005", supplier: "SUP-DEMO-02", site: "DEMO-TN-01", qty: "10", unit: "L", status: "REJECTED" },
    { lotCode: "LOT-FR-001", material: "MAT-DEMO-002", supplier: "SUP-DEMO-01", site: "DEMO-FR-01", qty: "40", unit: "pcs", status: "IN_USE" },
    { lotCode: "LOT-FR-002", material: "MAT-DEMO-004", supplier: "SUP-DEMO-01", site: "DEMO-FR-01", qty: "120", unit: "pcs", status: "APPROVED" },
  ];
  for (const l of lots) {
    const site = siteByCode[l.site];
    const mat = materialByCode[l.material];
    const sup = supplierByCode[l.supplier];
    const avail = l.status === "EXHAUSTED" ? "0" : l.qty;
    await db.materialLot.upsert({
      where: { siteId_lotCode: { siteId: site.id, lotCode: l.lotCode } },
      update: { materialId: mat.id, supplierId: sup.id, quantityReceived: l.qty, quantityAvailable: avail, unit: l.unit, status: l.status, isDemo: true },
      create: { lotCode: l.lotCode, materialId: mat.id, supplierId: sup.id, siteId: site.id, quantityReceived: l.qty, quantityAvailable: avail, unit: l.unit, status: l.status, isDemo: true, receivedAt: new Date() },
    });
  }
  console.log(`  material lots: ${lots.length} (across 3 sites, various statuses)`);

  await db.auditEvent.create({
    data: { action: "system.seed.manufacturing", entityType: "System", entityId: "seed-p2", outcome: "SUCCESS", reason: "Phase 2 synthetic DEMO seed applied", newState: { products: products.length, suppliers: suppliers.length, lots: lots.length } },
  });
  console.log("  audit: phase2 seed-run event recorded");
}

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

  // 8. Phase 2: Manufacturing master data (synthetic DEMO/TEST).
  await seedManufacturing(siteByCode);

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
