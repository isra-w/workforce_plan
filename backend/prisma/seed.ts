/**
 * Database seeder — run with `npx prisma db seed` (or `ts-node prisma/seed.ts`).
 * Uses upsert so it is idempotent: safe to run multiple times without creating
 * duplicate records.
 *
 * What it seeds:
 *   1. Departments — five business units with realistic baseline headcount
 *      figures (approved_hc, current_hc).
 *   2. Sample WorkforcePlans — two demo plans (DRAFT and SUBMITTED) linked to the
 *      first existing WORKFORCE_PLANNER user. Plans are only created if they do
 *      not already exist, preventing duplicates on re-seed.
 */
import { PrismaClient, PlanStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding workforce database...");

  // ── 1. Departments ────────────────────────────────────────────────────────
  const departments = [
    { name: "Software", code: "SW", approved_hc: 100, current_hc: 28 },
    { name: "Finance", code: "FIN", approved_hc: 100, current_hc: 65 },
    { name: "Marketing", code: "MKT", approved_hc: 400, current_hc: 42 },
    {
      name: "Import and Export",
      code: "I&E",
      approved_hc: 100,
      current_hc: 15,
    },
    { name: "Technology", code: "TECH", approved_hc: 100, current_hc: 0 },
  ];

  for (const d of departments) {
    await prisma.department.upsert({
      where: { name: d.name },
      update: d,
      create: d,
    });
  }
  console.log("✓ Departments seeded");

  // ── 2. Sample Plans ───────────────────────────────────────────────────────
  // Plans are only created when a WORKFORCE_PLANNER user already exists.
  // Register a user via the app first, then re-run the seed to get sample plans.
  const planner = await prisma.user.findFirst({
    where: { role: "WORKFORCE_PLANNER" },
  });

  const financeDept = await prisma.department.findUnique({
    where: { name: "Finance" },
  });

  const marketingDept = await prisma.department.findUnique({
    where: { name: "Marketing" },
  });

  if (planner && financeDept) {
    // Draft plan linked to Finance department
    const existingPlan = await prisma.workforcePlan.findFirst({
      where: { title: "Finance Department Expansion" },
    });

    if (!existingPlan) {
      const plan = await prisma.workforcePlan.create({
        data: {
          title: "Finance Department Expansion",
          department_id: financeDept.id,
          fiscal_year: 2025,
          planning_period: "ANNUAL",
          justification:
            "Expansion of finance services requires additional relationship managers and " +
            "compliance support to meet projected client growth of 15% in FY2025.",
          status: "DRAFT" as PlanStatus,
          version: 1,
          created_by_id: planner.id,
          positions: {
            create: [
              {
                title: "Senior Financial Analyst",
                count: 2,
                employment_type: "FULL_TIME",
                priority: "HIGH",
              },
              {
                title: "Finance Officer",
                count: 3,
                employment_type: "FULL_TIME",
                priority: "MEDIUM",
              },
            ],
          },
        },
      });

      await prisma.planVersion.create({
        data: {
          plan_id: plan.id,
          version: 1,
          snapshot: plan as object,
          created_by_id: planner.id,
        },
      });

      console.log("✓ Draft plan created (Finance)");
    }

    // Submitted plan linked to Marketing department
    if (marketingDept) {
      await prisma.workforcePlan
        .create({
          data: {
            title: "Q3 Marketing Expansion Plan",
            department_id: marketingDept.id,
            fiscal_year: 2025,
            planning_period: "QUARTERLY",
            quarter: 3,
            justification:
              "Scaling the marketing team for new product launch campaigns in Q3.",
            status: "SUBMITTED" as PlanStatus,
            version: 1,
            created_by_id: planner.id,
            positions: {
              create: [
                {
                  title: "Marketing Manager",
                  count: 2,
                  employment_type: "FULL_TIME",
                  priority: "HIGH",
                },
                {
                  title: "Digital Marketing Specialist",
                  count: 3,
                  employment_type: "FULL_TIME",
                  priority: "MEDIUM",
                },
              ],
            },
          },
        })
        .catch(() => {}); // silently skip if duplicate title already exists

      console.log("✓ Submitted plan created (Marketing)");
    }
  } else {
    console.log(
      "⚠ No WORKFORCE_PLANNER user found — sample plans skipped. " +
        "Register a user via the app then re-run the seed.",
    );
  }

  console.log("Seed completed!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
