-- CreateTable
CREATE TABLE "NCR" (
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
    "closedAt" DATETIME,
    "closureNotes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NCR_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NCR_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NCR_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NCR_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deviation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "appliesToEntityType" TEXT NOT NULL,
    "appliesToEntityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "impactAssessment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "investigationId" TEXT,
    "evidenceDocumentRef" TEXT,
    "validFrom" DATETIME,
    "validUntil" DATETIME,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deviation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deviation_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deviation_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceNcrId" TEXT,
    "sourceDeviationId" TEXT,
    "methodology" TEXT NOT NULL,
    "findings" TEXT,
    "rootCause" TEXT,
    "concludedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "conductedByUserId" TEXT,
    "evidenceDocumentRef" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Investigation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Investigation_sourceNcrId_fkey" FOREIGN KEY ("sourceNcrId") REFERENCES "NCR" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Investigation_sourceDeviationId_fkey" FOREIGN KEY ("sourceDeviationId") REFERENCES "Deviation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Investigation_conductedByUserId_fkey" FOREIGN KEY ("conductedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CAPA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "investigationId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CORRECTIVE',
    "actionPlan" TEXT NOT NULL,
    "implementationOwnerUserId" TEXT,
    "implementedAt" DATETIME,
    "effectivenessVerification" TEXT,
    "effectivenessVerifiedAt" DATETIME,
    "effectivenessVerifiedByUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedByUserId" TEXT,
    "closedAt" DATETIME,
    "evidenceDocumentRef" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CAPA_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CAPA_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CAPA_implementationOwnerUserId_fkey" FOREIGN KEY ("implementationOwnerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CAPA_effectivenessVerifiedByUserId_fkey" FOREIGN KEY ("effectivenessVerifiedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CAPA_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChangeControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "impactAssessment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUEST',
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "implementationPlan" TEXT,
    "verificationPlan" TEXT,
    "effectivenessVerification" TEXT,
    "closedAt" DATETIME,
    "evidenceDocumentRef" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChangeControl_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChangeControl_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "hazard" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL,
    "riskPriorityNumber" INTEGER NOT NULL,
    "mitigations" TEXT NOT NULL,
    "residualRisk" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assessedByUserId" TEXT,
    "linkedChangeControlId" TEXT,
    "linkedDeviationId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RiskAssessment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RiskAssessment_assessedByUserId_fkey" FOREIGN KEY ("assessedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RiskAssessment_linkedChangeControlId_fkey" FOREIGN KEY ("linkedChangeControlId") REFERENCES "ChangeControl" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RiskAssessment_linkedDeviationId_fkey" FOREIGN KEY ("linkedDeviationId") REFERENCES "Deviation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductionRework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT,
    "deviceLotId" TEXT,
    "ncrId" TEXT,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reworkStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reworkCompletedAt" DATETIME,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionRework_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ManufacturingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionRework_deviceLotId_fkey" FOREIGN KEY ("deviceLotId") REFERENCES "DeviceLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionRework_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NCR" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionRework_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionRework" ("batchId", "createdAt", "deviceLotId", "id", "quantity", "reason", "recordedByUserId", "reworkCompletedAt", "reworkStartedAt", "unit") SELECT "batchId", "createdAt", "deviceLotId", "id", "quantity", "reason", "recordedByUserId", "reworkCompletedAt", "reworkStartedAt", "unit" FROM "ProductionRework";
DROP TABLE "ProductionRework";
ALTER TABLE "new_ProductionRework" RENAME TO "ProductionRework";
CREATE INDEX "ProductionRework_batchId_idx" ON "ProductionRework"("batchId");
CREATE INDEX "ProductionRework_deviceLotId_idx" ON "ProductionRework"("deviceLotId");
CREATE INDEX "ProductionRework_ncrId_idx" ON "ProductionRework"("ncrId");
CREATE TABLE "new_ProductionScrap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT,
    "deviceLotId" TEXT,
    "ncrId" TEXT,
    "quantity" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionScrap_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ManufacturingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionScrap_deviceLotId_fkey" FOREIGN KEY ("deviceLotId") REFERENCES "DeviceLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionScrap_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NCR" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionScrap_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionScrap" ("batchId", "createdAt", "deviceLotId", "id", "quantity", "reason", "recordedByUserId", "scrapedAt", "unit") SELECT "batchId", "createdAt", "deviceLotId", "id", "quantity", "reason", "recordedByUserId", "scrapedAt", "unit" FROM "ProductionScrap";
DROP TABLE "ProductionScrap";
ALTER TABLE "new_ProductionScrap" RENAME TO "ProductionScrap";
CREATE INDEX "ProductionScrap_batchId_idx" ON "ProductionScrap"("batchId");
CREATE INDEX "ProductionScrap_deviceLotId_idx" ON "ProductionScrap"("deviceLotId");
CREATE INDEX "ProductionScrap_ncrId_idx" ON "ProductionScrap"("ncrId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "NCR_investigationId_key" ON "NCR"("investigationId");

-- CreateIndex
CREATE INDEX "NCR_siteId_idx" ON "NCR"("siteId");

-- CreateIndex
CREATE INDEX "NCR_status_idx" ON "NCR"("status");

-- CreateIndex
CREATE INDEX "NCR_concernsEntityType_concernsEntityId_idx" ON "NCR"("concernsEntityType", "concernsEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "NCR_siteId_code_key" ON "NCR"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Deviation_investigationId_key" ON "Deviation"("investigationId");

-- CreateIndex
CREATE INDEX "Deviation_siteId_idx" ON "Deviation"("siteId");

-- CreateIndex
CREATE INDEX "Deviation_status_idx" ON "Deviation"("status");

-- CreateIndex
CREATE INDEX "Deviation_appliesToEntityType_appliesToEntityId_idx" ON "Deviation"("appliesToEntityType", "appliesToEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "Deviation_siteId_code_key" ON "Deviation"("siteId", "code");

-- CreateIndex
CREATE INDEX "Investigation_siteId_idx" ON "Investigation"("siteId");

-- CreateIndex
CREATE INDEX "Investigation_sourceType_idx" ON "Investigation"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "Investigation_siteId_code_key" ON "Investigation"("siteId", "code");

-- CreateIndex
CREATE INDEX "CAPA_siteId_idx" ON "CAPA"("siteId");

-- CreateIndex
CREATE INDEX "CAPA_status_idx" ON "CAPA"("status");

-- CreateIndex
CREATE INDEX "CAPA_investigationId_idx" ON "CAPA"("investigationId");

-- CreateIndex
CREATE INDEX "CAPA_sourceType_sourceId_idx" ON "CAPA"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CAPA_siteId_code_key" ON "CAPA"("siteId", "code");

-- CreateIndex
CREATE INDEX "ChangeControl_siteId_idx" ON "ChangeControl"("siteId");

-- CreateIndex
CREATE INDEX "ChangeControl_status_idx" ON "ChangeControl"("status");

-- CreateIndex
CREATE INDEX "ChangeControl_changeType_idx" ON "ChangeControl"("changeType");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeControl_siteId_code_key" ON "ChangeControl"("siteId", "code");

-- CreateIndex
CREATE INDEX "RiskAssessment_siteId_idx" ON "RiskAssessment"("siteId");

-- CreateIndex
CREATE INDEX "RiskAssessment_status_idx" ON "RiskAssessment"("status");

-- CreateIndex
CREATE INDEX "RiskAssessment_subjectType_subjectId_idx" ON "RiskAssessment"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessment_siteId_code_key" ON "RiskAssessment"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_routingId_sequence_key" ON "Operation"("routingId", "sequence");

