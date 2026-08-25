-- CreateTable
CREATE TABLE "Specification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "unit" TEXT,
    "criterionType" TEXT NOT NULL DEFAULT 'PASS_FAIL',
    "criterionValue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "effectiveFrom" DATETIME,
    "supersededById" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Specification_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Specification_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Specification" ("id") ON DELETE NO ACTION ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "equipmentType" TEXT,
    "documentRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TestMethodSpec" (
    "testMethodId" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("testMethodId", "specificationId"),
    CONSTRAINT "TestMethodSpec_testMethodId_fkey" FOREIGN KEY ("testMethodId") REFERENCES "TestMethod" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestMethodSpec_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "drawnByUserId" TEXT,
    "drawnAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantityCollected" DECIMAL,
    "quantityConsumed" DECIMAL NOT NULL DEFAULT 0,
    "quantityRemaining" DECIMAL,
    "unit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAWN',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sample_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sample_drawnByUserId_fkey" FOREIGN KEY ("drawnByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "testMethodId" TEXT,
    "specificationId" TEXT NOT NULL,
    "performedByUserId" TEXT,
    "performedAt" DATETIME,
    "measuredValue" TEXT,
    "unit" TEXT,
    "evaluatedResult" TEXT,
    "evaluatedAt" DATETIME,
    "evaluationLogic" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SAMPLE_RECEIVED',
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "disposition" TEXT,
    "dispositionedByUserId" TEXT,
    "dispositionedAt" DATETIME,
    "dispositionNotes" TEXT,
    "ncrId" TEXT,
    "evidenceDocumentRef" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TestResult_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TestResult_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TestResult_testMethodId_fkey" FOREIGN KEY ("testMethodId") REFERENCES "TestMethod" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestResult_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TestResult_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestResult_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestResult_dispositionedByUserId_fkey" FOREIGN KEY ("dispositionedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TestResult_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NCR" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL DEFAULT 'IN_PROCESS',
    "sourceEntityType" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "specificationId" TEXT,
    "inspectorEmployeeId" TEXT,
    "loggedByUserId" TEXT,
    "measuredValue" TEXT,
    "unit" TEXT,
    "evaluatedResult" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "ncrId" TEXT,
    "performedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inspection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inspection_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Inspection_inspectorEmployeeId_fkey" FOREIGN KEY ("inspectorEmployeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Inspection_loggedByUserId_fkey" FOREIGN KEY ("loggedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Inspection_ncrId_fkey" FOREIGN KEY ("ncrId") REFERENCES "NCR" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Specification_code_key" ON "Specification"("code");

-- CreateIndex
CREATE INDEX "Specification_status_idx" ON "Specification"("status");

-- CreateIndex
CREATE INDEX "Specification_parameter_idx" ON "Specification"("parameter");

-- CreateIndex
CREATE UNIQUE INDEX "TestMethod_code_key" ON "TestMethod"("code");

-- CreateIndex
CREATE INDEX "TestMethod_status_idx" ON "TestMethod"("status");

-- CreateIndex
CREATE INDEX "TestMethodSpec_specificationId_idx" ON "TestMethodSpec"("specificationId");

-- CreateIndex
CREATE INDEX "Sample_siteId_idx" ON "Sample"("siteId");

-- CreateIndex
CREATE INDEX "Sample_sourceEntityType_sourceEntityId_idx" ON "Sample"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_siteId_code_key" ON "Sample"("siteId", "code");

-- CreateIndex
CREATE INDEX "TestResult_siteId_idx" ON "TestResult"("siteId");

-- CreateIndex
CREATE INDEX "TestResult_sampleId_idx" ON "TestResult"("sampleId");

-- CreateIndex
CREATE INDEX "TestResult_status_idx" ON "TestResult"("status");

-- CreateIndex
CREATE INDEX "TestResult_evaluatedResult_idx" ON "TestResult"("evaluatedResult");

-- CreateIndex
CREATE UNIQUE INDEX "TestResult_siteId_code_key" ON "TestResult"("siteId", "code");

-- CreateIndex
CREATE INDEX "Inspection_siteId_idx" ON "Inspection"("siteId");

-- CreateIndex
CREATE INDEX "Inspection_status_idx" ON "Inspection"("status");

-- CreateIndex
CREATE INDEX "Inspection_sourceEntityType_sourceEntityId_idx" ON "Inspection"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_siteId_code_key" ON "Inspection"("siteId", "code");

