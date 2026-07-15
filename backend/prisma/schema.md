# Prisma Schema Reference

This document explains every part of `schema.prisma` — what each section is,
what each model represents, and what every field does.

---

## Table of Contents

1. [What is schema.prisma?](#what-is-schemaprisma)
2. [Generator](#generator)
3. [Datasource](#datasource)
4. [Prisma Field Annotations](#prisma-field-annotations)
5. [Enums](#enums)
   - [UserRole](#userrole)
   - [PlanningPeriod](#planningperiod)
   - [PlanStatus](#planstatus)
   - [EmploymentType](#employmenttype)
   - [Priority](#priority)
6. [Models](#models)
   - [User](#user)
   - [Department](#department)
   - [PlanningCycle](#planningcycle)
   - [WorkforcePlan](#workforceplan)
   - [PlanPosition](#planposition)
   - [PlanVersion](#planversion)
   - [PlanAttachment](#planattachment)
   - [ApprovalLog](#approvallog)
7. [Entity Relationship Diagram](#entity-relationship-diagram)
8. [Common Prisma Commands](#common-prisma-commands)

---

## What is schema.prisma?

`schema.prisma` is the **single source of truth** for the database structure.
Prisma reads this file to do two things:

| Command | What it does |
|---|---|
| `npx prisma generate` | Generates the TypeScript client (`@prisma/client`) so the app can query the DB with full type safety |
| `npx prisma migrate dev` | Creates or updates the actual PostgreSQL tables to match this file |

Any time you change a model (add a field, rename a column, add a new table),
you edit this file and then run `migrate dev` to apply the change.

---

## Generator

```prisma
generator client {
  provider = "prisma-client-js"
}
```

Tells Prisma to generate a **JavaScript / TypeScript client**.
The generated code lives in `node_modules/@prisma/client` and is what the
backend imports to run database queries:

```ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
await prisma.user.findMany();
```

---

## Datasource

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

| Field | What it does |
|---|---|
| `provider` | Which database engine to use — PostgreSQL in this project |
| `url` | The connection string, read from the `DATABASE_URL` variable in `.env` so it is never hard-coded into the codebase |

A typical `DATABASE_URL` looks like:
```
postgresql://username:password@localhost:5432/workforce_db
```

---

## Prisma Field Annotations

These decorators appear on model fields throughout the schema.
Here is what each one means:

| Annotation | Meaning |
|---|---|
| `@id` | Marks the **primary key** column — every table has exactly one |
| `@default(uuid())` | Auto-generates a UUID for new rows so the app never needs to supply an ID |
| `@default(now())` | Sets the column to the current timestamp when a row is inserted |
| `@default(value)` | Sets any other default value (e.g. `@default(1)`, `@default(false)`) |
| `@updatedAt` | Automatically updates the column to the current time on every `UPDATE` |
| `@unique` | Adds a UNIQUE constraint — no two rows can have the same value in this column |
| `?` after a type | The field is **optional** (the SQL column is nullable) |
| `@relation(...)` | Defines a foreign-key link between two models |
| `onDelete: Cascade` | If the parent row is deleted, all related child rows are deleted automatically |
| `@@map("table_name")` | Sets the actual SQL table name (uses snake_case by convention) |

---

## Enums

An **enum** defines the only values a column is allowed to hold.
Using enums instead of plain strings prevents typos and self-documents
what values are valid.

---

### UserRole

Controls what actions each user can perform in the application.

| Value | Who | What they can do |
|---|---|---|
| `WORKFORCE_PLANNER` | HR planners, dept managers | Create, edit, submit, and delete plans |
| `HR` | HR department staff | Review and advance plans in `HR_REVIEW` status |
| `CEO` | Executive | Give final approval when a plan reaches `CEO_REVIEW` |
| `CANDIDATE` | Job applicants | Read-only access; cannot create or modify plans |

---

### PlanningPeriod

Whether a workforce plan covers a full year or a single quarter.

| Value | Meaning |
|---|---|
| `ANNUAL` | The plan covers the entire fiscal year (Jan – Dec) |
| `QUARTERLY` | The plan covers one quarter; the `quarter` field on the plan stores which one (1, 2, 3, or 4) |

---

### PlanStatus

The lifecycle states a workforce plan moves through from creation to final decision.

```
DRAFT → SUBMITTED → HR_REVIEW → CEO_REVIEW → APPROVED
            ↘             ↘             ↘
          REJECTED      REJECTED      REJECTED
```

| Value | Meaning |
|---|---|
| `DRAFT` | The planner is still editing; not yet submitted for review |
| `SUBMITTED` | The planner has submitted the plan; awaiting first review |
| `HR_REVIEW` | HR is currently reviewing the plan |
| `CEO_REVIEW` | The plan passed HR and is awaiting CEO sign-off |
| `APPROVED` | The CEO approved the plan; headcount is authorised |
| `REJECTED` | Rejected at any stage; the planner can edit and resubmit |

---

### EmploymentType

The contract basis for each requested position. Also used to calculate the
estimated budget shown on the dashboard (full-time ~$80k/yr, part-time ~$40k,
contract ~$60k).

| Value | Meaning |
|---|---|
| `FULL_TIME` | Standard permanent employee (40 hrs/week) |
| `PART_TIME` | Fewer than full-time hours |
| `CONTRACT` | Fixed-term or freelance engagement |

---

### Priority

How urgently a position needs to be filled. `HIGH` priority positions are
counted separately in the dashboard's "critical roles" KPI.

| Value | Meaning |
|---|---|
| `HIGH` | Critical role; flagged in the dashboard |
| `MEDIUM` | Important but not immediately blocking |
| `LOW` | Nice-to-have; lowest hiring priority |

---

## Models

---

### User

**SQL table:** `users`

Represents everyone who can log in to the application.

| Field | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Primary key, auto-generated |
| `email` | `String` | Login email address; must be unique across all users |
| `password_hash` | `String` | bcrypt hash of the user's password — the plain password is never stored |
| `full_name` | `String` | Display name shown in the UI and in approval logs |
| `role` | `UserRole` | Controls API access; defaults to `WORKFORCE_PLANNER` on registration |
| `title` | `String?` | Optional job title (e.g. "Senior HR Manager"); set via the complete-profile endpoint |
| `is_verified` | `Boolean` | `false` until the user clicks the verification link sent to their email |
| `verification_token` | `String?` | One-time token emailed on registration; set to `null` after the email is verified |
| `is_active` | `Boolean` | `false` to disable an account without deleting it |
| `created_at` | `DateTime` | When the account was registered |
| `updated_at` | `DateTime` | Auto-updated on every profile change |
| `plans` | relation | All `WorkforcePlan` rows this user created |
| `plan_versions` | relation | All `PlanVersion` snapshots this user saved |
| `approval_logs` | relation | All `ApprovalLog` entries this user authored |

---

### Department

**SQL table:** `departments`

An organisational unit (e.g. "Finance", "Marketing"). The static headcount
fields are maintained manually (via the seed script) and used by the dashboard
to compare planned headcount against current staffing levels.

| Field | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Primary key, auto-generated |
| `name` | `String` | Department name; must be unique (e.g. "Finance") |
| `code` | `String?` | Short code for reports (e.g. "FIN"); optional but unique |
| `approved_hc` | `Int` | Headcount officially approved in past cycles |
| `budgeted_hc` | `Int` | Headcount the department is budgeted to have this fiscal year |
| `current_hc` | `Int` | Actual number of staff currently employed |
| `created_at` | `DateTime` | When this department record was created |
| `plans` | relation | All `WorkforcePlan` rows linked to this department |

---

### PlanningCycle

**SQL table:** `planning_cycles`

A fiscal-year window that gates plan submissions. The backend requires an
active cycle (`is_active = true`) before a planner can submit a plan for
approval. Only one cycle should be active at any given time.

| Field | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Primary key; the seed uses a fixed UUID so re-running never creates a second active cycle |
| `fiscal_year` | `Int` | The year this cycle belongs to (e.g. `2025`) |
| `name` | `String` | Human-readable label (e.g. `"FY 2025 (Jan - Dec)"`) |
| `start_date` | `DateTime` | First day of the planning window |
| `end_date` | `DateTime` | Last day of the planning window |
| `is_active` | `Boolean` | Only an active cycle accepts new plan submissions |
| `created_at` | `DateTime` | When this cycle record was created |
| `plans` | relation | All `WorkforcePlan` rows submitted within this cycle |

---

### WorkforcePlan

**SQL table:** `workforce_plans`

The **core entity** of the application. A planner creates a plan for a
specific department and fiscal year, defines the positions they need (via
`PlanPosition` rows), and submits it through the multi-stage approval workflow.

| Field | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Primary key, auto-generated |
| `title` | `String` | Plan name shown in the UI (e.g. "FY2025 Finance Expansion") |
| `department_id` | `String` (FK) | Which department this plan is for → `Department.id` |
| `fiscal_year` | `Int` | The year the plan applies to (e.g. `2025`) |
| `planning_period` | `PlanningPeriod` | `ANNUAL` or `QUARTERLY`; defaults to `ANNUAL` |
| `quarter` | `Int?` | `1`–`4`; only set when `planning_period = QUARTERLY` |
| `start_date` | `DateTime?` | Optional start of the planned hiring window |
| `end_date` | `DateTime?` | Optional end of the planned hiring window |
| `justification` | `String?` | Free-text business case explaining why the headcount is needed |
| `status` | `PlanStatus` | Current stage in the approval pipeline; defaults to `DRAFT` |
| `version` | `Int` | Incremented each time "Save as New Version" is clicked; starts at `1` |
| `cycle_id` | `String?` (FK) | The planning cycle this plan was submitted under → `PlanningCycle.id`; `null` until submitted |
| `created_by_id` | `String` (FK) | The planner who owns this plan → `User.id` |
| `last_saved_at` | `DateTime` | Updated every time the plan is saved; shown in the UI |
| `submitted_at` | `DateTime?` | Set when the plan is first submitted for approval |
| `created_at` | `DateTime` | When the plan was first created |
| `updated_at` | `DateTime` | Auto-updated on every write; used to sort lists by most recent |
| `department` | relation | The linked `Department` object |
| `cycle` | relation | The linked `PlanningCycle` object (nullable) |
| `created_by` | relation | The `User` who created the plan |
| `positions` | relation | The `PlanPosition` rows that list requested roles |
| `attachments` | relation | The `PlanAttachment` rows for uploaded supporting documents |
| `versions` | relation | The `PlanVersion` history snapshots |
| `approval_logs` | relation | The `ApprovalLog` audit trail entries |

---

### PlanPosition

**SQL table:** `plan_positions`

A single role line-item inside a `WorkforcePlan`. Each row represents one
type of position the department wants to hire. A plan can have many positions.
Deleting the parent plan cascades and deletes all its positions.

| Field | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Primary key, auto-generated |
| `plan_id` | `String` (FK) | The plan this position belongs to → `WorkforcePlan.id` |
| `title` | `String` | Role title (e.g. "Senior Financial Analyst") |
| `count` | `Int` | How many people to hire for this role; defaults to `1` |
| `employment_type` | `EmploymentType` | `FULL_TIME`, `PART_TIME`, or `CONTRACT`; defaults to `FULL_TIME` |
| `priority` | `Priority` | `HIGH`, `MEDIUM`, or `LOW` urgency; defaults to `MEDIUM` |
| `plan` | relation | The parent `WorkforcePlan`; `onDelete: Cascade` |

---

### PlanVersion

**SQL table:** `plan_versions`

An **immutable JSON snapshot** of a `WorkforcePlan` saved at a point in time.
Created when a plan is first saved and whenever the planner clicks
"Save as New Version". Used to show a history of changes.
Deleting the parent plan cascades and deletes all its versions.

| Field | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Primary key, auto-generated |
| `plan_id` | `String` (FK) | The plan this snapshot belongs to → `WorkforcePlan.id` |
| `version` | `Int` | The version number at the time of the snapshot (e.g. `1`, `2`, `3`) |
| `snapshot` | `Json` | Complete copy of the plan object (including positions) at this version |
| `created_by_id` | `String` (FK) | Who triggered this version save → `User.id` |
| `created_at` | `DateTime` | When this snapshot was taken |
| `plan` | relation | The parent `WorkforcePlan`; `onDelete: Cascade` |
| `created_by` | relation | The `User` who saved this version |

---

### PlanAttachment

**SQL table:** `plan_attachments`

Metadata for a **file uploaded alongside a workforce plan** as a supporting
document (e.g. budget spreadsheet, org chart, job description PDF).
The actual file bytes are stored on the server's local disk under
`/backend/uploads/`. This model only stores the metadata needed to
reference and display the file.
Deleting the parent plan cascades and deletes the attachment record
(the route handler also deletes the physical file from disk).

| Field | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Primary key, auto-generated |
| `plan_id` | `String` (FK) | The plan this file belongs to → `WorkforcePlan.id` |
| `filename` | `String` | Original filename as uploaded by the user (e.g. `"budget_2025.pdf"`) |
| `filepath` | `String` | Absolute path on the server disk where the file is stored |
| `mimetype` | `String?` | MIME type detected on upload (e.g. `"application/pdf"`); nullable for older rows |
| `size` | `Int?` | File size in bytes (e.g. `204800` = 200 KB); nullable for older rows |
| `created_at` | `DateTime` | When the file was uploaded |
| `plan` | relation | The parent `WorkforcePlan`; `onDelete: Cascade` |

**Allowed file types:** PDF, Word (.doc/.docx), Excel (.xls/.xlsx), JPEG, PNG, GIF.
**Maximum file size:** 10 MB per file (enforced by multer on the backend).

---

### ApprovalLog

**SQL table:** `approval_logs`

An **append-only audit trail** entry written every time a plan changes status.
Rows are never updated — only inserted (and deleted by cascade if the plan
is deleted). This gives a full history of who did what and when.

One row is written for each of these events:

| Event | `action` value | When it happens |
|---|---|---|
| Planner submits the plan | `SUBMITTED` | `POST /plans/:id/submit` |
| Planner withdraws to draft | `WITHDRAWN` | `PUT /plans/:id` (while status is SUBMITTED) |
| Reviewer approves | `APPROVE` | `POST /plans/:id/review` with `action: "approve"` |
| Reviewer rejects | `REJECT` | `POST /plans/:id/review` with `action: "reject"` |

| Field | Type | Description |
|---|---|---|
| `id` | `String` (UUID) | Primary key, auto-generated |
| `plan_id` | `String` (FK) | Which plan this log entry is about → `WorkforcePlan.id` |
| `actor_id` | `String` (FK) | Who performed the action → `User.id` |
| `action` | `String` | What happened: `"SUBMITTED"`, `"APPROVE"`, `"REJECT"`, `"WITHDRAWN"` |
| `comment` | `String?` | Optional note; **required** for `REJECT` actions (enforced in the controller) |
| `from_status` | `PlanStatus?` | The plan's status before this action; `null` for the very first log entry |
| `to_status` | `PlanStatus` | The plan's status after this action |
| `created_at` | `DateTime` | When this event occurred |
| `plan` | relation | The parent `WorkforcePlan`; `onDelete: Cascade` |
| `actor` | relation | The `User` who performed this action (loaded to display their name in the UI) |

---

## Entity Relationship Diagram

```
User ──────────────────────────────────────────────────────────────────┐
 │ (created_by)                                                         │
 │                                                                      │
 ▼                                                                      │
WorkforcePlan ──── department_id ──► Department                        │
     │                                                                  │
     │ ──── cycle_id ──────────────► PlanningCycle                     │
     │                                                                  │
     ├──── positions ──────────────► PlanPosition (cascade delete)     │
     │                                                                  │
     ├──── attachments ────────────► PlanAttachment (cascade delete)   │
     │                                                                  │
     ├──── versions ───────────────► PlanVersion (cascade delete) ◄────┘
     │                                                   (created_by)
     │
     └──── approval_logs ──────────► ApprovalLog (cascade delete)
                                          │
                                          └── actor_id ──► User
```

**Cascade delete** means: deleting a `WorkforcePlan` automatically deletes
all of its `PlanPosition`, `PlanAttachment`, `PlanVersion`, and `ApprovalLog`
rows. You never need to delete them manually.

---

## Common Prisma Commands

Run these from the `backend/` folder.

| Command | What it does |
|---|---|
| `npx prisma generate` | Regenerates the TypeScript client after any schema change |
| `npx prisma migrate dev --name <description>` | Creates a new SQL migration file and applies it to the dev database |
| `npx prisma migrate deploy` | Applies all pending migrations to a production database |
| `npx prisma db seed` | Runs `prisma/seed.ts` to populate the database with initial data |
| `npx prisma studio` | Opens a web UI at `localhost:5555` to browse and edit database rows |
| `npx prisma db push` | Pushes schema changes directly to the database without creating a migration file (useful for rapid prototyping) |
| `npx prisma migrate reset` | Drops the database, re-runs all migrations, and re-seeds (⚠️ destroys all data) |
