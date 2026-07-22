-- Migration: add user_permissions table
-- Stores granular resource × action grants per user.

CREATE TABLE "user_permissions" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id"    TEXT         NOT NULL,
  "resource"   TEXT         NOT NULL,
  "action"     TEXT         NOT NULL,
  "granted"    BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_permissions_user_id_resource_action_key"
  ON "user_permissions"("user_id", "resource", "action");

ALTER TABLE "user_permissions"
  ADD CONSTRAINT "user_permissions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
