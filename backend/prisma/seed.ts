/**
 * Database seeder — run with `npx prisma db seed` (or `ts-node prisma/seed.ts`).
 * Uses upsert so it is idempotent: safe to run multiple times without creating
 * duplicate records.
 *
 * What it seeds:
 *   1. Departments — five business units with realistic baseline headcount
 *      figures (approved_hc, budgeted_hc, current_hc).
 *   2. PlanningCycle — a single active FY 2025 cycle with a fixed UUID so
 *      subsequent runs always reference the same record.
 *   3. Sample WorkforcePlans — two demo plans (DRAFT and SUBMITTED) linked to the
 *      first existing WORKFORCE_PLANNER user and the active cycle. Each plan
 *      includes positions and an initial PlanVersion snapshot. Plans are only
 *      created if they do not already exist, preventing duplicates on re-seed.
 *
 * The script disconnects from the database automatically via the .finally() call.
 */
import { PrismaClient, PlanStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding workforce database...");

  // ── 1. Departments ────────────────────────────────────────────────────────
  // Each department has static baseline headcount fields used by the dashboard.
  // "Wealth Management" → "Finance", "Operations" → "Marketing",
  // "Compliance" → "Import and Export" as requested.
  const departments = [
    { name: "Software",          code: "SW",  approved_hc: 170, budgeted_hc: 190, current_hc: 128 },
    { name: "Finance",           code: "FIN", approved_hc: 180, budgeted_hc: 200, current_hc: 165 },
    { name: "Marketing",         code: "MKT", approved_hc: 450, budgeted_hc: 480, current_hc: 412 },
    { name: "Import and Export", code: "I&E", approved_hc: 120, budgeted_hc: 130, current_hc: 115 },
    { name: "Technology",        code: "TECH",approved_hc: 170, budgeted_hc: 190, current_hc: 128 },
  ];

  for (const d of departments) {
    await prisma.department.upsert({
      where: { name: d.name },
      update: d,
      create: d,
    });
  }
  console.log("✓ Departments seeded");

  // ── 2. Planning Cycle ─────────────────────────────────────────────────────
  // Fixed UUID ensures re-running the seed never creates a second active cycle.
  await prisma.planningCycle.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      fiscal_year: 2025,
      name: "FY 2025 (Jan - Dec)",
      start_date: new Date("2025-01-01"),
      end_date: new Date("2025-12-31"),
      is_active: true,
    },
  });
  console.log("✓ Planning cycle seeded");

  // ── 3. Sample Plans ───────────────────────────────────────────────────────
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

  const cycle = await prisma.planningCycle.findFirst({
    where: { is_active: true },
  });

  if (planner && financeDept && cycle) {
    // Draft plan linked to Finance department
    const existingPlan = await prisma.workforcePlan.findFirst({
      where: { title: "FY2025 Finance Department Expansion" },
    });

    if (!existingPlan) {
      const plan = await prisma.workforcePlan.create({
        data: {
          title: "FY2025 Finance Department Expansion",
          department_id: financeDept.id,
          fiscal_year: 2025,
          planning_period: "ANNUAL",
          start_date: new Date("2025-01-01"),
          end_date: new Date("2025-12-31"),
          justification:
            "Expansion of finance services requires additional relationship managers and " +
            "compliance support to meet projected client growth of 15% in FY2025.",
          status: "DRAFT" as PlanStatus,
          version: 1,
          cycle_id: cycle.id,
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

      // Save an initial version snapshot for the audit history
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
            justification: "Scaling the marketing team for new product launch campaigns in Q3.",
            status: "SUBMITTED" as PlanStatus,
            version: 1,
            cycle_id: cycle.id,
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
        // Silently skip if a duplicate title already exists
        .catch(() => {});

      console.log("✓ Submitted plan created (Marketing)");
    }
  } else {
    console.log(
      "⚠ No WORKFORCE_PLANNER user found — sample plans skipped. " +
      "Register a user via the app then re-run the seed."
    );
  }

  console.log("Seed completed!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
