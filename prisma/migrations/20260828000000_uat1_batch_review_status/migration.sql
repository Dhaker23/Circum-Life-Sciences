-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BatchReviewRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
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
INSERT INTO "new_BatchReviewRecord" ("batchId", "createdAt", "disposition", "dispositionNotes", "dispositionedAt", "dispositionedByUserId", "evidenceDocumentId", "id", "isDemo", "reviewFindings", "reviewedAt", "reviewedByUserId", "siteId", "updatedAt") SELECT "batchId", "createdAt", "disposition", "dispositionNotes", "dispositionedAt", "dispositionedByUserId", "evidenceDocumentId", "id", "isDemo", "reviewFindings", "reviewedAt", "reviewedByUserId", "siteId", "updatedAt" FROM "BatchReviewRecord";
DROP TABLE "BatchReviewRecord";
ALTER TABLE "new_BatchReviewRecord" RENAME TO "BatchReviewRecord";
CREATE UNIQUE INDEX "BatchReviewRecord_batchId_key" ON "BatchReviewRecord"("batchId");
CREATE INDEX "BatchReviewRecord_siteId_idx" ON "BatchReviewRecord"("siteId");
CREATE INDEX "BatchReviewRecord_disposition_idx" ON "BatchReviewRecord"("disposition");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

