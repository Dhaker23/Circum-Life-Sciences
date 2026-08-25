-- CreateTable
CREATE TABLE "Cleanroom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "classification" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cleanroom_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitoringPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cleanroomId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "alertLimit" DECIMAL NOT NULL,
    "actionLimit" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonitoringPoint_cleanroomId_fkey" FOREIGN KEY ("cleanroomId") REFERENCES "Cleanroom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitoringResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "monitoringPointId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "value" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "resultStatus" TEXT NOT NULL DEFAULT 'NORMAL',
    "measuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measuredByUserId" TEXT,
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonitoringResult_monitoringPointId_fkey" FOREIGN KEY ("monitoringPointId") REFERENCES "MonitoringPoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonitoringResult_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MonitoringResult_measuredByUserId_fkey" FOREIGN KEY ("measuredByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Excursion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitoringResultId" TEXT NOT NULL,
    "cleanroomId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "excursionType" TEXT NOT NULL,
    "description" TEXT,
    "investigationRequired" BOOLEAN NOT NULL DEFAULT false,
    "ncrId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Excursion_monitoringResultId_fkey" FOREIGN KEY ("monitoringResultId") REFERENCES "MonitoringResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Excursion_cleanroomId_fkey" FOREIGN KEY ("cleanroomId") REFERENCES "Cleanroom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Excursion_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Excursion_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NCR" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackagingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "targetEntityType" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "packagingConfiguration" TEXT,
    "equipmentId" TEXT,
    "operatorEmployeeId" TEXT,
    "loggedByUserId" TEXT,
    "parameters" JSONB,
    "inspectionResult" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PackagingRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackagingRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PackagingRecord_operatorEmployeeId_fkey" FOREIGN KEY ("operatorEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PackagingRecord_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SterilizationLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "processType" TEXT NOT NULL,
    "sterilizationLotCode" TEXT,
    "equipmentId" TEXT,
    "cycleNumber" TEXT,
    "parameters" JSONB,
    "validationStatus" TEXT NOT NULL DEFAULT 'NOT_VALIDATED',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "releaseByUserId" TEXT,
    "releaseAt" DATETIME,
    "releaseNotes" TEXT,
    "evidenceDocumentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SterilizationLot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SterilizationLot_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SterilizationLot_releaseByUserId_fkey" FOREIGN KEY ("releaseByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SterilizationLot_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "ControlledDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SterilizationLotDeviceLot" (
    "sterilizationLotId" TEXT NOT NULL,
    "deviceLotId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("sterilizationLotId", "deviceLotId"),
    CONSTRAINT "SterilizationLotDeviceLot_sterilizationLotId_fkey" FOREIGN KEY ("sterilizationLotId") REFERENCES "SterilizationLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SterilizationLotDeviceLot_deviceLotId_fkey" FOREIGN KEY ("deviceLotId") REFERENCES "DeviceLot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SterilizationLotDeviceLot_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchReviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "reviewFindings" TEXT,
    "disposition" TEXT,
    "dispositionedByUserId" TEXT,
    "dispositionedAt" DATETIME,
    "dispositionNotes" TEXT,
    "evidenceDocumentId" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BatchReviewRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ManufacturingBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchReviewRecord_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchReviewRecord_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BatchReviewRecord_dispositionedByUserId_fkey" FOREIGN KEY ("dispositionedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BatchReviewRecord_evidenceDocumentId_fkey" FOREIGN KEY ("evidenceDocumentId") REFERENCES "ControlledDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Cleanroom_siteId_idx" ON "Cleanroom"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Cleanroom_siteId_code_key" ON "Cleanroom"("siteId", "code");

-- CreateIndex
CREATE INDEX "MonitoringPoint_cleanroomId_idx" ON "MonitoringPoint"("cleanroomId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringPoint_cleanroomId_code_key" ON "MonitoringPoint"("cleanroomId", "code");

-- CreateIndex
CREATE INDEX "MonitoringResult_monitoringPointId_idx" ON "MonitoringResult"("monitoringPointId");

-- CreateIndex
CREATE INDEX "MonitoringResult_resultStatus_idx" ON "MonitoringResult"("resultStatus");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoringResult_siteId_code_key" ON "MonitoringResult"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Excursion_monitoringResultId_key" ON "Excursion"("monitoringResultId");

-- CreateIndex
CREATE INDEX "Excursion_cleanroomId_idx" ON "Excursion"("cleanroomId");

-- CreateIndex
CREATE INDEX "Excursion_status_idx" ON "Excursion"("status");

-- CreateIndex
CREATE INDEX "PackagingRecord_targetEntityType_targetEntityId_idx" ON "PackagingRecord"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "PackagingRecord_status_idx" ON "PackagingRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PackagingRecord_siteId_code_key" ON "PackagingRecord"("siteId", "code");

-- CreateIndex
CREATE INDEX "SterilizationLot_siteId_idx" ON "SterilizationLot"("siteId");

-- CreateIndex
CREATE INDEX "SterilizationLot_status_idx" ON "SterilizationLot"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SterilizationLot_siteId_code_key" ON "SterilizationLot"("siteId", "code");

-- CreateIndex
CREATE INDEX "SterilizationLotDeviceLot_deviceLotId_idx" ON "SterilizationLotDeviceLot"("deviceLotId");

-- CreateIndex
CREATE UNIQUE INDEX "BatchReviewRecord_batchId_key" ON "BatchReviewRecord"("batchId");

-- CreateIndex
CREATE INDEX "BatchReviewRecord_siteId_idx" ON "BatchReviewRecord"("siteId");

-- CreateIndex
CREATE INDEX "BatchReviewRecord_disposition_idx" ON "BatchReviewRecord"("disposition");

