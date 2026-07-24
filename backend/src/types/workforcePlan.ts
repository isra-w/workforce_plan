import type { PlanningPeriod } from "@prisma/client";

export interface PlanPositionInput {
  title: string;
  count: number;
  employment_type: string;
  priority: string;
}

export interface CreatePlanInput {
  title: string;
  department_id: string;
  fiscal_year: number;
  planning_period?: PlanningPeriod;
  quarter?: number | null;
  justification?: string;
  positions?: PlanPositionInput[];
  created_by_id: string;
}

export interface UpdatePlanInput {
  title?: string;
  department_id?: string;
  fiscal_year?: number;
  planning_period?: PlanningPeriod;
  quarter?: number;
  justification?: string;
  positions?: PlanPositionInput[];
  save_as_new_version?: boolean;
  updated_by_id: string;
}

export interface ReviewPlanInput {
  action: "approve" | "reject";
  comment?: string;
  actor_id: string;
  role: string;
}

export interface AttachmentInput {
  plan_id: string;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
}
