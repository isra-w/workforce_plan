import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Query using raw SQL so we are not bound to the Prisma enum definition.
  // This deletes any plan whose status column value is one of the finalised
  // states — regardless of whether the migration has been run or not.
  const result = await prisma.$executeRaw`
    DELETE FROM workforce_plans
    WHERE status IN ('APPROVED', 'HR_APPROVED', 'REJECTED', 'HR_REVIEW', 'CEO_REVIEW')
  `;
  console.log(`Deleted ${result} plan(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
