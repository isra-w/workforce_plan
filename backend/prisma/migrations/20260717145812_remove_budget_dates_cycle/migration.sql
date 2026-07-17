-- Migration: remove budgeted_hc from departments,
--            remove start_date / end_date / cycle_id from workforce_plans,
--            drop planning_cycles table entirely.

-- 1. Drop the FK constraint linking workforce_plans → planning_cycles
ALTER TABLE "workforce_plans" DROP CONSTRAINT IF EXISTS "workforce_plans_cycle_id_fkey";

-- 2. Drop removed columns from workforce_plans
ALTER TABLE "workforce_plans"
  DROP COLUMN IF EXISTS "start_date",
  DROP COLUMN IF EXISTS "end_date",
  DROP COLUMN IF EXISTS "cycle_id";

-- 3. Drop budgeted_hc from departments
ALTER TABLE "departments"
  DROP COLUMN IF EXISTS "budgeted_hc";

-- 4. Drop the planning_cycles table (no remaining references)
DROP TABLE IF EXISTS "planning_cycles";
