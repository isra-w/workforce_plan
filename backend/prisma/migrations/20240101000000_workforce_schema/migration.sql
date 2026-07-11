CREATE TYPE "UserRole" AS ENUM (
  'WORKFORCE_PLANNER',
  'HR',
  'CEO',
  'CANDIDATE'
);

CREATE TYPE "PlanningPeriod" AS ENUM (
  'ANNUAL',
  'QUARTERLY'
);

CREATE TYPE "PlanStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'HR_REVIEW',
  'FINANCE_REVIEW',
  'CEO_REVIEW',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE "EmploymentType" AS ENUM (
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT'
);
CREATE TYPE "Priority" AS ENUM (
  'HIGH',
  'MEDIUM',
  'LOW'
);

-- ---------------------------------------------------------------------------
-- Table: users
-- Stores application accounts. password_hash holds a bcrypt digest.
-- verification_token is a random hex string cleared after email confirmation.
-- ---------------------------------------------------------------------------

CREATE TABLE "users" (
  "id"                 TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "email"              TEXT         NOT NULL,
  "password_hash"      TEXT         NOT NULL,
  "full_name"          TEXT         NOT NULL,
  "role"               "UserRole"   NOT NULL DEFAULT 'WORKFORCE_PLANNER',
  "title"              TEXT,
  "is_verified"        BOOLEAN      NOT NULL DEFAULT false,
  "verification_token" TEXT,
  "is_active"          BOOLEAN      NOT NULL DEFAULT true,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- ---------------------------------------------------------------------------
-- Table: departments
-- Organisational units. approved_hc / budgeted_hc / current_hc are static
-- baselines; live figures are derived at query time from plan data.
-- ---------------------------------------------------------------------------

CREATE TABLE "departments" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "name"        TEXT         NOT NULL,
  "code"        TEXT,
  "approved_hc" INTEGER      NOT NULL DEFAULT 0,
  "budgeted_hc" INTEGER      NOT NULL DEFAULT 0,
  "current_hc"  INTEGER      NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- ---------------------------------------------------------------------------
-- Table: planning_cycles
-- Fiscal-year windows. Only one row should have is_active = true at a time
-- (enforced at the application layer by cycleMiddleware).
-- ---------------------------------------------------------------------------

CREATE TABLE "planning_cycles" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "fiscal_year" INTEGER      NOT NULL,
  "name"        TEXT         NOT NULL,
  "start_date"  TIMESTAMP(3) NOT NULL,
  "end_date"    TIMESTAMP(3) NOT NULL,
  "is_active"   BOOLEAN      NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "planning_cycles_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------------------
-- Table: workforce_plans
-- Core planning entity. Moves through the PlanStatus lifecycle:
--   DRAFT → SUBMITTED → HR_REVIEW → CEO_REVIEW → APPROVED | REJECTED
-- ---------------------------------------------------------------------------

CREATE TABLE "workforce_plans" (
  "id"              TEXT             NOT NULL DEFAULT gen_random_uuid()::text,
  "title"           TEXT             NOT NULL,
  "department_id"   TEXT             NOT NULL,
  "fiscal_year"     INTEGER          NOT NULL,
  "planning_period" "PlanningPeriod" NOT NULL DEFAULT 'ANNUAL',
  "quarter"         INTEGER,
  "start_date"      TIMESTAMP(3),
  "end_date"        TIMESTAMP(3),
  "justification"   TEXT,
  "status"          "PlanStatus"     NOT NULL DEFAULT 'DRAFT',
  "version"         INTEGER          NOT NULL DEFAULT 1,
  "cycle_id"        TEXT,
  "created_by_id"   TEXT             NOT NULL,
  "last_saved_at"   TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at"    TIMESTAMP(3),
  "created_at"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "workforce_plans_pkey" PRIMARY KEY ("id")
);

-- Indexes for common filter / join patterns
CREATE INDEX "workforce_plans_department_id_idx" ON "workforce_plans"("department_id");
CREATE INDEX "workforce_plans_created_by_id_idx" ON "workforce_plans"("created_by_id");
CREATE INDEX "workforce_plans_cycle_id_idx"       ON "workforce_plans"("cycle_id");
CREATE INDEX "workforce_plans_status_idx"         ON "workforce_plans"("status");

-- ---------------------------------------------------------------------------
-- Table: plan_positions
-- Individual role line-items requested within a plan. Cascade-deleted when
-- the parent plan is deleted.
-- ---------------------------------------------------------------------------

CREATE TABLE "plan_positions" (
  "id"              TEXT             NOT NULL DEFAULT gen_random_uuid()::text,
  "plan_id"         TEXT             NOT NULL,
  "title"           TEXT             NOT NULL,
  "count"           INTEGER          NOT NULL DEFAULT 1,
  "employment_type" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
  "priority"        "Priority"       NOT NULL DEFAULT 'MEDIUM',

  CONSTRAINT "plan_positions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plan_positions_plan_id_idx" ON "plan_positions"("plan_id");

-- ---------------------------------------------------------------------------
-- Table: plan_versions
-- Immutable JSON snapshots of a plan at each significant state change.
-- Used for the version history / audit trail UI.
-- ---------------------------------------------------------------------------

CREATE TABLE "plan_versions" (
  "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "plan_id"       TEXT         NOT NULL,
  "version"       INTEGER      NOT NULL,
  "snapshot"      JSONB        NOT NULL,
  "created_by_id" TEXT         NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plan_versions_plan_id_idx" ON "plan_versions"("plan_id");

-- ---------------------------------------------------------------------------
-- Table: plan_attachments
-- Metadata for files uploaded alongside a plan (stored on disk).
-- ---------------------------------------------------------------------------

CREATE TABLE "plan_attachments" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "plan_id"    TEXT         NOT NULL,
  "filename"   TEXT         NOT NULL,
  "filepath"   TEXT         NOT NULL,
  "mimetype"   TEXT,
  "size"       INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "plan_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "plan_attachments_plan_id_idx" ON "plan_attachments"("plan_id");

-- ---------------------------------------------------------------------------
-- Table: approval_logs
-- Append-only audit trail. One row per status transition or reviewer action.
-- ---------------------------------------------------------------------------

CREATE TABLE "approval_logs" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "plan_id"     TEXT         NOT NULL,
  "actor_id"    TEXT         NOT NULL,
  "action"      TEXT         NOT NULL,
  "comment"     TEXT,
  "from_status" "PlanStatus",
  "to_status"   "PlanStatus" NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "approval_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_logs_plan_id_idx"  ON "approval_logs"("plan_id");
CREATE INDEX "approval_logs_actor_id_idx" ON "approval_logs"("actor_id");

-- ---------------------------------------------------------------------------
-- Foreign Keys
-- Defined after all tables exist to avoid ordering issues.
-- ---------------------------------------------------------------------------

-- workforce_plans → departments
ALTER TABLE "workforce_plans"
  ADD CONSTRAINT "workforce_plans_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- workforce_plans → planning_cycles (nullable)
ALTER TABLE "workforce_plans"
  ADD CONSTRAINT "workforce_plans_cycle_id_fkey"
  FOREIGN KEY ("cycle_id") REFERENCES "planning_cycles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- workforce_plans → users
ALTER TABLE "workforce_plans"
  ADD CONSTRAINT "workforce_plans_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- plan_positions → workforce_plans (cascade delete)
ALTER TABLE "plan_positions"
  ADD CONSTRAINT "plan_positions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "workforce_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- plan_versions → workforce_plans (cascade delete)
ALTER TABLE "plan_versions"
  ADD CONSTRAINT "plan_versions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "workforce_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- plan_versions → users
ALTER TABLE "plan_versions"
  ADD CONSTRAINT "plan_versions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- plan_attachments → workforce_plans (cascade delete)
ALTER TABLE "plan_attachments"
  ADD CONSTRAINT "plan_attachments_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "workforce_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- approval_logs → workforce_plans (cascade delete)
ALTER TABLE "approval_logs"
  ADD CONSTRAINT "approval_logs_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "workforce_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- approval_logs → users
ALTER TABLE "approval_logs"
  ADD CONSTRAINT "approval_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
