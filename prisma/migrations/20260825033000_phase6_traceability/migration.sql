-- CreateTable
CREATE TABLE "TraceabilityQueryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queryType" TEXT NOT NULL,
    "rootEntityType" TEXT NOT NULL,
    "rootEntityId" TEXT NOT NULL,
    "requestedDepth" INTEGER,
    "scenario" TEXT,
    "filters" JSONB,
    "requestedByUserId" TEXT,
    "authorizedScope" TEXT,
    "resultSummary" JSONB,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TraceabilityQueryLog_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TraceabilityQueryLog_requestedByUserId_idx" ON "TraceabilityQueryLog"("requestedByUserId");

-- CreateIndex
CREATE INDEX "TraceabilityQueryLog_rootEntityType_rootEntityId_idx" ON "TraceabilityQueryLog"("rootEntityType", "rootEntityId");

-- CreateIndex
CREATE INDEX "TraceabilityQueryLog_executedAt_idx" ON "TraceabilityQueryLog"("executedAt");

