-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "serialNumber" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "workCenterId" TEXT,
    "siteId" TEXT NOT NULL,
    "operationalStatus" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "calibrationStatus" TEXT NOT NULL DEFAULT 'VALID',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Equipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "maintenanceType" TEXT NOT NULL DEFAULT 'PREVENTIVE',
    "scheduledDate" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "performedByUserId" TEXT,
    "findings" TEXT,
    "partsReplaced" TEXT,
    "downtimeHours" DECIMAL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "evidenceDocumentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRecord_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRecord_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "ControlledDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CalibrationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "standard" TEXT,
    "result" TEXT NOT NULL,
    "calibratedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextCalibrationDue" DATETIME NOT NULL,
    "performedByUserId" TEXT,
    "notes" TEXT,
    "evidenceDocumentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CalibrationRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalibrationRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CalibrationRecord_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CalibrationRecord_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "ControlledDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "qualificationType" TEXT NOT NULL,
    "protocol" TEXT,
    "acceptanceCriteria" TEXT,
    "executionResult" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUIREMENT',
    "deviationId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "reportRef" TEXT,
    "evidenceDocumentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Qualification_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Qualification_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Qualification_deviationId_fkey" FOREIGN KEY ("deviationId") REFERENCES "Deviation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Qualification_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Qualification_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "ControlledDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OperationExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "workCenterId" TEXT,
    "equipmentId" TEXT,
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
    CONSTRAINT "OperationExecution_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationExecution_operatorEmployeeId_fkey" FOREIGN KEY ("operatorEmployeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OperationExecution_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OperationExecution" ("batchId", "completedAt", "createdAt", "id", "loggedByUserId", "notes", "operationId", "operatorEmployeeId", "parameters", "startedAt", "status", "updatedAt", "workCenterId") SELECT "batchId", "completedAt", "createdAt", "id", "loggedByUserId", "notes", "operationId", "operatorEmployeeId", "parameters", "startedAt", "status", "updatedAt", "workCenterId" FROM "OperationExecution";
DROP TABLE "OperationExecution";
ALTER TABLE "new_OperationExecution" RENAME TO "OperationExecution";
CREATE INDEX "OperationExecution_batchId_idx" ON "OperationExecution"("batchId");
CREATE INDEX "OperationExecution_operationId_idx" ON "OperationExecution"("operationId");
CREATE INDEX "OperationExecution_operatorEmployeeId_idx" ON "OperationExecution"("operatorEmployeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Equipment_siteId_idx" ON "Equipment"("siteId");

-- CreateIndex
CREATE INDEX "Equipment_operationalStatus_idx" ON "Equipment"("operationalStatus");

-- CreateIndex
CREATE INDEX "Equipment_calibrationStatus_idx" ON "Equipment"("calibrationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_siteId_code_key" ON "Equipment"("siteId", "code");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_equipmentId_idx" ON "MaintenanceRecord"("equipmentId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_siteId_idx" ON "MaintenanceRecord"("siteId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_status_idx" ON "MaintenanceRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRecord_siteId_code_key" ON "MaintenanceRecord"("siteId", "code");

-- CreateIndex
CREATE INDEX "CalibrationRecord_equipmentId_idx" ON "CalibrationRecord"("equipmentId");

-- CreateIndex
CREATE INDEX "CalibrationRecord_siteId_idx" ON "CalibrationRecord"("siteId");

-- CreateIndex
CREATE INDEX "CalibrationRecord_result_idx" ON "CalibrationRecord"("result");

-- CreateIndex
CREATE UNIQUE INDEX "CalibrationRecord_siteId_code_key" ON "CalibrationRecord"("siteId", "code");

-- CreateIndex
CREATE INDEX "Qualification_equipmentId_idx" ON "Qualification"("equipmentId");

-- CreateIndex
CREATE INDEX "Qualification_siteId_idx" ON "Qualification"("siteId");

-- CreateIndex
CREATE INDEX "Qualification_status_idx" ON "Qualification"("status");

-- CreateIndex
CREATE INDEX "Qualification_qualificationType_idx" ON "Qualification"("qualificationType");

-- CreateIndex
CREATE UNIQUE INDEX "Qualification_siteId_code_key" ON "Qualification"("siteId", "code");

