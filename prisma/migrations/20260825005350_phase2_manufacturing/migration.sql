-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'DEVICE',
    "deviceClass" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "revisionCode" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" DATETIME,
    "supersededById" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductRevision_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductRevision_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "ProductRevision" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BOM" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productRevisionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BOM_productRevisionId_fkey" FOREIGN KEY ("productRevisionId") REFERENCES "ProductRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BOMLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bomId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "substituteMaterialId" TEXT,
    CONSTRAINT "BOMLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BOM" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BOMLine_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BOMLine_substituteMaterialId_fkey" FOREIGN KEY ("substituteMaterialId") REFERENCES "Material" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "materialType" TEXT NOT NULL DEFAULT 'RAW',
    "defaultUnit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MaterialSupplier" (
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "supplierPartCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("materialId", "supplierId"),
    CONSTRAINT "MaterialSupplier_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotCode" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "quantityReceived" DECIMAL NOT NULL,
    "quantityAvailable" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" DATETIME,
    "certificateOfAnalysis" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialLot_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialLot_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialLot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qualificationStatus" TEXT NOT NULL DEFAULT 'CONDITIONAL',
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_productType_idx" ON "Product"("productType");

-- CreateIndex
CREATE INDEX "ProductRevision_productId_idx" ON "ProductRevision"("productId");

-- CreateIndex
CREATE INDEX "ProductRevision_status_idx" ON "ProductRevision"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRevision_productId_revisionCode_key" ON "ProductRevision"("productId", "revisionCode");

-- CreateIndex
CREATE UNIQUE INDEX "BOM_productRevisionId_key" ON "BOM"("productRevisionId");

-- CreateIndex
CREATE INDEX "BOM_status_idx" ON "BOM"("status");

-- CreateIndex
CREATE INDEX "BOMLine_bomId_idx" ON "BOMLine"("bomId");

-- CreateIndex
CREATE INDEX "BOMLine_materialId_idx" ON "BOMLine"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "BOMLine_bomId_materialId_key" ON "BOMLine"("bomId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE INDEX "Material_status_idx" ON "Material"("status");

-- CreateIndex
CREATE INDEX "Material_materialType_idx" ON "Material"("materialType");

-- CreateIndex
CREATE INDEX "MaterialSupplier_supplierId_idx" ON "MaterialSupplier"("supplierId");

-- CreateIndex
CREATE INDEX "MaterialLot_materialId_idx" ON "MaterialLot"("materialId");

-- CreateIndex
CREATE INDEX "MaterialLot_supplierId_idx" ON "MaterialLot"("supplierId");

-- CreateIndex
CREATE INDEX "MaterialLot_siteId_idx" ON "MaterialLot"("siteId");

-- CreateIndex
CREATE INDEX "MaterialLot_status_idx" ON "MaterialLot"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLot_siteId_lotCode_key" ON "MaterialLot"("siteId", "lotCode");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_qualificationStatus_idx" ON "Supplier"("qualificationStatus");
