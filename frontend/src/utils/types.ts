/**
 * utils/types.ts
 *
 * Shared TypeScript type definitions used across the frontend.
 *
 * UserRole       — union of the four roles recognised by the backend.
 *
 * User           — the authenticated user's public profile returned by /auth/me
 *                  and stored in localStorage.
 *
 * Department     — a business unit with static DB headcount baselines
 *                  (approved_hc, budgeted_hc, current_hc) plus optional live
 *                  fields computed by the dashboard endpoint from real plan data
 *                  (requested_hc, approved_hc_plans, pending_hc, plan_count,
 *                  latest_status).
 *
 * PlanPosition   — a single role line-item inside a WorkforcePlan.
 *
 * WorkforcePlan  — full plan record including optional relations (department,
 *                  positions, created_by, approval_logs, versions).
 *
 * ApprovalLog    — one audit entry recording a status transition performed by
 *                  a reviewer.
 *
 * PlanVersion    — metadata for a saved plan snapshot (version number, author,
 *                  timestamp).
 *
 * PlanAttachment — a single file attached to a plan. Mirrors the PlanAttachment
 *                  Prisma model: id, plan_id, original filename, server filepath,
 *                  MIME type, byte size, and creation timestamp.
 *
 * DashboardData  — shape of the response returned by GET /workforce/dashboard,
 *                  containing KPI metrics, department list, active requests, and
 *                  all non-draft plans.
 */
export type UserRole = "WORKFORCE_PLANNER" | "HR" | "CEO" | "CANDIDATE";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  title?: string;
  is_verified: boolean;
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  approved_hc: number;
  budgeted_hc: number;
  current_hc: number;
  // Live computed from real plan data
  requested_hc?: number;
  approved_hc_plans?: number; // headcount from APPROVED plans
  pending_hc?: number;
  plan_count?: number;
  latest_status?: string;
}

export interface PlanPosition {
  id?: string;
  title: string;
  count: number;
  employment_type: "FULL_TIME" | "PART_TIME" | "CONTRACT";
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface WorkforcePlan {
  id: string;
  title: string;
  department_id: string;
  fiscal_year: number;
  planning_period: "ANNUAL" | "QUARTERLY";
  quarter?: number;
  start_date?: string;
  end_date?: string;
  justification?: string;
  status: string;
  version: number;
  last_saved_at: string;
  department?: Department;
  positions?: PlanPosition[];
  attachments?: PlanAttachment[];
  created_by?: { full_name: string; email: string };
  approval_logs?: ApprovalLog[];
  versions?: PlanVersion[];
}

export interface ApprovalLog {
  id: string;
  action: string;
  comment?: string;
  from_status?: string;
  to_status: string;
  created_at: string;
  actor?: { full_name: string; role: string };
}

export interface PlanVersion {
  id: string;
  version: number;
  created_at: string;
  created_by?: { full_name: string };
}

/**
 * PlanAttachment
 *
 * Mirrors the PlanAttachment model in the Prisma schema.
 * Returned inside WorkforcePlan.attachments[] by the getPlan endpoint.
 *
 *   id         UUID primary key.
 *   plan_id    FK to the parent WorkforcePlan.
 *   filename   The original filename as uploaded by the user (e.g. "budget.pdf").
 *   filepath   Absolute server path where the file is stored on disk.
 *   mimetype   MIME type detected by multer (e.g. "application/pdf").
 *   size       File size in bytes.
 *   created_at ISO timestamp of when the attachment was uploaded.
 */
export interface PlanAttachment {
  id: string;
  plan_id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  created_at: string;
}

export interface DashboardData {
  kpis: {
    totalApprovedHeadcount: number;
    currentActiveStaff: number;
    capacityPercent: number;
    pendingRequests: number;
    openVacancies: number;
    criticalRoles: number;
    estBudgetUSD: number;
  };
  departments: Department[];
  activeRequests: WorkforcePlan[];
  allPlans: WorkforcePlan[];
}
