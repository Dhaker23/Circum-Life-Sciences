// scripts/verify-audit-triggers.ts
// Verifies ADR-0005: AuditEvent is append-only (UPDATE/DELETE rejected at DB level).
// Run: bun run scripts/verify-audit-triggers.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const ev = await db.auditEvent.create({
    data: {
      action: "verification.test",
      entityType: "AuditEvent",
      entityId: "self",
      outcome: "SUCCESS",
      reason: "verify-audit-triggers probe",
    },
  });
  console.log("INSERT succeeded:", ev.id);

  let updateFailed = false;
  try {
    await db.$executeRawUnsafe(
      `UPDATE "AuditEvent" SET outcome = 'FAILURE' WHERE id = ?`,
      ev.id,
    );
    console.error("UPDATE did NOT fail (IMMUTABILITY BROKEN)");
  } catch (e) {
    updateFailed = true;
    console.log("UPDATE correctly rejected:", (e as Error).message.split("\n")[0]);
  }

  let deleteFailed = false;
  try {
    await db.$executeRawUnsafe(`DELETE FROM "AuditEvent" WHERE id = ?`, ev.id);
    console.error("DELETE did NOT fail (IMMUTABILITY BROKEN)");
  } catch (e) {
    deleteFailed = true;
    console.log("DELETE correctly rejected:", (e as Error).message.split("\n")[0]);
  }

  if (!updateFailed || !deleteFailed) {
    console.error("\nRESULT: FAIL");
    process.exit(1);
  }
  console.log("\nRESULT: PASS - AuditEvent append-only (UPDATE + DELETE blocked)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
