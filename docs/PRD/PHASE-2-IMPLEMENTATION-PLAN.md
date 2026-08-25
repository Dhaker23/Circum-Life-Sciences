# CIRCUM — PHASE 2 DOMAIN & IMPLEMENTATION PLAN

> **Status:** WAITING FOR OWNER APPROVAL — DO NOT IMPLEMENT YET
> **Phase:** 2 — Product / Device / Product Revision / BOM / Material / Material Lot / Supplier
> **Predecessor:** Phase 1 (approved/closed). Builds on the Identity/Org/RBAC/Audit foundation.
> **Method:** `grill-with-docs` + `domain-modeling` + `codebase-design` → `to-spec` → `to-tickets` (planning only). Implementation gated on owner approval of this plan AND the domain decisions in §3.
> **Source of truth:** Circum Master PRD §5 (Manufacturing master data), §10 (Traceability genealogy), §2 (configurable, DEMO data only), §16 (Docs), §17 (Validation-minded), §19/§20 (Phase Gate/Report).
> **Scope rule (owner #5):** Phase 2 business master data ONLY. No Work Orders, Manufacturing Batches, Device Lots, Routing/Operations (Phase 3). No traceability execution, NCR, quality, lab, etc.

---

## 0. Reading guide

§1 Objectives. §2 PRD traceability. **§3 Domain model (the core of this plan) + 5 critical ambiguities requiring owner confirmation.** §4 Database schema (proposed, pending §3). §5 API design. §6 UI architecture. §7 Security/Audit. §8 Multi-site. §9 Testing. §10 Migration. §11 Skills. §12 Files. §13 Risks. §14 Dependencies. §15 Acceptance. §16 Test plan. §17 Open questions.

```
PHASE 2 PLAN STATUS: WAITING FOR OWNER APPROVAL (and §3 domain decisions)
```

---

## 1. Objectives

Phase 2 establishes the **manufacturing master-data foundation**: the catalog of what Circum makes (Product / Product Revision), what goes into it (BOM / Material / Material Lot), and who supplies it (Supplier). This is the input side of the traceability genealogy (PRD §10):

```
Customer/Project → Product → Revision → BOM → Material Lot → [Work Order → Batch/Device Lot → ... (Phase 3+)]
```

Phase 2 covers the bolded prefix. The schema must be designed so Phase 3 (Work Order → Batch/Device Lot) and Phase 4 (full genealogy) extend it without rework.

**Concrete objectives:**

1. **Product / Product Revision** — controlled catalog of manufactured items, with revision control (Draft → … → Effective → Superseded → Obsolete) mirroring the Document Control pattern (PRD §5/§4.1).
2. **BOM** — the controlled list of Materials (with quantities) for one unit of a Product Revision. Revision-locked (proposed, §3.2).
3. **Material / Material Lot** — input substances/components, with received lots tracked per Supplier through a quarantine→approve→use lifecycle (proposed, §3.3).
4. **Supplier** — external source of Materials, with qualification status (foundation for supplier quality, Phase 7).
5. **Traceability foundation** — every entity carries the controlled-record fields (unique ID, status, owner, evidence, audit trail) and the relationships needed for forward/backward genealogy (PRD §10).
6. **Multi-site ownership** — Products/Revisions/Suppliers are global (shared catalog); Material Lots are site-owned (physical inventory) (proposed, §3.4).
7. **Full RBAC + audit integration** — reuse the Phase 1 `can()` / `requirePermission` / `audit()` infrastructure; add `manufacturing.*` permissions; every create/update/state-transition audited.
8. **i18n** — all UI strings via catalogs (FR/EN/AR); no hard-coded strings.
9. **DEMO seed** — synthetic, clearly labelled, multi-site testable.

**Out of scope (Phase 3+):** Work Order, Routing, Operation, Manufacturing Batch, Device Lot, production execution, shifts, customer/project linkage, traceability *execution* (Phase 2 builds the *entities* genealogy will traverse, not the genealogy queries themselves).

---

## 2. Requirements (PRD traceability)

| # | Requirement | PRD § | Phase 2 coverage |
|---|---|---|---|
| R1 | Product / Device master (catalog of manufactured devices) | §5 | Product entity (Device = conceptual, §3.1) |
| R2 | Product Revision (controlled version of design/spec) | §5 | ProductRevision entity + state machine |
| R3 | BOM / Materials / Material Lots / Suppliers (controlled input genealogy) | §5 | BOM, BOMLine, Material, MaterialLot, Supplier |
| R4 | Traceability genealogy prefix: Product → Revision → BOM → Material Lot | §5, §10 | relationships wired (queries in Phase 4) |
| R5 | Sites/products/customers/.../capacities must be configurable; DEMO data labelled | §2 | configurable entities + DEMO seed |
| R6 | Every controlled record: unique ID, status, owner, evidence, audit trail, closure criteria | §5 | all Phase 2 entities carry these |
| R7 | DB constraints prevent duplicates, broken refs, impossible quantities/timestamps | §10, §11 | FKs, uniques, quantity>0 checks, state-machine guards |
| R8 | Normal users cannot edit/delete controlled audit history | §10, §13 | reuse Phase 1 audit (append-only triggers) |
| R9 | Layered architecture; critical logic not only in UI | §11 | modules/manufacturing/{api,service,domain,infrastructure} |
| R10 | Local-first | §12 | all local DB, no external deps |
| R11 | FR/EN/AR + RTL, no hard-coded strings | §4 | next-intl catalogs extended |
| R12 | Professional industrial UI | §14 | product/revision/BOM/material/lot/supplier pages |
| R13 | Phase Gate (§19) + Phase Validation Report (§20) | §19, §20 | full gate executed before sign-off |
| R14 | PostgreSQL-portable schema (ADR-0002) | §11, ADR-0002 | no SQLite-only types; PG migration path preserved |

---

## 3. Domain model (grill-with-docs + domain-modeling)

> This is the heart of Phase 2. Terms are extracted from the PRD (§5, §10) and sharpened via the `domain-modeling` discipline. **Where the PRD is silent on a precise boundary, the resolution is marked PROPOSED and requires owner confirmation (§3.6).** Nothing is invented; every proposal traces to a PRD concept.

### 3.1 Product vs Device (PROPOSED — owner confirmation required)

**PRD evidence:** §5 "product/device master"; §5 "manufacturing batches/device lots"; §10 "Product → Revision → BOM → … → Batch/Device Lot".

**Ambiguity:** Is "Device" a separate master-data entity, a subtype of Product, or conceptual terminology?

**Proposed resolution:** **Product** is the master-data entity (the catalog type Circum produces). **Device** is **not a separate table** — it is conceptual terminology for a *finished unit* of a Product. "Device Lot" (Phase 3) is a traceable batch of finished Product units. Rationale:
- The PRD treats "product/device master" as one catalog (singular "master").
- A medical device is a Product with a regulated classification; the regulation applies to the Product's design (via Revision), not to a separate Device entity.
- Keeping one `Product` table with a `productType`/`deviceClass` field (e.g., `deviceClass: "IIa" | "IIb" | "III" | "non-device"`) captures regulatory classification without a redundant entity.
- This avoids a 1:1 Product↔Device split that would double every relationship.

**If the owner disagrees:** alternative is a `Device` entity as a subtype (Product has-one Device profile). This is heavier but some QMS systems separate them. **Please confirm.**

### 3.2 BOM revision & effectivity (PROPOSED — owner confirmation required)

**PRD evidence:** §10 "Revision → BOM" (BOM sits under Revision); CONTEXT.md "A Revision carries its own BOM and routing."

**Ambiguity:** Is the BOM 1:1 with a Product Revision (immutable once Effective), or independently versioned with its own effectivity dates?

**Proposed resolution:** A **Product Revision** has exactly **one BOM** (1:1). The BOM is part of the controlled Revision:
- A BOM is `DRAFT` while its Revision is `DRAFT`/`IN_REVIEW`.
- When the Revision becomes `EFFECTIVE`, the BOM is frozen (immutable).
- Any change to an Effective BOM requires a **new Product Revision** (via Change Control, Phase 7). The old Revision becomes `SUPERSEDED`.
- This is the **strictest, most traceable** model. It matches "Revision carries its own BOM" and the PRD priority (Traceability > Operational Efficiency). A BOM is never edited in place once Effective.

**Rationale:** In medical-device manufacturing, a BOM change is a design change → new revision → re-validation impact. Allowing in-place BOM edits would break genealogy (which Revision's BOM produced which Lot?).

**If the owner needs flexibility:** alternative is BOM with its own `version` + `effectiveFrom`/`effectiveTo`, linked to a Revision with a many-to-one. Weaker traceability; I do **not** recommend this for a regulated device QMS. **Please confirm the strict 1:1.**

### 3.3 Material Lot lifecycle (PROPOSED — owner confirmation required)

**PRD evidence:** §5 "BOM/materials, suppliers"; §10 "Material Lot" in the genealogy. PRD is silent on the lot status machine.

**Proposed resolution (standard GxP material lot lifecycle):**
```
RECEIVED → QUARANTINE → APPROVED → IN_USE → EXHAUSTED
                ↓
            REJECTED            (terminal)
```
- `RECEIVED`: lot logged at goods-in (not yet usable).
- `QUARANTINE`: pending QA inspection (not usable in production).
- `APPROVED`: QA released for use (usable).
- `IN_USE`: allocated/consumed by a Work Order (Phase 3; in Phase 2 the lot can be marked IN_USE manually or stay APPROVED).
- `EXHAUSTED`: quantity fully consumed (terminal).
- `REJECTED`: QA rejected (terminal; disposition via NCR in Phase 6).

**Quantity tracking:** a Material Lot has `quantityReceived`, `quantityAvailable` (decremented on consumption in Phase 3), `unit`. Phase 2 tracks received/available; consumption is Phase 3.

### 3.4 Multi-site ownership (PROPOSED — owner confirmation required)

**PRD evidence:** §2 "vertically integrated CDMO" (CH/FR/TN); §3 RBAC site scoping; §10 genealogy crosses sites implicitly.

**Ambiguity:** Are Products/Revisions/Suppliers global or site-owned? Can a Material Lot exist at multiple sites?

**Proposed resolution:**
- **Product, ProductRevision, Supplier: GLOBAL** (no siteId). They are design/catalog/procurement data shared across sites — a device design is the same whether manufactured in CH or TN; a Supplier supplies all sites. This matches the PRD's multi-site CDMO model where the same product can be made at multiple sites.
- **Material, BOM, BOMLine: GLOBAL** (derived from Product/Revision, which are global).
- **MaterialLot: SITE-OWNED** (`siteId` required). A lot physically exists at one site (goods-in, quarantine, storage are physical). Transfer between sites is a Phase 13 logistics feature (not Phase 2).
- This means Phase 2 multi-site isolation applies to **MaterialLot** (site-scoped queries) but not to Product/Revision/Supplier (global reads). The Phase 1 `SiteScope` + `assertSiteAccess` infrastructure is reused for MaterialLot.

**If the owner wants site-owned Products:** alternative is Product with `siteId` (each site defines its own products). This fragments the catalog and complicates "same product, multiple sites." I do not recommend it. **Please confirm global Products + site-owned MaterialLots.**

### 3.5 Supplier–Material relationship (PROPOSED — owner confirmation required)

**PRD evidence:** §5 "suppliers" alongside "materials"; §10 "Material Lot → …" (lot comes from a supplier).

**Proposed resolution:**
- A **Material** can be sourced from **many Suppliers** (many-to-many via `MaterialSupplier`, with a `isPreferred` flag and optional `supplierPartCode`). A Material has at least one Supplier.
- A **MaterialLot** comes from **exactly one Supplier** (`supplierId` required). This is the procurement record.
- A **Supplier** has a `qualificationStatus`: `APPROVED | CONDITIONAL | DISQUALIFIED` (foundation for supplier quality, Phase 7). Phase 2 tracks status; full supplier quality (audits, scoring) is Phase 7.

### 3.6 Summary of proposed domain decisions (all require owner confirmation)

| # | Decision | Proposed | Alternative | Recommendation |
|---|---|---|---|---|
| D1 | Product vs Device | Device = conceptual (finished unit), not a table; Product has `deviceClass` field | Device as subtype entity | **Proposed** (cleaner, matches "product/device master") |
| D2 | BOM revision/effectivity | BOM 1:1 with ProductRevision, frozen when Effective; changes → new Revision | BOM independently versioned | **Proposed** (strictest traceability) |
| D3 | Material Lot lifecycle | RECEIVED→QUARANTINE→APPROVED→IN_USE→EXHAUSTED, +REJECTED | Simpler (active/inactive) | **Proposed** (standard GxP) |
| D4 | Multi-site ownership | Product/Revision/Supplier/Material/BOM global; MaterialLot site-owned | Product site-owned | **Proposed** (matches CDMO model) |
| D5 | Supplier–Material | Material M:N Supplier (preferred flag); MaterialLot 1:1 Supplier | Material 1:1 Supplier | **Proposed** (flexible procurement) |

**If any of D1–D5 is not confirmed, the schema in §4 cannot be finalized.** I will NOT implement until these are resolved.

### 3.7 Entity definitions (assuming D1–D5 as proposed)

- **Product** — a manufactured item type (medical device or other). Global. Fields: `code` (unique), `name`, `description`, `productType` (DEVICE / COMPONENT / OTHER), `deviceClass` (if DEVICE: Class I/IIa/IIb/III; regulatory, configurable), `status` (DRAFT/ACTIVE/INACTIVE), `isDemo`. Has many ProductRevisions.
- **ProductRevision** — a controlled version of a Product's design/spec. Global. Fields: `revisionCode` (e.g., "REV-A"), `productId`, `description`, `status` (DRAFT→IN_REVIEW→APPROVED→EFFECTIVE→SUPERSEDED→OBSOLETE), `effectiveFrom`, `supersededById` (self-ref for the chain), `isDemo`. Has one BOM. (Routing is Phase 3.)
- **BOM** — the controlled material list for one ProductRevision. 1:1 with ProductRevision. Fields: `productRevisionId` (unique), `status` (mirrors revision), `version` (always 1 per revision under D2). Has many BOMLines.
- **BOMLine** — one line of a BOM. Fields: `bomId`, `materialId`, `quantity` (Decimal, >0), `unit`, `sequence` (order), `notes`, optional `substituteMaterialId`. 
- **Material** — a physical input substance/component. Global. Fields: `code` (unique), `name`, `description`, `materialType` (RAW / COMPONENT / PACKAGING / CONSUMABLE), `defaultUnit`, `status`, `isDemo`. Has many MaterialLots; M:N Suppliers.
- **MaterialSupplier** — join: Material ↔ Supplier, with `isPreferred`, `supplierPartCode`.
- **MaterialLot** — a received batch of a Material from a Supplier, at a Site. Fields: `lotCode` (unique per site), `materialId`, `supplierId`, `siteId`, `quantityReceived`, `quantityAvailable`, `unit`, `status` (RECEIVED/QUARANTINE/APPROVED/IN_USE/EXHAUSTED/REJECTED), `receivedAt`, `expiryDate?`, `certificateOfAnalysis?` (doc ref, Phase 7), `isDemo`. Site-owned (multi-site isolation applies).
- **Supplier** — external source of Materials. Global. Fields: `code` (unique), `name`, `qualificationStatus` (APPROVED/CONDITIONAL/DISQUALIFIED), `contact?`, `status`, `isDemo`.

**State machines:**
- ProductRevision: `DRAFT → IN_REVIEW → APPROVED → EFFECTIVE → SUPERSEDED → OBSOLETE` (mirrors Document Control, PRD §4.1; SUPERSEDED is reached when a newer Revision becomes EFFECTIVE).
- MaterialLot: `RECEIVED → QUARANTINE → APPROVED → IN_USE → EXHAUSTED`; `QUARANTINE → REJECTED` (terminal); `APPROVED → QUARANTINE` (return to quarantine if an issue is found — reversible QA decision).
- Product: `DRAFT → ACTIVE → INACTIVE` (simple lifecycle; a Product is ACTIVE when it has at least one EFFECTIVE Revision).
- Supplier: `qualificationStatus` is a status field, not a strict state machine (APPROVED/CONDITIONAL/DISQUALIFIED, freely set by authorized QA).

---

## 4. Database schema (proposed, pending §3 confirmation)

PG-portable Prisma additions to the Phase 1 schema. Decimal quantities use Prisma `Decimal` (PG `numeric`; SQLite stores as text but Prisma handles it). No SQLite-only types.

```prisma
// ============================================================================
// Manufacturing master data (Phase 2)
// ============================================================================

model Product {
  id          String   @id @default(cuid())
  code        String   @unique              // e.g. "DEV-001"
  name        String
  description String?
  productType String                         // DEVICE | COMPONENT | OTHER
  deviceClass String?                        // if DEVICE: I | IIa | IIb | III  (configurable, regulatory)
  status      String   @default("DRAFT")     // DRAFT | ACTIVE | INACTIVE
  isDemo      Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  revisions ProductRevision[]

  @@index([status])
  @@index([productType])
}

model ProductRevision {
  id             String   @id @default(cuid())
  productId      String
  revisionCode   String                        // e.g. "REV-A"
  description    String?
  status         String   @default("DRAFT")    // DRAFT | IN_REVIEW | APPROVED | EFFECTIVE | SUPERSEDED | OBSOLETE
  effectiveFrom  DateTime?
  supersededById String?                       // self-ref to the newer revision
  isDemo         Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  product       Product         @relation(fields: [productId], references: [id], onDelete: Restrict)
  supersededBy  ProductRevision? @relation("RevisionSupersession", fields: [supersededById], references: [id], onDelete: NoAction)
  bom           BOM?
  supersededByThis ProductRevision[] @relation("RevisionSupersession")

  @@unique([productId, revisionCode])
  @@index([productId])
  @@index([status])
}

model BOM {
  id                String   @id @default(cuid())
  productRevisionId String   @unique          // 1:1 with ProductRevision (D2)
  status            String   @default("DRAFT") // mirrors revision status
  version           Int      @default(1)       // always 1 per revision under D2
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  productRevision ProductRevision @relation(fields: [productRevisionId], references: [id], onDelete: Cascade)
  lines           BOMLine[]

  @@index([status])
}

model BOMLine {
  id                    String  @id @default(cuid())
  bomId                 String
  materialId            String
  quantity              Decimal                          // >0 (zod + service check)
  unit                  String
  sequence              Int     @default(0)
  notes                 String?
  substituteMaterialId  String?

  bom                 BOM       @relation(fields: [bomId], references: [id], onDelete: Cascade)
  material            Material  @relation(fields: [materialId], references: [id], onDelete: Restrict)
  substituteMaterial  Material? @relation("BOMLineSubstitute", fields: [substituteMaterialId], references: [id], onDelete: SetNull)

  @@unique([bomId, materialId])
  @@index([bomId])
  @@index([materialId])
}

model Material {
  id           String   @id @default(cuid())
  code         String   @unique
  name         String
  description  String?
  materialType String                          // RAW | COMPONENT | PACKAGING | CONSUMABLE
  defaultUnit  String
  status       String   @default("ACTIVE")     // ACTIVE | INACTIVE
  isDemo       Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  lots        MaterialLot[]
  bomLines    BOMLine[]
  substitutes BOMLine[]  @relation("BOMLineSubstitute")
  suppliers   MaterialSupplier[]

  @@index([status])
  @@index([materialType])
}

model MaterialSupplier {
  materialId       String
  supplierId       String
  isPreferred      Boolean  @default(false)
  supplierPartCode String?
  createdAt        DateTime @default(now())

  material Material @relation(fields: [materialId], references: [id], onDelete: Cascade)
  supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Cascade)

  @@id([materialId, supplierId])
  @@index([supplierId])
}

model MaterialLot {
  id               String   @id @default(cuid())
  lotCode          String                        // unique per site
  materialId       String
  supplierId       String
  siteId           String                        // SITE-OWNED (D4)
  quantityReceived Decimal
  quantityAvailable Decimal
  unit             String
  status           String   @default("RECEIVED") // RECEIVED | QUARANTINE | APPROVED | IN_USE | EXHAUSTED | REJECTED
  receivedAt       DateTime @default(now())
  expiryDate       DateTime?
  certificateOfAnalysis String?                  // doc ref (Phase 7: full doc control)
  isDemo           Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  material Material @relation(fields: [materialId], references: [id], onDelete: Restrict)
  supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  site     Site     @relation(fields: [siteId], references: [id], onDelete: Restrict)

  @@unique([siteId, lotCode])
  @@index([materialId])
  @@index([supplierId])
  @@index([siteId])
  @@index([status])
}

model Supplier {
  id                  String   @id @default(cuid())
  code                String   @unique
  name                String
  qualificationStatus String   @default("CONDITIONAL") // APPROVED | CONDITIONAL | DISQUALIFIED
  contact             String?
  status              String   @default("ACTIVE")      // ACTIVE | INACTIVE
  isDemo              Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  lots       MaterialLot[]
  materials  MaterialSupplier[]

  @@index([qualificationStatus])
}
```

**Constraints of note:**
- `ProductRevision(productId, revisionCode)` unique — no duplicate revision codes per product.
- `BOM.productRevisionId` unique — enforces 1:1 (D2).
- `BOMLine(bomId, materialId)` unique — no duplicate material per BOM.
- `MaterialLot(siteId, lotCode)` unique — lot code unique per site (D4).
- `quantity > 0` enforced in zod + service (Prisma can't express check constraints portably; PG migration will add `CHECK`).
- `MaterialLot.quantityAvailable <= quantityReceived` enforced in service (prevents over-consumption; critical for data integrity, PRD §10).
- All `onDelete` rules chosen to prevent breaking references (Restrict for controlled records, Cascade for children like BOMLine under BOM).

---

## 5. API design

Thin route handlers, zod-validated, envelope, RBAC-guarded (reuse Phase 1 `requirePermission`). New permission module `manufacturing`.

```
GET    /api/manufacturing/products                 (list, paginated, filter by type/status)
POST   /api/manufacturing/products                  (create)
GET    /api/manufacturing/products/:id
PATCH  /api/manufacturing/products/:id
GET    /api/manufacturing/products/:id/revisions
POST   /api/manufacturing/products/:id/revisions    (create revision)
GET    /api/manufacturing/revisions/:id
PATCH  /api/manufacturing/revisions/:id             (update draft; state transition)
POST   /api/manufacturing/revisions/:id/transition  (DRAFT→IN_REVIEW→APPROVED→EFFECTIVE; audited)
GET    /api/manufacturing/revisions/:id/bom
PUT    /api/manufacturing/revisions/:id/bom         (replace BOM lines while DRAFT only)
POST   /api/manufacturing/revisions/:id/bom/lines
PATCH  /api/manufacturing/bom-lines/:id
DELETE /api/manufacturing/bom-lines/:id

GET    /api/manufacturing/materials
POST   /api/manufacturing/materials
GET    /api/manufacturing/materials/:id
PATCH  /api/manufacturing/materials/:id
GET    /api/manufacturing/materials/:id/lots
POST   /api/manufacturing/materials/:id/suppliers   (link supplier)

GET    /api/manufacturing/material-lots             (SITE-SCOPED; multi-site isolation)
POST   /api/manufacturing/material-lots             (receive a lot)
GET    /api/manufacturing/material-lots/:id
PATCH  /api/manufacturing/material-lots/:id
POST   /api/manufacturing/material-lots/:id/transition  (RECEIVED→QUARANTINE→APPROVED→...; audited)

GET    /api/manufacturing/suppliers
POST   /api/manufacturing/suppliers
GET    /api/manufacturing/suppliers/:id
PATCH  /api/manufacturing/suppliers/:id
```

**State transitions** are explicit `POST .../transition` endpoints (not PATCH status) so each transition is auditable with a reason. A transition validates: current state → allowed next state + caller authorization. Matches the controlled-workflow pattern (PRD §9, GLM §9).

**BOM immutability (D2):** `PUT/PATCH/DELETE` on BOM/BOMLine is rejected unless the parent ProductRevision is `DRAFT` or `IN_REVIEW`. Once `APPROVED`/`EFFECTIVE`, the BOM is frozen; service throws `StateTransitionError`.

---

## 6. UI architecture

New pages under `[locale]/(app)/manufacturing/`:
- `products/` — product list (filter by type/status), create dialog, detail (revisions tab).
- `products/[id]/revisions/` — revision list, create, state-transition buttons.
- `products/[id]/revisions/[revId]/bom/` — BOM editor (lines table; editable only in DRAFT/IN_REVIEW; read-only when Effective, with a "frozen" badge).
- `materials/` — material list + detail (lots tab, suppliers tab).
- `material-lots/` — lot list (site-scoped; site switcher), receive-lot dialog, state-transition buttons.
- `suppliers/` — supplier list + detail (qualification status).

**Nav:** add a "Manufacturing" group to the sidebar with Products / Materials / Material Lots / Suppliers items, permission-gated (`manufacturing.product.read`, etc.).

**i18n:** extend `messages/{en,fr,ar}.json` with `manufacturing.*` keys. RTL-safe (logical properties).

**Demo seed:** add to `prisma/seed.ts`: 3-4 demo Products (mix of DEVICE IIa/IIb + COMPONENT), each with 2 Revisions (one EFFECTIVE, one DRAFT), a BOM with 3-4 lines, 5-6 Materials, 3 Suppliers, and demo Material Lots at each site (CH/TN/FR) in various statuses (QUARANTINE, APPROVED, EXHAUSTED). All `isDemo: true`.

---

## 7. Security & audit

- **Permissions:** new catalog entries: `manufacturing.product.{read,create,update}`, `manufacturing.revision.{read,create,update,transition}`, `manufacturing.bom.{read,update}`, `manufacturing.material.{read,create,update}`, `manufacturing.materiallot.{read,create,update,transition}`, `manufacturing.supplier.{read,create,update}`. Granted to relevant roles per an updated RBAC matrix (e.g., Production Manager + Quality Manager + Site Admin read; Production Planner creates; QA transitions MaterialLot). **Least-privilege, no broad perms.**
- **3-layer enforcement** (reuse Phase 1): UI nav-hiding / middleware+API `requirePermission` / service-layer `can()`.
- **Audit:** every create/update/state-transition emits an `AuditEvent` (e.g., `manufacturing.revision.transition`, `manufacturing.materiallot.transition`) with previousState/newState + reason. Denied attempts audited.
- **Controlled-record fields:** all Phase 2 entities carry status + createdAt/updatedAt + isDemo; transitions record actor + timestamp + reason.
- **BOM immutability** enforced in service (D2) + audited if attempted.

---

## 8. Multi-site isolation

- **MaterialLot is the only site-scoped Phase 2 entity** (D4). Its repository queries use `siteIdFilter(ctx)` (Phase 1 `SiteScope`). A user scoped to Site A sees only Site A's lots.
- **Product/Revision/Material/Supplier are global** — readable by any authenticated user with the `manufacturing.*.read` permission (no site filter). This is deliberate (D4): the catalog is shared.
- **MaterialLot create/transition** requires `assertSiteAccess(ctx, lot.siteId)` — a user cannot create or transition a lot at a site they're not scoped to.
- **Cross-site leakage remains a CRITICAL defect** (owner #4). Tests assert a Site-A user cannot list/get/transition a Site-B lot.

---

## 9. Testing

Reuse the Phase 1 Vitest + test-DB infrastructure. New tests:
- **Unit/domain:** ProductRevision state machine (valid/invalid transitions), MaterialLot state machine, BOM immutability guard (rejects edit when Effective), quantity invariants (available ≤ received, >0).
- **Integration/service:** create product → revision → BOM → lines; transition revision EFFECTIVE → BOM frozen; receive material lot → quarantine → approve; cross-site material lot isolation (Site A user can't see Site B lots).
- **API:** 401/403/400/409/422/200-201 for each endpoint; state-transition endpoint audited.
- **Critical (carried forward + new):**
  - T-ISOL-02: MaterialLot cross-site isolation (Site A user sees 0 Site B lots).
  - T-BOM-01: BOM edit rejected when revision is EFFECTIVE (immutability, D2).
  - T-REV-01: ProductRevision state machine enforces valid transitions (DRAFT→EFFECTIVE directly is rejected).
  - T-LOT-01: MaterialLot state machine (RECEIVED→APPROVED directly is rejected; must pass QUARANTINE).
  - T-QUANT-01: quantityAvailable cannot exceed quantityReceived.
- **E2E (Playwright):** add to the backlog (owner carry-forward #2) — product/revision/BOM/material/lot/supplier flows. Not blocking Phase 2 sign-off unless a critical defect is found.

---

## 10. Migration strategy

- **Schema:** additive Prisma migration (`phase2_manufacturing`) on top of Phase 1. No changes to Phase 1 tables. `prisma migrate dev --name phase2_manufacturing`.
- **Seed:** extend `prisma/seed.ts` with Phase 2 demo data (idempotent upserts). Re-run `bun run db:seed`.
- **PostgreSQL (ADR-0002):** schema is PG-portable. `Decimal` becomes `numeric`, enums stay strings+zod. When PG lands, the migration applies clean + RLS policies added for MaterialLot (site-scoping hardening, owner #4).
- **No data loss:** Phase 1 data preserved; Phase 2 adds tables + demo rows.

---

## 11. Matt Pocock skills to use

| Activity | Skill | Why |
|---|---|---|
| Resolve D1–D5 ambiguities | `grill-with-docs` (→ `grilling` + `domain-modeling`) | sharpen terms before schema; this plan IS the grilled output |
| Maintain CONTEXT.md / DOMAIN_GLOSSARY.md | `domain-modeling` | update glossary with resolved Phase 2 terms |
| Design the manufacturing module seams | `codebase-design` | deep modules; BOM/revision logic in service, not UI |
| Turn this plan into a spec | `to-spec` | `.scratch/phase-2/spec.md` |
| Break into tickets | `to-tickets` | `.scratch/phase-2/issues/NN-*.md` |
| Implement (after approval) | `tdd` + `implement` | red→green→refactor; state machines are TDD-friendly |
| Debug any hard issue | `diagnosing-bugs` | reproduce→minimise→hypothesise→fix |
| Phase gate quality | `code-review` | Standards + Spec axes |

**Not used:** `wayfinder` (Phase 2 is single-session), `prototype`/`wizard`/`research` (not needed). Skills never override the PRD (ADR-0001).

---

## 12. Files / modules to change (after approval)

**New:**
- `src/modules/manufacturing/{domain,service,infrastructure}/...` (Product, ProductRevision, BOM, BOMLine, Material, MaterialSupplier, MaterialLot, Supplier services + repos with SiteScope + can() + audit)
- `src/app/api/manufacturing/**` (route handlers)
- `src/app/[locale]/(app)/manufacturing/{products,revisions,bom,materials,material-lots,suppliers}/page.tsx`
- `src/components/app/manufacturing/*.tsx` (tables, editors, state-transition dialogs)
- `src/lib/permissions.ts` — add `manufacturing.*` permissions + grants
- `src/messages/{en,fr,ar}.json` — add `manufacturing.*` keys
- `prisma/schema.prisma` — Phase 2 models (§4)
- `prisma/migrations/<ts>_phase2_manufacturing/migration.sql`
- `prisma/seed.ts` — Phase 2 demo data
- `docs/adr/0006-bom-revision-effectivity.md` (records D2 decision)
- `docs/adr/0007-multi-site-ownership-model.md` (records D4 decision)
- `docs/api/manufacturing.md`
- `.scratch/phase-2/{spec.md,issues/NN-*.md}`

**Modified:** `src/components/app/app-sidebar.tsx` (add Manufacturing nav group), `src/lib/permissions.ts` (catalog + grants), `docs/architecture/rbac-matrix.md` (add manufacturing permissions), `CONTEXT.md` + `DOMAIN_GLOSSARY.md` (Phase 2 terms).

---

## 13. Risks

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| P2-R1 | D1–D5 unconfirmed → schema blocked | H | Critical | this plan flags them; NO implementation until confirmed |
| P2-R2 | BOM effectivity (D2) too strict, blocks future flexibility | M | M | strict is safest; a new Revision always allows change; revisit only if a real workflow needs in-place edits (via Change Control) |
| P2-R3 | MaterialLot quantity drift (available ≠ received − consumed) | M | High | service enforces invariant + transactional updates; Phase 3 consumption also transactional |
| P2-R4 | Decimal precision on SQLite (text storage) | L | M | Prisma handles; PG `numeric` is exact; no float usage |
| P2-R5 | Global Products readable cross-site leaks catalog | L | L | catalog is non-sensitive (design data); MaterialLot is the sensitive scoped entity |
| P2-R6 | Revision supersession chain corruption | M | M | `supersededById` self-ref + service enforces only one EFFECTIVE revision per product at a time |
| P2-R7 | BOMLine substitute creates circular/invalid refs | L | L | service validates substitute ≠ material + substitute is ACTIVE |
| P2-R8 | Owner wants Customer/Project linkage now | L | M | out of Phase 2 scope (owner list); note for future |

---

## 14. Dependencies

- **No new runtime deps.** Phase 2 reuses the Phase 1 stack (Prisma, zod, next-auth, react-hook-form, TanStack Query/Table, shadcn/ui).
- **Phase 1 foundation required:** `can()`, `requirePermission`, `audit()`, `SiteScope`, `assertSiteAccess`, the API envelope, the test-DB harness. All present.
- **Demo seed extends Phase 1 seed** (sites/users already exist).

---

## 15. Acceptance criteria (definition of done)

Phase 2 is DONE only when ALL hold (PRD §19 Phase Gate):

1. Product/Revision/BOM/BOMLine/Material/MaterialSupplier/MaterialLot/Supplier entities exist with the §4 schema (after D1–D5 confirmation).
2. ProductRevision state machine (DRAFT→…→EFFECTIVE→SUPERSEDED→OBSOLETE) enforced + audited; BOM frozen when revision APPROVED/EFFECTIVE (D2).
3. MaterialLot state machine (RECEIVED→QUARANTINE→APPROVED→IN_USE→EXHAUSTED, +REJECTED) enforced + audited; quantity invariants hold.
4. MaterialLot is site-scoped: cross-site isolation tested (T-ISOL-02); a Site-A user sees 0 Site-B lots.
5. Every create/update/transition audited with previousState/newState + reason; denied attempts audited.
6. RBAC: `manufacturing.*` permissions enforced 3-layer; least-privilege grants; no broad admin perms.
7. i18n: all UI strings from catalogs; FR/EN/AR; RTL-safe.
8. Demo seed: synthetic, labelled DEMO/TEST, multi-site testable.
9. Tests: all Phase 1 tests still pass; new Phase 2 tests (T-ISOL-02, T-BOM-01, T-REV-01, T-LOT-01, T-QUANT-01 + unit/integration/API) pass.
10. Lint 0 errors; typecheck clean.
11. Browser-verified: create product → revision → BOM → receive material lot → transition lot; cross-site denial visible.
12. ADRs 0006 (BOM effectivity) + 0007 (multi-site ownership) written.
13. Phase 2 Validation Report produced (PRD §20); STOP; owner approval.

---

## 16. Test plan (summary)

| Layer | What | Critical tests |
|---|---|---|
| Unit | state machines, invariants, zod | T-REV-01, T-LOT-01, T-QUANT-01, T-BOM-01 |
| Integration | service flows against test DB | product→revision→BOM; lot receive→quarantine→approve |
| API | envelope, 401/403/400/409/422/200 | each endpoint |
| Authz | can() per role | Production Planner vs QA vs Operator on transitions |
| Multi-site | MaterialLot cross-site | T-ISOL-02 |
| Audit | every transition audited | T-AUDIT-03 (transition audit) |
| Regression | Phase 1 tests still pass | all 17 Phase 1 tests |

---

## 17. Open questions (require owner decision before implementation)

> **These are the 5 critical domain decisions from §3. I will NOT implement Phase 2 until these are confirmed.** Each has a proposed resolution (grounded in the PRD) and a recommendation.

- **D1 — Product vs Device:** confirm Device = conceptual (not a table); Product has `deviceClass` field? *(Recommendation: yes)*
- **D2 — BOM revision/effectivity:** confirm BOM 1:1 with ProductRevision, frozen when Effective; changes → new Revision? *(Recommendation: yes, strictest traceability)*
- **D3 — Material Lot lifecycle:** confirm RECEIVED→QUARANTINE→APPROVED→IN_USE→EXHAUSTED, +REJECTED? *(Recommendation: yes, standard GxP)*
- **D4 — Multi-site ownership:** confirm Product/Revision/Supplier/Material/BOM global; MaterialLot site-owned? *(Recommendation: yes, matches CDMO)*
- **D5 — Supplier–Material:** confirm Material M:N Supplier (preferred flag); MaterialLot 1:1 Supplier? *(Recommendation: yes)*

**Additional open questions (lower priority):**
- D6: Is `deviceClass` (I/IIa/IIb/III) a free string or a controlled enum? *(Recommendation: controlled enum, configurable list)*
- D7: Should Phase 2 include a basic MaterialLot → Certificate of Analysis document link, or defer to Phase 7 (Document Control)? *(Recommendation: defer; store a string ref only)*
- D8: Customer/Project linkage (PRD §10 genealogy starts with Customer/Project) — confirm out of Phase 2 scope? *(Recommendation: yes, future phase)*

---

```
PHASE 2 PLAN STATUS: WAITING FOR OWNER APPROVAL (and §3 / §17 domain decisions D1-D5)
```

**I am stopping here.** I will not implement Phase 2, will not create Phase 2 tickets under `.scratch/phase-2/` beyond this plan, and will not modify the schema until the owner (a) approves this plan and (b) confirms D1–D5. Awaiting your decisions.
