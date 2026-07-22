-- CreateTable
CREATE TABLE "custom_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_roles_name_key" ON "custom_roles"("name");

-- Insert system roles into custom_roles table
INSERT INTO "custom_roles" ("id", "name", "display_name", "description", "is_system", "created_at", "updated_at")
VALUES 
  (gen_random_uuid(), 'WORKFORCE_PLANNER', 'Workforce Planner', 'Standard platform permissions and workforce submissions', true, NOW(), NOW()),
  (gen_random_uuid(), 'HR', 'HR', 'HR review and approval workflow access', true, NOW(), NOW()),
  (gen_random_uuid(), 'CEO', 'CEO', 'Final approver for workforce plans and job postings', true, NOW(), NOW()),
  (gen_random_uuid(), 'CANDIDATE', 'Candidate', 'Standard platform permissions and basic access', true, NOW(), NOW()),
  (gen_random_uuid(), 'HR_ADMIN', 'HR Admin', 'Full HR operations and system configuration access', true, NOW(), NOW());

-- Alter role_permissions table to use TEXT instead of enum
-- First, create a new column
ALTER TABLE "role_permissions" ADD COLUMN "role_new" TEXT;

-- Copy data from old column to new column (cast enum to text)
UPDATE "role_permissions" SET "role_new" = "role"::text;

-- Drop the old column
ALTER TABLE "role_permissions" DROP COLUMN "role";

-- Rename the new column
ALTER TABLE "role_permissions" RENAME COLUMN "role_new" TO "role";

-- Add primary key constraint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role");
