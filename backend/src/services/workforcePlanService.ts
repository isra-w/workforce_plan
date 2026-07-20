/**
 * services/workforcePlanService.ts
 *
 * All database interactions for workforce plans, departments, positions,
 * attachments, versions, approval logs, and vacancies.
 *
 * Controllers call these methods and only deal with HTTP concerns (status
 * codes, request/response shape). No Express types live here.
 */
import { PlanStatus, PlanningPeriod, EmploymentType, Priority, Prisma } from "@prisma/client";
import { prisma } from "src/utils/prisma";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface CreatePlanInput {
  title: string;
  department_id: string;
  fiscal_year: number;
  planning_period?: PlanningPeriod;
  quarter?: number | null;
  justification?: string;
  positions?: Array<{
    title: string;
    count: number;
    employment_type: string;
    priority: string;
  }>;
  created_by_id: string;
}

export interface UpdatePlanInput {
  title?: string;
  department_id?: string;
  fiscal_year?: number;
  planning_period?: PlanningPeriod;
  quarter?: number;
  justification?: string;
  positions?: Array<{
    title: string;
    count: number;
    employment_type: string;
    priority: string;
  }>;
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

// ---------------------------------------------------------------------------
// Shared Prisma include — used by every plan query for consistent shape
// ---------------------------------------------------------------------------
export const planInclude = {
  department: true,
  created_by: {
    select: { id: true, full_name: true, email: true },
  },
  positions: true,
  attachments: true,
  approval_logs: {
    include: {
      actor: { select: { id: true, full_name: true, role: true } },
    },
    orderBy: { created_at: "asc" as const },
  },
  versions: {
    orderBy: { version: "desc" as const },
    take: 5,
    include: {
      created_by: { select: { id: true, full_name: true } },
    },
  },
} satisfies Prisma.WorkforcePlanInclude;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSnapshot(plan: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(plan));
}

function mapPositions(
  positions: Array<Record<string, string | number>>,
) {
  return positions.map((p) => ({
    title: String(p.title),
    count: Number(p.count) || 1,
    employment_type: (p.employment_type as EmploymentType) || EmploymentType.FULL_TIME,
    priority: (p.priority as Priority) || Priority.MEDIUM,
  }));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardData(role: string) {
  const [departments, allPlans, activeRequests] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),

    prisma.workforcePlan.findMany({
      where: { status: { notIn: ["DRAFT"] } },
      include: { department: true, positions: true },
      orderBy: { updated_at: "desc" },
    }),

    prisma.workforcePlan.findMany({
      where: {
        status: {
          in:
            role === "HR"
              ? ["SUBMITTED"]
              : role === "CEO"
                ? ["HR_APPROVED"]
                : ["SUBMITTED", "HR_APPROVED"],
        },
      },
      include: {
        department: true,
        positions: true,
        created_by: { select: { full_name: true } },
      },
      orderBy: { updated_at: "desc" },
      take: 24,
    }),
  ]);

  // Per-department aggregation
  const deptStats: Record<
    string,
    {
      requested_hc: number;
      approved_hc: number;
      pending_hc: number;
      plan_count: number;
      latest_status: string;
    }
  > = {};

  for (const dept of departments) {
    deptStats[dept.id] = {
      requested_hc: 0,
      approved_hc: 0,
      pending_hc: 0,
      plan_count: 0,
      latest_status: "",
    };
  }

  for (const plan of allPlans) {
    const hc = plan.positions.reduce((s, p) => s + p.count, 0);
    if (!deptStats[plan.department_id]) continue;
    deptStats[plan.department_id].requested_hc += hc;
    deptStats[plan.department_id].plan_count += 1;
    deptStats[plan.department_id].latest_status = plan.status;
    if (plan.status === "APPROVED") {
      deptStats[plan.department_id].approved_hc += hc;
    } else {
      deptStats[plan.department_id].pending_hc += hc;
    }
  }

  const departmentsWithStats = departments.map((d) => ({
    ...d,
    ...deptStats[d.id],
  }));

  // Global KPIs
  const totalApprovedHc = allPlans
    .filter((p) => p.status === "APPROVED")
    .reduce((s, p) => s + p.positions.reduce((ps, pos) => ps + pos.count, 0), 0);

  const totalCurrentStaff = departments.reduce((s, d) => s + d.current_hc, 0);

  const capacityBase =
    totalApprovedHc || departments.reduce((s, d) => s + d.approved_hc, 0);

  const capacityPercent = capacityBase
    ? Math.round((totalCurrentStaff / capacityBase) * 1000) / 10
    : 0;

  const pendingRequests = activeRequests.length;

  const openVacancies = activeRequests.reduce(
    (s, p) => s + p.positions.reduce((ps, pos) => ps + pos.count, 0),
    0,
  );

  const criticalRoles = activeRequests.reduce(
    (s, p) =>
      s +
      p.positions
        .filter((pos) => pos.priority === "HIGH")
        .reduce((ps, pos) => ps + pos.count, 0),
    0,
  );

  return {
    kpis: {
      totalApprovedHeadcount: totalApprovedHc,
      currentActiveStaff: totalCurrentStaff,
      capacityPercent,
      pendingRequests,
      openVacancies,
      criticalRoles,
    },
    departments: departmentsWithStats,
    activeRequests,
    allPlans,
  };
}

// ---------------------------------------------------------------------------
// Plans — list
// ---------------------------------------------------------------------------

export async function listPlans(role: string) {
  let where: Prisma.WorkforcePlanWhereInput = {};
  if (role === "HR") where.status = "SUBMITTED";
  else if (role === "CEO") where.status = "HR_APPROVED";

  return prisma.workforcePlan.findMany({
    where,
    include: planInclude,
    orderBy: { updated_at: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Plans — single
// ---------------------------------------------------------------------------

export async function findPlanById(id: string) {
  return prisma.workforcePlan.findUnique({
    where: { id },
    include: planInclude,
  });
}

// ---------------------------------------------------------------------------
// Plans — create
// ---------------------------------------------------------------------------

export async function createPlan(input: CreatePlanInput) {
  const plan = await prisma.workforcePlan.create({
    data: {
      title: input.title,
      department_id: input.department_id,
      fiscal_year: input.fiscal_year,
      planning_period: input.planning_period ?? "ANNUAL",
      quarter: input.quarter ?? null,
      justification: input.justification,
      status: "DRAFT",
      version: 1,
      created_by_id: input.created_by_id,
      positions: input.positions?.length
        ? { create: mapPositions(input.positions as Array<Record<string, string | number>>) }
        : undefined,
    },
    include: planInclude,
  });

  await prisma.planVersion.create({
    data: {
      plan_id: plan.id,
      version: 1,
      snapshot: buildSnapshot(plan as unknown as Record<string, unknown>),
      created_by_id: input.created_by_id,
    },
  });

  return plan;
}

// ---------------------------------------------------------------------------
// Plans — update
// ---------------------------------------------------------------------------

export async function updatePlan(id: string, input: UpdatePlanInput) {
  const existing = await prisma.workforcePlan.findUnique({
    where: { id },
    include: { positions: true },
  });

  if (!existing) return null;

  if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(existing.status)) {
    throw new Error("Only draft, submitted, or rejected plans can be edited");
  }

  const isRevision = existing.status === "REJECTED";
  const newVersion =
    isRevision || input.save_as_new_version === true
      ? existing.version + 1
      : existing.version;

  const newStatus = existing.status === "SUBMITTED" ? "DRAFT" : existing.status;

  if (input.positions) {
    await prisma.planPosition.deleteMany({ where: { plan_id: id } });
  }

  const plan = await prisma.workforcePlan.update({
    where: { id },
    data: {
      title: input.title ?? existing.title,
      department_id: input.department_id ?? existing.department_id,
      fiscal_year: input.fiscal_year ?? existing.fiscal_year,
      planning_period: input.planning_period ?? existing.planning_period,
      quarter: input.quarter !== undefined ? input.quarter : existing.quarter,
      justification: input.justification ?? existing.justification,
      version: newVersion,
      status: newStatus,
      last_saved_at: new Date(),
      positions: input.positions?.length
        ? { create: mapPositions(input.positions as Array<Record<string, string | number>>) }
        : undefined,
    },
    include: planInclude,
  });

  if (newVersion !== existing.version) {
    await prisma.planVersion.create({
      data: {
        plan_id: plan.id,
        version: newVersion,
        snapshot: buildSnapshot(plan as unknown as Record<string, unknown>),
        created_by_id: input.updated_by_id,
      },
    });
  }

  if (existing.status === "SUBMITTED") {
    await prisma.approvalLog.create({
      data: {
        plan_id: plan.id,
        actor_id: input.updated_by_id,
        action: "WITHDRAWN",
        from_status: "SUBMITTED",
        to_status: "DRAFT",
        comment: "Plan withdrawn for editing",
      },
    });
  } else if (isRevision) {
    await prisma.approvalLog.create({
      data: {
        plan_id: plan.id,
        actor_id: input.updated_by_id,
        action: "REVISED",
        from_status: "REJECTED",
        to_status: "REJECTED",
        comment: `Plan revised after rejection (now v${newVersion})`,
      },
    });
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Plans — submit
// ---------------------------------------------------------------------------

export async function submitPlan(id: string, actor_id: string) {
  const existing = await prisma.workforcePlan.findUnique({
    where: { id },
    include: { positions: true },
  });

  if (!existing) return null;

  if (!["DRAFT", "REJECTED"].includes(existing.status)) {
    throw new Error("Plan has already been submitted");
  }

  if (
    !existing.title ||
    !existing.justification ||
    existing.positions.length === 0
  ) {
    throw new Error(
      "Title, justification, and at least one position are required before submission",
    );
  }

  const plan = await prisma.workforcePlan.update({
    where: { id },
    data: { status: "SUBMITTED", submitted_at: new Date() },
    include: planInclude,
  });

  await prisma.approvalLog.create({
    data: {
      plan_id: plan.id,
      actor_id,
      action: "SUBMITTED",
      from_status: existing.status as PlanStatus,
      to_status: "SUBMITTED",
      comment:
        existing.status === "REJECTED"
          ? `Resubmitted for HR review (v${existing.version})`
          : `Submitted for HR review (v${existing.version})`,
    },
  });

  return plan;
}

// ---------------------------------------------------------------------------
// Plans — review (HR / CEO)
// ---------------------------------------------------------------------------

export async function reviewPlan(id: string, input: ReviewPlanInput) {
  const existing = await prisma.workforcePlan.findUnique({ where: { id } });
  if (!existing) return null;

  let nextStatus: PlanStatus | null = null;

  if (input.action === "approve") {
    if (input.role === "HR" && existing.status === "SUBMITTED")
      nextStatus = "HR_APPROVED";
    else if (input.role === "CEO" && existing.status === "HR_APPROVED")
      nextStatus = "APPROVED";
  } else if (input.action === "reject") {
    if (input.role === "HR" && existing.status === "SUBMITTED")
      nextStatus = "REJECTED";
    else if (input.role === "CEO" && existing.status === "HR_APPROVED")
      nextStatus = "REJECTED";
  }

  if (!nextStatus) {
    throw new Error(
      "Invalid review action for your role and the plan's current status",
    );
  }

  if (input.action === "reject" && !input.comment) {
    throw new Error("A comment is required when rejecting a plan");
  }

  const plan = await prisma.workforcePlan.update({
    where: { id },
    data: { status: nextStatus },
    include: planInclude,
  });

  await prisma.approvalLog.create({
    data: {
      plan_id: plan.id,
      actor_id: input.actor_id,
      action:
        input.action === "approve"
          ? input.role === "HR"
            ? "HR_APPROVED"
            : "CEO_APPROVED"
          : `${input.role}_REJECTED`,
      from_status: existing.status,
      to_status: nextStatus,
      comment: input.comment,
    },
  });

  return plan;
}

// ---------------------------------------------------------------------------
// Plans — delete
// ---------------------------------------------------------------------------

export async function deletePlan(id: string) {
  const existing = await prisma.workforcePlan.findUnique({ where: { id } });
  if (!existing) return null;

  if (!["DRAFT", "SUBMITTED"].includes(existing.status)) {
    throw new Error("Only draft or submitted plans can be deleted");
  }

  await prisma.workforcePlan.delete({ where: { id } });
  return true;
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export async function listDepartments() {
  return prisma.department.findMany({ orderBy: { name: "asc" } });
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export async function listVersions(plan_id: string) {
  return prisma.planVersion.findMany({
    where: { plan_id },
    include: { created_by: { select: { full_name: true } } },
    orderBy: { version: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Vacancies
// ---------------------------------------------------------------------------

export async function listVacancies() {
  const plans = await prisma.workforcePlan.findMany({
    where: { status: "APPROVED" },
    include: {
      department: true,
      positions: true,
      created_by: { select: { id: true, full_name: true, email: true } },
    },
    orderBy: { updated_at: "desc" },
  });

  return plans.flatMap((plan) =>
    (plan.positions ?? []).map((pos) => ({
      id: pos.id,
      title: pos.title,
      count: pos.count,
      employment_type: pos.employment_type,
      priority: pos.priority,
      plan_id: plan.id,
      plan_title: plan.title,
      fiscal_year: plan.fiscal_year,
      planning_period: plan.planning_period,
      quarter: plan.quarter,
      department: plan.department,
      created_by: plan.created_by,
    })),
  );
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function createAttachment(input: AttachmentInput) {
  return prisma.planAttachment.create({ data: input });
}

export async function findAttachment(id: string) {
  return prisma.planAttachment.findUnique({ where: { id } });
}

export async function deleteAttachment(id: string) {
  return prisma.planAttachment.delete({ where: { id } });
}

export async function findPlanForAttachment(plan_id: string) {
  return prisma.workforcePlan.findUnique({ where: { id: plan_id } });
}
