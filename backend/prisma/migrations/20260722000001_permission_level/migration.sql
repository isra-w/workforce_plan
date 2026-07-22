-- Migration: replace boolean granted with a 4-level scope string
-- Levels: N/A (no permission) | Own (own records) | Team (department) | Any (all)

ALTER TABLE "user_permissions"
  ADD COLUMN "level" TEXT NOT NULL DEFAULT 'N/A';

-- Migrate existing rows: granted=true → 'Any', granted=false → 'N/A'
UPDATE "user_permissions" SET "level" = CASE WHEN "granted" = true THEN 'Any' ELSE 'N/A' END;

ALTER TABLE "user_permissions" DROP COLUMN "granted";
