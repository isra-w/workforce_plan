import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Step 1 — reset every plan's version to 1
  const updated = await prisma.workforcePlan.updateMany({
    data: { version: 1 },
  });
  console.log(`✓ Reset ${updated.count} plan(s) to version 1`);

  // Step 2 — remove all existing version snapshots so the history
  //           is clean and matches the new versioning rules
  const deleted = await prisma.planVersion.deleteMany({});
  console.log(`✓ Cleared ${deleted.count} old version snapshot(s)`);

  // Step 3 — confirm
  const plans = await prisma.workforcePlan.findMany({
    select: { id: true, title: true, status: true, version: true },
    orderBy: { created_at: "asc" },
  });
  console.log("\nCurrent state:");
  plans.forEach((p) =>
    console.log(`  [v${p.version}] [${p.status}] ${p.title}`)
  );
}

main().catch(console.error).finally(() => prisma.$disconnect());
