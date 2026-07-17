/*
  Warnings:

  - The values [HR_REVIEW,FINANCE_REVIEW,CEO_REVIEW] on the enum `PlanStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `end_date` on the `planning_cycles` table. All the data in the column will be lost.
  - You are about to drop the column `start_date` on the `planning_cycles` table. All the data in the column will be lost.
  - Made the column `cycle_id` on table `workforce_plans` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlanStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'HR_APPROVED', 'APPROVED', 'REJECTED');
ALTER TABLE "workforce_plans" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "workforce_plans" ALTER COLUMN "status" TYPE "PlanStatus_new" USING ("status"::text::"PlanStatus_new");
ALTER TABLE "approval_logs" ALTER COLUMN "from_status" TYPE "PlanStatus_new" USING ("from_status"::text::"PlanStatus_new");
ALTER TABLE "approval_logs" ALTER COLUMN "to_status" TYPE "PlanStatus_new" USING ("to_status"::text::"PlanStatus_new");
ALTER TYPE "PlanStatus" RENAME TO "PlanStatus_old";
ALTER TYPE "PlanStatus_new" RENAME TO "PlanStatus";
DROP TYPE "PlanStatus_old";
ALTER TABLE "workforce_plans" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'HR_ADMIN';

-- DropForeignKey
ALTER TABLE "workforce_plans" DROP CONSTRAINT "workforce_plans_cycle_id_fkey";

-- DropIndex
DROP INDEX "approval_logs_actor_id_idx";

-- DropIndex
DROP INDEX "approval_logs_plan_id_idx";

-- DropIndex
DROP INDEX "plan_attachments_plan_id_idx";

-- DropIndex
DROP INDEX "plan_positions_plan_id_idx";

-- DropIndex
DROP INDEX "plan_versions_plan_id_idx";

-- DropIndex
DROP INDEX "workforce_plans_created_by_id_idx";

-- DropIndex
DROP INDEX "workforce_plans_cycle_id_idx";

-- DropIndex
DROP INDEX "workforce_plans_department_id_idx";

-- DropIndex
DROP INDEX "workforce_plans_status_idx";

-- AlterTable
ALTER TABLE "approval_logs" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "departments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "plan_attachments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "plan_positions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "plan_versions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "planning_cycles" DROP COLUMN "end_date",
DROP COLUMN "start_date",
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workforce_plans" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "cycle_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "role_permissions" (
    "role" "UserRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role")
);

-- AddForeignKey
ALTER TABLE "workforce_plans" ADD CONSTRAINT "workforce_plans_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "planning_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
