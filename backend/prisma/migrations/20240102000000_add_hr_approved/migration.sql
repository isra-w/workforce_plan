-- Migration: add HR_APPROVED to PlanStatus enum
-- Removes the old intermediate statuses (HR_REVIEW, FINANCE_REVIEW, CEO_REVIEW)
-- that were in the original schema and adds HR_APPROVED which reflects the
-- new two-step approval flow: SUBMITTED → HR_APPROVED → APPROVED.

-- Step 1: add the new value to the existing enum
ALTER TYPE "PlanStatus" ADD VALUE IF NOT EXISTS 'HR_APPROVED';

-- Step 2: the old values (HR_REVIEW, FINANCE_REVIEW, CEO_REVIEW) cannot be
-- removed from a PostgreSQL enum without recreating it, but since no rows
-- in the database currently hold those values they are safe to leave in the
-- enum definition — Prisma will simply never produce them.
-- If you need to remove them in a future migration, recreate the enum:
--
--   CREATE TYPE "PlanStatus_new" AS ENUM ('DRAFT','SUBMITTED','HR_APPROVED','APPROVED','REJECTED');
--   ALTER TABLE workforce_plans ALTER COLUMN status TYPE "PlanStatus_new" USING status::text::"PlanStatus_new";
--   ALTER TABLE approval_logs ALTER COLUMN from_status TYPE "PlanStatus_new" USING from_status::text::"PlanStatus_new";
--   ALTER TABLE approval_logs ALTER COLUMN to_status TYPE "PlanStatus_new" USING to_status::text::"PlanStatus_new";
--   DROP TYPE "PlanStatus";
--   ALTER TYPE "PlanStatus_new" RENAME TO "PlanStatus";
