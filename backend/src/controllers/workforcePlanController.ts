/**
 * controllers/workforcePlanController.ts
 *
 * Contains all business logic for workforce plans and the dashboard. Each
 * exported function is an Express route handler that uses Prisma to read/write
 * the database and returns JSON responses in the shape { status, data }.
 *
 * getDashboard   — fetches KPI metrics and per-department headcount stats in a
 *                  single response. Runs three Prisma queries in parallel:
 *                  all departments, all non-draft plans, and in-flight requests.
 *                  Derives approved/pending headcount, capacity %, open vacancies,
 *                  critical-role count, and a rough budget estimate on the server.
 *
 * getPlans       — returns a filterable list of plans (by status and/or department).
 *
 * getPlan        — returns a single plan with all relations (department, positions,
 *                  attachments, approval logs, recent versions).
 *
 * createPlan     — creates a new DRAFT plan and writes its first PlanVersion
 *                  snapshot. Links the plan to the currently active planning cycle.
 *
 * updatePlan     — updates a DRAFT, SUBMITTED, or REJECTED plan. Re-creates
 *                  positions if provided. Reverts SUBMITTED plans back to DRAFT
 *                  and logs a WITHDRAWN approval event. Optionally bumps the
 *                  version and creates a new PlanVersion snapshot.
 *
 * submitPlan     — transitions a DRAFT/REJECTED plan to SUBMITTED, records a
 *                  submission approval log, and requires an active planning cycle.
 *
 * reviewPlan     — role-gated status transitions:
 *                    WORKFORCE_PLANNER: SUBMITTED → HR_REVIEW
 *                    HR:               HR_REVIEW  → CEO_REVIEW
 *                    CEO:              CEO_REVIEW → APPROVED
 *                    any role:         * → REJECTED (comment required)
 *                  Each transition is recorded in ApprovalLog.
 *
 * getDepartments — returns all departments sorted by name.
 *
 * getVersions    — returns the version history for a specific plan.
 *
 * deletePlan     — hard-deletes a DRAFT or SUBMITTED plan (cascades to positions,
 *                  attachments, versions, and approval logs via Prisma relations).
 *
 * planInclude    — reusable Prisma `include` object used by all plan queries to
 *                  eager-load related data consistently.
 *
 * buildSnapshot  — deep-clones a plan object into a plain JSON value suitable
 *                  for storing as a PlanVersion snapshot.
 */
import { Response, NextFunction } from "express";
import { PlanStatus, PlanningPeriod, Prisma } from "@prisma/client";
import { prisma } from "src/utils/prisma";
import { AuthRequest } from "src/middleware/authMiddleware";

const planInclude = {
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
};

function buildSnapshot(plan: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(plan));
}

export const getDashboard = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // ── 1. Fetch all data in parallel ──────────────────────────────────────
    const [departments, allPlans, activeRequests] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: "asc" } }),

      // ALL non-draft plans — shown in the department headcount table
      prisma.workforcePlan.findMany({
        where: {
          status: {
            notIn: ["DRAFT"],
          },
        },
        include: { department: true, positions: true },
        orderBy: { updated_at: "desc" },
      }),

      // Active in-flight requests (not draft, not yet approved/rejected)
      prisma.workforcePlan.findMany({
        where: {
          status: { in: ["SUBMITTED", "HR_REVIEW", "FINANCE_REVIEW", "CEO_REVIEW"] },
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

    // ── 2. Per-department aggregation from real plan data ──────────────────
    //
    // For the department table we compute:
    //   requested_hc  = sum of positions.count across all plans for that dept
    //   approved_hc   = sum of positions.count across APPROVED plans for that dept
    //   pending_hc    = sum of positions.count across in-flight plans for that dept
    //   plan_count    = number of plans for that dept (any non-draft status)
    //
    // We still surface the static dept fields (approved_hc, budgeted_hc, current_hc)
    // so the table can show both the DB baseline AND what planners have actually entered.

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
      const planHc = plan.positions.reduce((s, p) => s + p.count, 0);
      if (!deptStats[plan.department_id]) continue;

      deptStats[plan.department_id].requested_hc += planHc;
      deptStats[plan.department_id].plan_count += 1;
      deptStats[plan.department_id].latest_status = plan.status;

      if (plan.status === "APPROVED") {
        deptStats[plan.department_id].approved_hc += planHc;
      } else {
        deptStats[plan.department_id].pending_hc += planHc;
      }
    }

    // Merge stats back onto department objects
    const departmentsWithStats = departments.map((dept) => ({
      ...dept,
      ...deptStats[dept.id],
    }));

    // ── 3. Global KPIs ─────────────────────────────────────────────────────

    // Total headcount requested across ALL approved plans
    const totalApprovedHc = allPlans
      .filter((p) => p.status === "APPROVED")
      .reduce((s, p) => s + p.positions.reduce((ps, pos) => ps + pos.count, 0), 0);

    // Current active staff = sum of dept.current_hc (maintained in DB)
    const totalCurrentStaff = departments.reduce((s, d) => s + d.current_hc, 0);

    // Capacity % relative to approved headcount (fallback to budgeted baseline)
    const totalBudgeted = departments.reduce((s, d) => s + (d.budgeted_hc || d.approved_hc), 0);
    const capacityBase = totalApprovedHc || totalBudgeted;
    const capacityPercent = capacityBase
      ? Math.round((totalCurrentStaff / capacityBase) * 1000) / 10
      : 0;

    // Pending = in-flight (not draft, not approved/rejected)
    const pendingRequests = activeRequests.length;

    // Total headcount in pending plans (open vacancies proxy)
    const openVacancies = activeRequests.reduce(
      (s, p) => s + p.positions.reduce((ps, pos) => ps + pos.count, 0),
      0
    );

    // Number of HIGH priority positions across pending plans
    const criticalRoles = activeRequests.reduce(
      (s, p) =>
        s +
        p.positions
          .filter((pos) => pos.priority === "HIGH")
          .reduce((ps, pos) => ps + pos.count, 0),
      0
    );

    // Est. budget: simple proxy — each full-time position ~ $80k, part-time $40k, contract $60k
    const estBudgetUSD = activeRequests.reduce((s, p) => {
      return (
        s +
        p.positions.reduce((ps, pos) => {
          const rate =
            pos.employment_type === "FULL_TIME"
              ? 80000
              : pos.employment_type === "PART_TIME"
              ? 40000
              : 60000;
          return ps + pos.count * rate;
        }, 0)
      );
    }, 0);

    res.status(200).json({
      status: "success",
      data: {
        kpis: {
          totalApprovedHeadcount: totalApprovedHc,
          currentActiveStaff: totalCurrentStaff,
          capacityPercent,
          pendingRequests,
          openVacancies,
          criticalRoles,
          estBudgetUSD,
        },
        departments: departmentsWithStats,
        activeRequests,
        allPlans,   // all non-draft plans for the department headcount table
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPlans = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, department_id } = req.query;
    const where: Prisma.WorkforcePlanWhereInput = {};

    if (status) where.status = status as PlanStatus;
    if (department_id) where.department_id = String(department_id);

    const plans = await prisma.workforcePlan.findMany({
      where,
      include: planInclude,
      orderBy: { updated_at: "desc" },
    });

    res.status(200).json({ status: "success", data: { plans } });
  } catch (error) {
    next(error);
  }
};

export const getPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const plan = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
      include: planInclude,
    });

    if (!plan) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }

    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const createPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      title,
      department_id,
      fiscal_year,
      planning_period,
      quarter,
      start_date,
      end_date,
      justification,
      positions,
    } = req.body;

    if (!title || !department_id || !fiscal_year) {
      return res.status(400).json({
        status: "fail",
        message: "Title, department, and planning year are required",
      });
    }

    const activeCycle = await prisma.planningCycle.findFirst({
      where: { is_active: true },
    });

    const plan = await prisma.workforcePlan.create({
      data: {
        title,
        department_id,
        fiscal_year: Number(fiscal_year),
        planning_period: (planning_period as PlanningPeriod) || "ANNUAL",
        quarter: quarter ? Number(quarter) : null,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        justification,
        status: "DRAFT",
        version: 1,
        cycle_id: activeCycle?.id,
        created_by_id: req.user!.id,
        positions: positions?.length
          ? {
              create: positions.map((p: Record<string, string | number>) => ({
                title: String(p.title),
                count: Number(p.count) || 1,
                employment_type: (p.employment_type as string) || "FULL_TIME",
                priority: (p.priority as string) || "MEDIUM",
              })),
            }
          : undefined,
      },
      include: planInclude,
    });

    await prisma.planVersion.create({
      data: {
        plan_id: plan.id,
        version: 1,
        snapshot: buildSnapshot(plan as unknown as Record<string, unknown>),
        created_by_id: req.user!.id,
      },
    });

    res.status(201).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const updatePlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const existing = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
      include: { positions: true },
    });

    if (!existing) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }

    if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(existing.status)) {
      return res.status(400).json({
        status: "fail",
        message: "Only draft, submitted, or rejected plans can be edited",
      });
    }

    const {
      title,
      department_id,
      fiscal_year,
      planning_period,
      quarter,
      start_date,
      end_date,
      justification,
      positions,
      save_as_new_version,
    } = req.body;

    const newVersion = save_as_new_version ? existing.version + 1 : existing.version;

    // If a submitted plan is edited, revert it to DRAFT so it re-enters the approval flow
    const newStatus = existing.status === "SUBMITTED" ? "DRAFT" : existing.status;

    if (positions) {
      await prisma.planPosition.deleteMany({ where: { plan_id: existing.id } });
    }

    const plan = await prisma.workforcePlan.update({
      where: { id: existing.id },
      data: {
        title: title ?? existing.title,
        department_id: department_id ?? existing.department_id,
        fiscal_year: fiscal_year ? Number(fiscal_year) : existing.fiscal_year,
        planning_period: planning_period ?? existing.planning_period,
        quarter: quarter !== undefined ? Number(quarter) : existing.quarter,
        start_date: start_date ? new Date(start_date) : existing.start_date,
        end_date: end_date ? new Date(end_date) : existing.end_date,
        justification: justification ?? existing.justification,
        version: newVersion,
        status: newStatus,
        last_saved_at: new Date(),
        positions: positions?.length
          ? {
              create: positions.map((p: Record<string, string | number>) => ({
                title: String(p.title),
                count: Number(p.count) || 1,
                employment_type: (p.employment_type as string) || "FULL_TIME",
                priority: (p.priority as string) || "MEDIUM",
              })),
            }
          : undefined,
      },
      include: planInclude,
    });

    if (save_as_new_version) {
      await prisma.planVersion.create({
        data: {
          plan_id: plan.id,
          version: newVersion,
          snapshot: buildSnapshot(plan as unknown as Record<string, unknown>),
          created_by_id: req.user!.id,
        },
      });
    }

    // Log withdrawal if plan was pulled back from submitted state
    if (existing.status === "SUBMITTED") {
      await prisma.approvalLog.create({
        data: {
          plan_id: plan.id,
          actor_id: req.user!.id,
          action: "WITHDRAWN",
          from_status: "SUBMITTED",
          to_status: "DRAFT",
          comment: "Plan withdrawn for editing",
        },
      });
    }

    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const submitPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const existing = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
      include: { positions: true },
    });

    if (!existing) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }

    if (!["DRAFT", "REJECTED"].includes(existing.status)) {
      return res.status(400).json({
        status: "fail",
        message: "Plan has already been submitted",
      });
    }

    if (!existing.title || !existing.justification || existing.positions.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "Title, justification, and at least one position are required before submission",
      });
    }

    const activeCycle = await prisma.planningCycle.findFirst({
      where: { is_active: true },
    });

    if (!activeCycle) {
      return res.status(400).json({
        status: "fail",
        message: "Planning cycle is closed. Submissions are not allowed.",
      });
    }

    const plan = await prisma.workforcePlan.update({
      where: { id: existing.id },
      data: {
        status: "SUBMITTED",
        submitted_at: new Date(),
        cycle_id: activeCycle.id,
      },
      include: planInclude,
    });

    await prisma.approvalLog.create({
      data: {
        plan_id: plan.id,
        actor_id: req.user!.id,
        action: "SUBMITTED",
        from_status: existing.status,
        to_status: "SUBMITTED",
        comment: "Plan submitted for approval",
      },
    });

    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const reviewPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { action, comment } = req.body;
    const existing = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }

    const role = req.user!.role;
    let nextStatus: PlanStatus | null = null;

    if (action === "approve") {
      if (role === "WORKFORCE_PLANNER" && existing.status === "SUBMITTED") {
        nextStatus = "HR_REVIEW";
      }
      if (role === "HR" && existing.status === "HR_REVIEW") {
        nextStatus = "CEO_REVIEW";
      }
      if (role === "CEO" && existing.status === "CEO_REVIEW") {
        nextStatus = "APPROVED";
      }
    } else if (action === "reject") {
      nextStatus = "REJECTED";
    }

    if (!nextStatus) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid review action for current status and role",
      });
    }

    if (action === "reject" && !comment) {
      return res.status(400).json({
        status: "fail",
        message: "Rejection requires a comment",
      });
    }

    const plan = await prisma.workforcePlan.update({
      where: { id: existing.id },
      data: { status: nextStatus },
      include: planInclude,
    });

    await prisma.approvalLog.create({
      data: {
        plan_id: plan.id,
        actor_id: req.user!.id,
        action: action.toUpperCase(),
        from_status: existing.status,
        to_status: nextStatus,
        comment,
      },
    });

    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

export const getDepartments = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
    });
    res.status(200).json({ status: "success", data: { departments } });
  } catch (error) {
    next(error);
  }
};

export const getVersions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const versions = await prisma.planVersion.findMany({
      where: { plan_id: req.params.id },
      include: { created_by: { select: { full_name: true } } },
      orderBy: { version: "desc" },
    });
    res.status(200).json({ status: "success", data: { versions } });
  } catch (error) {
    next(error);
  }
};

export const deletePlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const existing = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }

    if (!["DRAFT", "SUBMITTED"].includes(existing.status)) {
      return res.status(400).json({
        status: "fail",
        message: "Only draft or submitted plans can be deleted",
      });
    }

    await prisma.workforcePlan.delete({ where: { id: existing.id } });
    res.status(200).json({ status: "success", message: "Plan deleted" });
  } catch (error) {
    next(error);
  }
};
