import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Test exactly what the getPlans controller does for a WORKFORCE_PLANNER
  const plans = await prisma.workforcePlan.findMany({
    include: {
      department: true,
      positions: true,
    },
    orderBy: { updated_at: "desc" },
  });

  console.log(`Total plans returned: ${plans.length}`);
  plans.forEach((p) => {
    const hc = p.positions.reduce((s, pos) => s + pos.count, 0);
    console.log(`  - [${p.status}] "${p.title}"  dept: ${p.department?.name}  headcount: ${hc}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
