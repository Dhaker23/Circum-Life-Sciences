-- AlterTable
ALTER TABLE "MaterialLot" ADD COLUMN "controlledDocumentId" TEXT;

-- AlterTable
ALTER TABLE "TestMethod" ADD COLUMN "controlledDocumentId" TEXT;

-- CreateTable
CREATE TABLE "ControlledDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'SOP',
    "version" TEXT NOT NULL,
    "filePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "effectiveFrom" DATETIME,
    "supersededById" TEXT,
    "description" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ControlledDocument_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ControlledDocument_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "ControlledDocument" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequiredTraining" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentId" TEXT,
    "validityPeriodMonths" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RequiredTraining_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ControlledDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "requiredTrainingId" TEXT,
    "siteId" TEXT NOT NULL,
    "trainedByUserId" TEXT,
    "trainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "expiresAt" DATETIME,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingRecord_requiredTrainingId_fkey" FOREIGN KEY ("requiredTrainingId") REFERENCES "RequiredTraining" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingRecord_trainedByUserId_fkey" FOREIGN KEY ("trainedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingRecordId" TEXT NOT NULL,
    "assessedByUserId" TEXT,
    "assessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL,
    "score" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_trainingRecordId_fkey" FOREIGN KEY ("trainingRecordId") REFERENCES "TrainingRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assessment_assessedByUserId_fkey" FOREIGN KEY ("assessedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "requiredTrainingId" TEXT,
    "trainingRecordId" TEXT,
    "competencyLevel" TEXT NOT NULL DEFAULT 'AUTHORIZED',
    "authorizedByUserId" TEXT,
    "authorizedAt" DATETIME,
    "expiresAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Competency_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Competency_requiredTrainingId_fkey" FOREIGN KEY ("requiredTrainingId") REFERENCES "RequiredTraining" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Competency_trainingRecordId_fkey" FOREIGN KEY ("trainingRecordId") REFERENCES "TrainingRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Competency_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "auditType" TEXT NOT NULL DEFAULT 'PERIODIC',
    "scheduledDate" DATETIME,
    "completedDate" DATETIME,
    "auditorUserId" TEXT,
    "findings" TEXT,
    "result" TEXT,
    "capaId" TEXT,
    "qualificationImpact" TEXT NOT NULL DEFAULT 'NO_CHANGE',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "evidenceDocumentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierAudit_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierAudit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupplierAudit_auditorUserId_fkey" FOREIGN KEY ("auditorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierAudit_capaId_fkey" FOREIGN KEY ("capaId") REFERENCES "CAPA" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierAudit_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "ControlledDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_NCR" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "concernsEntityType" TEXT NOT NULL,
    "concernsEntityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MAJOR',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "containmentAction" TEXT,
    "disposition" TEXT,
    "createdByUserId" TEXT,
    "assignedToUserId" TEXT,
    "investigationId" TEXT,
    "evidenceDocumentRef" TEXT,
    "controlledDocumentId" TEXT,
    "closedAt" DATETIME,
    "closureNotes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NCR_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NCR_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NCR_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NCR_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NCR_controlledDocumentId_fkey" FOREIGN KEY ("controlledDocumentId") REFERENCES "ControlledDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_NCR" ("assignedToUserId", "closedAt", "closureNotes", "code", "concernsEntityId", "concernsEntityType", "containmentAction", "createdAt", "createdByUserId", "description", "disposition", "evidenceDocumentRef", "id", "investigationId", "isDemo", "severity", "siteId", "status", "updatedAt") SELECT "assignedToUserId", "closedAt", "closureNotes", "code", "concernsEntityId", "concernsEntityType", "containmentAction", "createdAt", "createdByUserId", "description", "disposition", "evidenceDocumentRef", "id", "investigationId", "isDemo", "severity", "siteId", "status", "updatedAt" FROM "NCR";
DROP TABLE "NCR";
ALTER TABLE "new_NCR" RENAME TO "NCR";
CREATE UNIQUE INDEX "NCR_investigationId_key" ON "NCR"("investigationId");
CREATE INDEX "NCR_siteId_idx" ON "NCR"("siteId");
CREATE INDEX "NCR_status_idx" ON "NCR"("status");
CREATE INDEX "NCR_concernsEntityType_concernsEntityId_idx" ON "NCR"("concernsEntityType", "concernsEntityId");
CREATE UNIQUE INDEX "NCR_siteId_code_key" ON "NCR"("siteId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ControlledDocument_code_key" ON "ControlledDocument"("code");

-- CreateIndex
CREATE INDEX "ControlledDocument_status_idx" ON "ControlledDocument"("status");

-- CreateIndex
CREATE INDEX "ControlledDocument_documentType_idx" ON "ControlledDocument"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "RequiredTraining_code_key" ON "RequiredTraining"("code");

-- CreateIndex
CREATE INDEX "RequiredTraining_status_idx" ON "RequiredTraining"("status");

-- CreateIndex
CREATE INDEX "TrainingRecord_employeeId_idx" ON "TrainingRecord"("employeeId");

-- CreateIndex
CREATE INDEX "TrainingRecord_siteId_idx" ON "TrainingRecord"("siteId");

-- CreateIndex
CREATE INDEX "TrainingRecord_status_idx" ON "TrainingRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRecord_siteId_code_key" ON "TrainingRecord"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_trainingRecordId_key" ON "Assessment"("trainingRecordId");

-- CreateIndex
CREATE INDEX "Assessment_trainingRecordId_idx" ON "Assessment"("trainingRecordId");

-- CreateIndex
CREATE INDEX "Competency_employeeId_idx" ON "Competency"("employeeId");

-- CreateIndex
CREATE INDEX "Competency_status_idx" ON "Competency"("status");

-- CreateIndex
CREATE INDEX "SupplierAudit_supplierId_idx" ON "SupplierAudit"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierAudit_siteId_idx" ON "SupplierAudit"("siteId");

-- CreateIndex
CREATE INDEX "SupplierAudit_status_idx" ON "SupplierAudit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierAudit_siteId_code_key" ON "SupplierAudit"("siteId", "code");

