# Database Migrations

This folder is managed by **Prisma Migrate** and contains the full SQL history
of every schema change applied to the database.

---

## Folder structure

```
prisma/migrations/
├── migration_lock.toml          # Locks the DB provider (do not edit manually)
├── README.md                    # This file
└── 20240101000000_workforce_schema/
    └── migration.sql            # Initial schema — all tables, enums, indexes & FK constraints
```

---

## Migrations overview

| # | Folder | Description |
|---|--------|-------------|
| 1 | `20240101000000_workforce_schema` | Creates all enums (`UserRole`, `PlanStatus`, `PlanningPeriod`, `EmploymentType`, `Priority`), all tables (`users`, `departments`, `planning_cycles`, `workforce_plans`, `plan_positions`, `plan_versions`, `plan_attachments`, `approval_logs`), indexes, and foreign-key constraints. |

---

## How to apply migrations

### First-time setup (fresh database)
```bash
cd backend
npx prisma migrate deploy
```
This runs every migration in chronological order against the database pointed
to by `DATABASE_URL` in your `.env` file.

### During development (create a new migration after schema changes)
```bash
npx prisma migrate dev --name <short_description>
```
Prisma will diff `schema.prisma` against the current DB state, generate a new
`migration.sql` file, and apply it automatically.

### Reset the database (dev only — destructive)
```bash
npx prisma migrate reset
```
Drops the database, re-applies all migrations in order, then re-runs the seeder
(`prisma/seed.ts`). **Never run this against production.**

### Check migration status
```bash
npx prisma migrate status
```
Shows which migrations have been applied and which are pending.

---

## Seeding

After running migrations you can populate the database with sample data:

```bash
npx prisma db seed
```

The seeder (`prisma/seed.ts`) creates:
- 5 departments (banking business units)
- 1 active FY 2025 planning cycle
- 2 sample workforce plans (DRAFT + SUBMITTED) linked to the first planner user

---

## Important rules

- **Never edit an already-applied migration file.** If you need to change
  something, create a new migration instead.
- **Commit the entire `migrations/` folder** to version control so every
  environment stays in sync.
- `migration_lock.toml` is auto-managed by Prisma — do not edit it by hand.
