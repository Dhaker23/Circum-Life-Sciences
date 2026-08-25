-- CreateTable
CREATE TABLE "DowntimeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "workCenterId" TEXT,
    "downtimeCategory" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "durationMinutes" INTEGER,
    "shiftId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DowntimeEvent_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DowntimeEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DowntimeEvent_workCenterId_fkey" FOREIGN KEY ("workCenterId") REFERENCES "WorkCenter" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DowntimeEvent_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValueStreamMap" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalLeadTimeMinutes" INTEGER,
    "totalValueAddedMinutes" INTEGER,
    "totalNonValueAddedMinutes" INTEGER,
    "valueAddedRatio" DECIMAL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ValueStreamMap_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VsmNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vsmId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "nodeType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leadTimeMinutes" INTEGER,
    "valueAddedMinutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VsmNode_vsmId_fkey" FOREIGN KEY ("vsmId") REFERENCES "ValueStreamMap" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VsmEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VsmEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "VsmNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VsmEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "VsmNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DowntimeEvent_equipmentId_idx" ON "DowntimeEvent"("equipmentId");

-- CreateIndex
CREATE INDEX "DowntimeEvent_siteId_idx" ON "DowntimeEvent"("siteId");

-- CreateIndex
CREATE INDEX "DowntimeEvent_status_idx" ON "DowntimeEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DowntimeEvent_siteId_code_key" ON "DowntimeEvent"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ValueStreamMap_code_key" ON "ValueStreamMap"("code");

-- CreateIndex
CREATE INDEX "ValueStreamMap_status_idx" ON "ValueStreamMap"("status");

-- CreateIndex
CREATE INDEX "VsmNode_vsmId_idx" ON "VsmNode"("vsmId");

-- CreateIndex
CREATE INDEX "VsmEdge_fromNodeId_idx" ON "VsmEdge"("fromNodeId");

-- CreateIndex
CREATE INDEX "VsmEdge_toNodeId_idx" ON "VsmEdge"("toNodeId");

