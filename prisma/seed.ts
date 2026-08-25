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

// Phase 3: Production execution seed (synthetic DEMO/TEST).
// WorkCenters, Shifts, Routings+Operations (for EFFECTIVE revisions), Work Orders,
// Manufacturing Batches (one with Device Lots split, one IN_PRODUCTION with consumption),
// OperationExecution, MaterialConsumption, Scrap/Rework. All isDemo=true.
async function seedProduction(siteByCode: Record<string, Site>) {
  console.log("Seeding Phase 3 production DEMO data...");
  const db_ = db;

  // WorkCenters (2 per site)
  const wcByCode: Record<string, { id: string; code: string }> = {};
  for (const siteCode of Object.keys(siteByCode)) {
    const site = siteByCode[siteCode];
    for (const wcDef of [{ code: `WC-${siteCode.slice(-2)}-ASM`, name: "Assembly Station" }, { code: `WC-${siteCode.slice(-2)}-MOLD`, name: "Molding Line" }]) {
      const wc = await db_.workCenter.upsert({
        where: { siteId_code: { siteId: site.id, code: wcDef.code } },
        update: { name: wcDef.name, isDemo: true, status: "ACTIVE" },
        create: { code: wcDef.code, name: wcDef.name, siteId: site.id, isDemo: true, status: "ACTIVE" },
      });
      wcByCode[wcDef.code] = wc;
    }
  }
  console.log(`  work centers: ${Object.keys(wcByCode).length}`);

  // Shifts (2 per site)
  for (const siteCode of Object.keys(siteByCode)) {
    const site = siteByCode[siteCode];
    for (const sh of [{ name: "Morning", startTime: "06:00", endTime: "14:00" }, { name: "Night", startTime: "14:00", endTime: "22:00" }]) {
      await db_.shift.upsert({
        where: { siteId_name: { siteId: site.id, name: sh.name } },
        update: { startTime: sh.startTime, endTime: sh.endTime, isDemo: true },
        create: { siteId: site.id, name: sh.name, startTime: sh.startTime, endTime: sh.endTime, isDemo: true },
      });
    }
  }
  console.log(`  shifts: 2 per site`);

  // Routings + Operations for each EFFECTIVE product revision (DEV-DEMO-001 REV-A)
  const effRev = await db_.productRevision.findFirst({ where: { status: "EFFECTIVE" }, include: { product: true } });
  if (effRev) {
    const routing = await db_.routing.upsert({
      where: { productRevisionId: effRev.id },
      update: { status: "EFFECTIVE" },
      create: { productRevisionId: effRev.id, status: "EFFECTIVE", version: 1 },
    });
    // 3 operations
    const chSite = siteByCode["DEMO-CH-01"];
    const ops = [
      { sequence: 10, name: "Molding", workCenterCode: "WC-CH-01-MOLD", instructions: "Mold the catheter body per SOP-001" },
      { sequence: 20, name: "Assembly", workCenterCode: "WC-CH-01-ASM", instructions: "Assemble components per SOP-002" },
      { sequence: 30, name: "Inspection", workCenterCode: "WC-CH-01-ASM", instructions: "Visual inspection per SOP-003" },
    ];
    for (const op of ops) {
      const wc = wcByCode[op.workCenterCode];
      await db_.operation.upsert({
        where: { routingId_sequence: { routingId: routing.id, sequence: op.sequence } },
        update: { name: op.name, workCenterId: wc?.id ?? null, instructions: op.instructions },
        create: { routingId: routing.id, sequence: op.sequence, name: op.name, workCenterId: wc?.id ?? null, instructions: op.instructions },
      });
    }
    console.log(`  routing + 3 operations for ${effRev.product.code} ${effRev.revisionCode}`);

    // Work Order (RELEASED -> IN_PRODUCTION) at CH site
    const wo = await db_.workOrder.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "WO-CH-001" } },
      update: { status: "IN_PRODUCTION", releasedAt: new Date("2025-06-01") },
      create: { code: "WO-CH-001", productRevisionId: effRev.id, siteId: chSite.id, plannedQuantity: "500", unit: "pcs", status: "IN_PRODUCTION", releasedAt: new Date("2025-06-01"), isDemo: true },
    });

    // Batch 1 (IN_PRODUCTION with consumption + execution + device lot)
    const batch1 = await db_.manufacturingBatch.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "BATCH-CH-001" } },
      update: { status: "IN_PRODUCTION", startedAt: new Date("2025-06-02") },
      create: { code: "BATCH-CH-001", workOrderId: wo.id, productRevisionId: effRev.id, siteId: chSite.id, plannedQuantity: "300", unit: "pcs", status: "IN_PRODUCTION", startedAt: new Date("2025-06-02"), isDemo: true },
    });
    // Device Lot split from batch1
    await db_.deviceLot.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "DL-CH-001" } },
      update: {},
      create: { code: "DL-CH-001", batchId: batch1.id, siteId: chSite.id, quantity: "150", unit: "pcs", status: "IN_PROCESS", isDemo: true },
    });
    await db_.deviceLot.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "DL-CH-002" } },
      update: {},
      create: { code: "DL-CH-002", batchId: batch1.id, siteId: chSite.id, quantity: "150", unit: "pcs", status: "CREATED", isDemo: true },
    });
    // Material consumption: consume MAT-DEMO-001 (polymer) lot LOT-CH-001 (approved, 100kg avail) into batch1
    const mat1 = await db_.material.findUniqueOrThrow({ where: { code: "MAT-DEMO-001" } });
    const lotCh1 = await db_.materialLot.findFirst({ where: { lotCode: "LOT-CH-001" } });
    if (lotCh1) {
      const consumed = "20";
      await db_.materialLot.update({ where: { id: lotCh1.id }, data: { quantityAvailable: parseFloat(lotCh1.quantityAvailable.toString()) - parseFloat(consumed) } });
      await db_.materialConsumption.create({ data: { batchId: batch1.id, materialLotId: lotCh1.id, quantity: consumed, unit: "kg", recordedByUserId: null, notes: "Initial molding consumption" } });
    }
    // Operation execution: operator (Employee EMP-0003 LineWorker at TN, but use CH employee)
    const emp = await db_.employee.findFirst({ where: { site: { code: "DEMO-CH-01" } } });
    const op10 = await db_.operation.findFirst({ where: { routingId: routing.id, sequence: 10 } });
    if (emp && op10) {
      await db_.operationExecution.create({ data: { batchId: batch1.id, operationId: op10.id, workCenterId: wcByCode["WC-CH-01-MOLD"]?.id ?? null, startedAt: new Date("2025-06-02T08:00"), completedAt: new Date("2025-06-02T12:00"), status: "COMPLETED", operatorEmployeeId: emp.id, loggedByUserId: null, notes: "Molding completed" } });
    }
    // Scrap record
    await db_.productionScrap.create({ data: { batchId: batch1.id, quantity: "5", unit: "pcs", reason: "Visual defect (demo scrap)", recordedByUserId: null } });

    // Batch 2 (COMPLETED -> READY_FOR_REVIEW) to show the state machine endpoint
    const batch2 = await db_.manufacturingBatch.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "BATCH-CH-002" } },
      update: { status: "READY_FOR_REVIEW", startedAt: new Date("2025-05-01"), completedAt: new Date("2025-05-05"), actualQuantity: "200" },
      create: { code: "BATCH-CH-002", workOrderId: wo.id, productRevisionId: effRev.id, siteId: chSite.id, plannedQuantity: "200", unit: "pcs", actualQuantity: "200", status: "READY_FOR_REVIEW", startedAt: new Date("2025-05-01"), completedAt: new Date("2025-05-05"), isDemo: true },
    });
    await db_.deviceLot.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "DL-CH-003" } },
      update: {},
      create: { code: "DL-CH-003", batchId: batch2.id, siteId: chSite.id, quantity: "200", unit: "pcs", status: "COMPLETED", isDemo: true },
    });

    // Work Order at TN site (PLANNED)
    const tnSite = siteByCode["DEMO-TN-01"];
    await db_.workOrder.upsert({
      where: { siteId_code: { siteId: tnSite.id, code: "WO-TN-001" } },
      update: { status: "PLANNED" },
      create: { code: "WO-TN-001", productRevisionId: effRev.id, siteId: tnSite.id, plannedQuantity: "1000", unit: "pcs", status: "PLANNED", isDemo: true },
    });

    console.log(`  work orders: 2 (WO-CH-001 IN_PRODUCTION, WO-TN-001 PLANNED)`);
    console.log(`  batches: 2 (BATCH-CH-001 IN_PRODUCTION, BATCH-CH-002 READY_FOR_REVIEW)`);
    console.log(`  device lots: 3, consumptions: 1, executions: 1, scraps: 1`);
  }

  await db_.auditEvent.create({ data: { action: "system.seed.production", entityType: "System", entityId: "seed-p3", outcome: "SUCCESS", reason: "Phase 3 synthetic DEMO seed applied", newState: { workCenters: Object.keys(wcByCode).length } } });
  console.log("  audit: phase3 seed-run event recorded");
}

// Phase 4: Quality foundation seed (synthetic DEMO/TEST).
// NCR against a batch, Investigation (concluded), CAPA (with investigation), CAPA (without investigation, NCR-sourced),
// Deviation (review), Change Control (approval), Risk Assessment. All isDemo=true.
async function seedQuality(siteByCode: Record<string, Site>) {
  console.log("Seeding Phase 4 quality DEMO data...");
  const db_ = db;
  const chSite = siteByCode["DEMO-CH-01"];

  // Find a batch at CH site to link the NCR to
  const batch = await db_.manufacturingBatch.findFirst({ where: { siteId: chSite.id } });
  if (!batch) { console.log("  (skipped: no batch found at CH site)"); return; }

  // NCR against the batch (CRITICAL, INVESTIGATION)
  const ncr = await db_.nCR.upsert({
    where: { siteId_code: { siteId: chSite.id, code: "NCR-CH-001" } },
    update: { status: "INVESTIGATION", severity: "CRITICAL" },
    create: { code: "NCR-CH-001", siteId: chSite.id, concernsEntityType: "BATCH", concernsEntityId: batch.id, description: "Demo: dimensional nonconformance found in batch (DEMO/TEST)", severity: "CRITICAL", status: "INVESTIGATION", isDemo: true },
  });

  // Investigation linked to the NCR (CONCLUDED)
  const inv = await db_.investigation.upsert({
    where: { siteId_code: { siteId: chSite.id, code: "INV-CH-001" } },
    update: { status: "CONCLUDED", sourceNcrId: ncr.id },
    create: { code: "INV-CH-001", siteId: chSite.id, sourceType: "NCR", sourceNcrId: ncr.id, methodology: "5-Why analysis (DEMO)", findings: "Molding temperature drift caused dimensional variation (DEMO)", rootCause: "Thermocouple calibration drift on molding station (DEMO)", status: "CONCLUDED", concludedAt: new Date(), isDemo: true },
  });
  // Link the NCR to the investigation
  await db_.nCR.update({ where: { id: ncr.id }, data: { investigationId: inv.id } });

  // CAPA #1: from the Investigation (IMPLEMENTATION)
  await db_.cAPA.upsert({
    where: { siteId_code: { siteId: chSite.id, code: "CAPA-CH-001" } },
    update: { status: "IMPLEMENTATION" },
    create: { code: "CAPA-CH-001", siteId: chSite.id, sourceType: "INVESTIGATION", sourceId: inv.id, investigationId: inv.id, type: "CORRECTIVE", actionPlan: "Recalibrate thermocouple and add daily verification check (DEMO)", status: "IMPLEMENTATION", isDemo: true },
  });

  // CAPA #2: NCR-sourced, WITHOUT an Investigation (D2 modification: CAPA does not hard-require Investigation)
  await db_.cAPA.upsert({
    where: { siteId_code: { siteId: chSite.id, code: "CAPA-CH-002" } },
    update: { status: "ACTION_PLAN" },
    create: { code: "CAPA-CH-002", siteId: chSite.id, sourceType: "NCR", sourceId: ncr.id, investigationId: null, type: "PREVENTIVE", actionPlan: "Add in-process dimensional check at start of shift (DEMO)", status: "ACTION_PLAN", isDemo: true },
  });

  // Deviation (REVIEW) for a substitute material
  const material = await db_.material.findFirst();
  if (material) {
    await db_.deviation.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "DEV-CH-001" } },
      update: { status: "REVIEW" },
      create: { code: "DEV-CH-001", siteId: chSite.id, appliesToEntityType: "BOM", appliesToEntityId: material.id, description: "Demo: use alternate material due to supplier shortage (DEMO)", justification: "Approved alternate with equivalent specs (DEMO)", impactAssessment: "No quality impact; alternate is equivalent (DEMO)", status: "REVIEW", validFrom: new Date(), validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), isDemo: true },
    });
  }

  // Change Control (APPROVAL)
  await db_.changeControl.upsert({
    where: { siteId_code: { siteId: chSite.id, code: "CHG-CH-001" } },
    update: { status: "APPROVAL" },
    create: { code: "CHG-CH-001", siteId: chSite.id, changeType: "PROCESS", description: "Demo: update molding temperature setpoint (DEMO)", reason: "Optimize cycle time (DEMO)", impactAssessment: "Requires re-qualification of molding process (DEMO)", status: "APPROVAL", isDemo: true },
  });

  // Risk Assessment
  const product = await db_.product.findFirst();
  if (product) {
    await db_.riskAssessment.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "RISK-CH-001" } },
      update: {},
      create: { code: "RISK-CH-001", siteId: chSite.id, subjectType: "PRODUCT", subjectId: product.id, hazard: "Demo: biocompatibility incompatibility (DEMO)", severity: 4, probability: 2, riskPriorityNumber: 8, mitigations: "Biocompatibility testing per ISO 10993 (DEMO)", status: "MITIGATED", isDemo: true },
    });
  }

  await db_.auditEvent.create({ data: { action: "system.seed.quality", entityType: "System", entityId: "seed-p4", outcome: "SUCCESS", reason: "Phase 4 synthetic DEMO seed applied", newState: { ncrs: 1, capas: 2 } } });
  console.log("  NCR: 1 (CRITICAL, INVESTIGATION), Investigation: 1 (CONCLUDED)");
  console.log("  CAPA: 2 (1 with investigation, 1 NCR-sourced without investigation [D2 mod])");
  console.log("  Deviation: 1 (REVIEW), Change: 1 (APPROVAL), Risk: 1 (RPN=8)");
  console.log("  audit: phase4 seed-run event recorded");
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

  // 9. Phase 3: Production execution (synthetic DEMO/TEST).
  await seedProduction(siteByCode);

  // 10. Phase 4: Quality foundation (synthetic DEMO/TEST).
  await seedQuality(siteByCode);

  // 11. Phase 5: Laboratory/Inspection (synthetic DEMO/TEST).
  await seedLaboratory(siteByCode);

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

// Phase 5: Laboratory/Inspection seed (synthetic DEMO/TEST).
async function seedLaboratory(siteByCode: Record<string, Site>) {
  console.log("Seeding Phase 5 laboratory DEMO data...");
  const db_ = db;
  const chSite = siteByCode["DEMO-CH-01"];

  // Specifications (EFFECTIVE)
  const specs = [
    { code: "SPEC-DEMO-001", name: "Tensile Strength", parameter: "Tensile Strength", unit: "MPa", criterionType: "NUMERIC_MIN", criterionValue: ">= 50" },
    { code: "SPEC-DEMO-002", name: "Dimensional Tolerance", parameter: "Diameter", unit: "mm", criterionType: "NUMERIC_RANGE", criterionValue: "9.9-10.1" },
    { code: "SPEC-DEMO-003", name: "Visual Inspection", parameter: "Visual Appearance", unit: null, criterionType: "PASS_FAIL", criterionValue: "pass" },
    { code: "SPEC-DEMO-004", name: "Bioburden", parameter: "CFU Count", unit: "CFU", criterionType: "NUMERIC_MAX", criterionValue: "<= 100" },
  ];
  const specByCode: Record<string, { id: string; code: string }> = {};
  for (const s of specs) {
    const spec = await db_.specification.upsert({
      where: { code: s.code },
      update: { name: s.name, parameter: s.parameter, unit: s.unit, criterionType: s.criterionType, criterionValue: s.criterionValue, status: "EFFECTIVE", effectiveFrom: new Date("2025-01-01"), isDemo: true },
      create: { ...s, unit: s.unit ?? null, status: "EFFECTIVE", effectiveFrom: new Date("2025-01-01"), isDemo: true },
    });
    specByCode[s.code] = spec;
  }
  console.log(`  specifications: ${specs.length} (all EFFECTIVE)`);

  // Test Methods (EFFECTIVE) + links
  const methods = [
    { code: "TM-DEMO-001", name: "Tensile Test Method", description: "Tensile strength measurement (DEMO)", equipmentType: "Universal Testing Machine", specs: ["SPEC-DEMO-001"] },
    { code: "TM-DEMO-002", name: "Visual Inspection Method", description: "Visual appearance check (DEMO)", equipmentType: null, specs: ["SPEC-DEMO-003", "SPEC-DEMO-002"] },
  ];
  for (const m of methods) {
    const method = await db_.testMethod.upsert({
      where: { code: m.code },
      update: { name: m.name, description: m.description, equipmentType: m.equipmentType, status: "EFFECTIVE", isDemo: true },
      create: { code: m.code, name: m.name, description: m.description, equipmentType: m.equipmentType, status: "EFFECTIVE", isDemo: true },
    });
    for (const sc of m.specs) {
      await db_.testMethodSpec.upsert({
        where: { testMethodId_specificationId: { testMethodId: method.id, specificationId: specByCode[sc].id } },
        update: {},
        create: { testMethodId: method.id, specificationId: specByCode[sc].id },
      });
    }
  }
  console.log(`  test methods: ${methods.length} (EFFECTIVE, linked to specs)`);

  // Samples (from BATCH-CH-001)
  const batch = await db_.manufacturingBatch.findFirst({ where: { siteId: chSite.id } });
  if (batch) {
    const sample1 = await db_.sample.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "SMP-CH-001" } },
      update: { status: "IN_TEST", quantityCollected: "5", quantityRemaining: "3", unit: "pcs", isDemo: true },
      create: { code: "SMP-CH-001", siteId: chSite.id, sourceEntityType: "BATCH", sourceEntityId: batch.id, quantityCollected: "5", quantityConsumed: "2", quantityRemaining: "3", unit: "pcs", status: "IN_TEST", isDemo: true },
    });
    const sample2 = await db_.sample.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "SMP-CH-002" } },
      update: { status: "RECEIVED_IN_LAB", isDemo: true },
      create: { code: "SMP-CH-002", siteId: chSite.id, sourceEntityType: "BATCH", sourceEntityId: batch.id, quantityCollected: "3", quantityRemaining: "3", unit: "pcs", status: "RECEIVED_IN_LAB", isDemo: true },
    });

    // Test Results: one PASS (REVIEWED), one FAIL (RESULT_ENTERED, evaluated FAIL)
    await db_.testResult.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "TR-CH-001" } },
      update: { status: "REVIEWED", measuredValue: "55", evaluatedResult: "PASS", evaluatedAt: new Date() },
      create: { code: "TR-CH-001", siteId: chSite.id, sampleId: sample1.id, testMethodId: null, specificationId: specByCode["SPEC-DEMO-001"].id, measuredValue: "55", unit: "MPa", evaluatedResult: "PASS", evaluatedAt: new Date(), evaluationLogic: "auto-eval-v1: NUMERIC_MIN >= 50", status: "REVIEWED", isDemo: true },
    });
    // NCR for the failed result
    const ncr = await db_.nCR.findFirst({ where: { siteId: chSite.id } });
    await db_.testResult.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "TR-CH-002" } },
      update: { status: "RESULT_ENTERED", measuredValue: "8", evaluatedResult: "FAIL" },
      create: { code: "TR-CH-002", siteId: chSite.id, sampleId: sample2.id, testMethodId: null, specificationId: specByCode["SPEC-DEMO-002"].id, measuredValue: "8", unit: "mm", evaluatedResult: "FAIL", evaluatedAt: new Date(), evaluationLogic: "auto-eval-v1: NUMERIC_RANGE 9.9-10.1", status: "RESULT_ENTERED", ncrId: ncr?.id ?? null, isDemo: true },
    });
    console.log(`  samples: 2, test results: 2 (1 PASS REVIEWED, 1 FAIL RESULT_ENTERED -> NCR)`);
  }

  // Inspections: one PASSED, one FAILED
  if (batch) {
    await db_.inspection.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "INSP-CH-001" } },
      update: { status: "PASSED", evaluatedResult: "PASS" },
      create: { code: "INSP-CH-001", siteId: chSite.id, inspectionType: "IN_PROCESS", sourceEntityType: "BATCH", sourceEntityId: batch.id, specificationId: specByCode["SPEC-DEMO-003"].id, measuredValue: "pass", evaluatedResult: "PASS", status: "PASSED", isDemo: true },
    });
    const ncr = await db_.nCR.findFirst({ where: { siteId: chSite.id } });
    await db_.inspection.upsert({
      where: { siteId_code: { siteId: chSite.id, code: "INSP-CH-002" } },
      update: { status: "FAILED", evaluatedResult: "FAIL" },
      create: { code: "INSP-CH-002", siteId: chSite.id, inspectionType: "FINAL", sourceEntityType: "BATCH", sourceEntityId: batch.id, specificationId: specByCode["SPEC-DEMO-003"].id, measuredValue: "fail", evaluatedResult: "FAIL", status: "FAILED", ncrId: ncr?.id ?? null, isDemo: true },
    });
    console.log(`  inspections: 2 (1 PASSED, 1 FAILED -> NCR)`);
  }

  await db_.auditEvent.create({ data: { action: "system.seed.laboratory", entityType: "System", entityId: "seed-p5", outcome: "SUCCESS", reason: "Phase 5 synthetic DEMO seed applied", newState: { specs: specs.length } } });
  console.log("  audit: phase5 seed-run event recorded");
}
