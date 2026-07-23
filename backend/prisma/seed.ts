/**
 * Database seeder — run with `npx prisma db seed`.
 * Uses upsert so it is idempotent: safe to run multiple times.
 *
 * What it seeds:
 *   1. Departments
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ── Departments ──────────────────────────────────────────────────────────
  const departments = [
    { name: "Software",          code: "SW",   approved_hc: 100, current_hc: 28 },
    { name: "Finance",           code: "FIN",  approved_hc: 100, current_hc: 65 },
    { name: "Marketing",         code: "MKT",  approved_hc: 400, current_hc: 42 },
    { name: "Import and Export", code: "I&E",  approved_hc: 100, current_hc: 15 },
    { name: "Technology",        code: "TECH", approved_hc: 100, current_hc: 0  },
  ];

  for (const d of departments) {
    await prisma.department.upsert({
      where:  { name: d.name },
      update: d,
      create: d,
    });
  }
  console.log("✓ Departments seeded");
  console.log("Seed completed.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
