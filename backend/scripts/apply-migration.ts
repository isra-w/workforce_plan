import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Add HR_APPROVED to the PlanStatus enum if it doesn't already exist
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "PlanStatus" ADD VALUE IF NOT EXISTS 'HR_APPROVED'`
  );
  console.log("✓ HR_APPROVED added to PlanStatus enum");

  // Verify the enum now has the correct values
  const result = await prisma.$queryRaw<{ enumlabel: string }[]>`
    SELECT enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'PlanStatus'
    ORDER BY enumsortorder
  `;
  console.log("Current PlanStatus values:", result.map((r) => r.enumlabel));
}

main().catch(console.error).finally(() => prisma.$disconnect());
