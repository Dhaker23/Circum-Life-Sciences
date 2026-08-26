-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adapterType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteId" TEXT,
    "endpointUrl" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "credentialsIv" TEXT NOT NULL,
    "syncSchedule" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationConfig_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorDetail" TEXT,
    "durationMs" INTEGER,
    "triggeredByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationEvent_configId_fkey" FOREIGN KEY ("configId") REFERENCES "IntegrationConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "IntegrationConfig_siteId_idx" ON "IntegrationConfig"("siteId");

-- CreateIndex
CREATE INDEX "IntegrationConfig_status_idx" ON "IntegrationConfig"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_adapterType_name_key" ON "IntegrationConfig"("adapterType", "name");

-- CreateIndex
CREATE INDEX "IntegrationEvent_configId_idx" ON "IntegrationEvent"("configId");

-- CreateIndex
CREATE INDEX "IntegrationEvent_eventType_idx" ON "IntegrationEvent"("eventType");

-- CreateIndex
CREATE INDEX "IntegrationEvent_createdAt_idx" ON "IntegrationEvent"("createdAt");

