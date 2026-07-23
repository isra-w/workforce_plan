-- Drop user_permissions table (replaced by role-level Allowed/Denied in role_permissions)
DROP TABLE IF EXISTS "user_permissions";

-- Drop title column from users (unused, no UI)
ALTER TABLE "users" DROP COLUMN IF EXISTS "title";
