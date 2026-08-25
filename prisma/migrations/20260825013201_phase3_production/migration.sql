-- CreateTable
CREATE TABLE "Routing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productRevisionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Routing_productRevisionId_fkey" FOREIGN KEY ("productRevisionId") REFERENCES "ProductRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workCenterId" TEXT,
    "estimatedDurationMinutes" INTEGER,
    "instructions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Operation_routingId_fkey" FOREIGN KEY ("routingId") REFERENCES "Routing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Operation_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkCenter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkCenter_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "productRevisionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "plannedQuantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "plannedStartDate" DATETIME,
    "plannedDueDate" DATETIME,
    "releasedAt" DATETIME,
    "closedAt" DATETIME,
    "reason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrder_productRevisionId_fkey" FOREIGN KEY ("productRevisionId") REFERENCES "ProductRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManufacturingBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "productRevisionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "plannedQuantity" DECIMAL NOT NULL,
    "actualQuantity" DECIMAL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManufacturingBatch_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManufacturingBatch_productRevisionId_fkey" FOREIGN KEY ("productRevisionId") REFERENCES "ProductRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManufacturingBatch_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeviceLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeviceLot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ManufacturingBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeviceLot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "workCenterId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "operatorEmployeeId" TEXT NOT NULL,
    "loggedByUserId" TEXT,
    "parameters" JSONB,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OperationExecution_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ManufacturingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OperationExecution_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OperationExecution_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationExecution_operatorEmployeeId_fkey" FOREIGN KEY ("operatorEmployeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OperationExecution_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialConsumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "materialLotId" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "consumedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialConsumption_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ManufacturingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumption_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialConsumption_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "materialLotId" TEXT NOT NULL,
    "quantityReserved" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reservedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaterialReservation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialReservation_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionScrap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT,
    "deviceLotId" TEXT,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionScrap_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ManufacturingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionScrap_deviceLotId_fkey" FOREIGN KEY ("deviceLotId") REFERENCES "DeviceLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionScrap_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionRework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT,
    "deviceLotId" TEXT,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reworkStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reworkCompletedAt" DATETIME,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionRework_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ManufacturingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionRework_deviceLotId_fkey" FOREIGN KEY ("deviceLotId") REFERENCES "DeviceLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionRework_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shift_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MaterialLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotCode" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "quantityReceived" DECIMAL NOT NULL,
    "quantityAvailable" DECIMAL NOT NULL,
    "quantityReserved" DECIMAL NOT NULL DEFAULT 0,
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
INSERT INTO "new_MaterialLot" ("certificateOfAnalysis", "createdAt", "expiryDate", "id", "isDemo", "lotCode", "materialId", "quantityAvailable", "quantityReceived", "receivedAt", "siteId", "status", "supplierId", "unit", "updatedAt") SELECT "certificateOfAnalysis", "createdAt", "expiryDate", "id", "isDemo", "lotCode", "materialId", "quantityAvailable", "quantityReceived", "receivedAt", "siteId", "status", "supplierId", "unit", "updatedAt" FROM "MaterialLot";
DROP TABLE "MaterialLot";
ALTER TABLE "new_MaterialLot" RENAME TO "MaterialLot";
CREATE INDEX "MaterialLot_materialId_idx" ON "MaterialLot"("materialId");
CREATE INDEX "MaterialLot_supplierId_idx" ON "MaterialLot"("supplierId");
CREATE INDEX "MaterialLot_siteId_idx" ON "MaterialLot"("siteId");
CREATE INDEX "MaterialLot_status_idx" ON "MaterialLot"("status");
CREATE UNIQUE INDEX "MaterialLot_siteId_lotCode_key" ON "MaterialLot"("siteId", "lotCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Routing_productRevisionId_key" ON "Routing"("productRevisionId");

-- CreateIndex
CREATE INDEX "Routing_status_idx" ON "Routing"("status");

-- CreateIndex
CREATE INDEX "Operation_routingId_idx" ON "Operation"("routingId");

-- CreateIndex
CREATE INDEX "WorkCenter_siteId_idx" ON "WorkCenter"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCenter_siteId_code_key" ON "WorkCenter"("siteId", "code");

-- CreateIndex
CREATE INDEX "WorkOrder_siteId_idx" ON "WorkOrder"("siteId");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_productRevisionId_idx" ON "WorkOrder"("productRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_siteId_code_key" ON "WorkOrder"("siteId", "code");

-- CreateIndex
CREATE INDEX "ManufacturingBatch_workOrderId_idx" ON "ManufacturingBatch"("workOrderId");

-- CreateIndex
CREATE INDEX "ManufacturingBatch_siteId_idx" ON "ManufacturingBatch"("siteId");

-- CreateIndex
CREATE INDEX "ManufacturingBatch_status_idx" ON "ManufacturingBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ManufacturingBatch_siteId_code_key" ON "ManufacturingBatch"("siteId", "code");

-- CreateIndex
CREATE INDEX "DeviceLot_batchId_idx" ON "DeviceLot"("batchId");

-- CreateIndex
CREATE INDEX "DeviceLot_siteId_idx" ON "DeviceLot"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceLot_siteId_code_key" ON "DeviceLot"("siteId", "code");

-- CreateIndex
CREATE INDEX "OperationExecution_batchId_idx" ON "OperationExecution"("batchId");

-- CreateIndex
CREATE INDEX "OperationExecution_operationId_idx" ON "OperationExecution"("operationId");

-- CreateIndex
CREATE INDEX "OperationExecution_operatorEmployeeId_idx" ON "OperationExecution"("operatorEmployeeId");

-- CreateIndex
CREATE INDEX "MaterialConsumption_batchId_idx" ON "MaterialConsumption"("batchId");

-- CreateIndex
CREATE INDEX "MaterialConsumption_materialLotId_idx" ON "MaterialConsumption"("materialLotId");

-- CreateIndex
CREATE INDEX "MaterialReservation_workOrderId_idx" ON "MaterialReservation"("workOrderId");

-- CreateIndex
CREATE INDEX "MaterialReservation_materialLotId_idx" ON "MaterialReservation"("materialLotId");

-- CreateIndex
CREATE INDEX "ProductionScrap_batchId_idx" ON "ProductionScrap"("batchId");

-- CreateIndex
CREATE INDEX "ProductionScrap_deviceLotId_idx" ON "ProductionScrap"("deviceLotId");

-- CreateIndex
CREATE INDEX "ProductionRework_batchId_idx" ON "ProductionRework"("batchId");

-- CreateIndex
CREATE INDEX "ProductionRework_deviceLotId_idx" ON "ProductionRework"("deviceLotId");

-- CreateIndex
CREATE INDEX "Shift_siteId_idx" ON "Shift"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_siteId_name_key" ON "Shift"("siteId", "name");
