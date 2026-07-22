-- AlterTable: change users.role from UserRole enum to TEXT
-- First cast the existing enum values to text
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT USING "role"::text;

-- Set the default to a plain string
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'WORKFORCE_PLANNER';
