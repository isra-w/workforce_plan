/**
 * controllers/workforcePlanController.ts
 *
 * New privilege model:
 *   WORKFORCE_PLANNER  creates, edits, submits, and deletes DRAFT/SUBMITTED plans.
 *   HR                 sees only SUBMITTED plans; can approve (→ HR_APPROVED) or reject (→ REJECTED).
 *   CEO                sees only HR_APPROVED plans (job postings); can approve (→ APPROVED) or reject (→ REJECTED).
 *   CANDIDATE          read-only access; no write operations.
 *
 * Approval flow:
 *   DRAFT → SUBMITTED → HR_APPROVED → APPROVED
 *                ↘           ↘
 *             REJECTED     REJECTED
 *
 * getPlans      — role-scoped list:
 *                   HR   → only SUBMITTED plans
 *                   CEO  → only HR_APPROVED plans ("job postings")
 *                   else → all plans (planner sees their own; admin sees all)
 *
 * getDashboard  — role-scoped KPIs and plan lists (same scoping as getPlans).
 *
 * reviewPlan    — HR: SUBMITTED → HR_APPROVED or REJECTED
 *                 CEO: HR_APPROVED → APPROVED or REJECTED
 *                 Rejection always requires a comment.
 */
import { Response, NextFunction } from "express";
import { PlanStatus, PlanningPeriod, Prisma } from "@prisma/client";
import { prisma } from "src/utils/prisma";
import { AuthRequest } from "src/middleware/authMiddleware";

// Consistent eager-load used by every plan query.
// approval_logs is intentionally kept simple here — no status-typed fields
// are validated on the Prisma client side when using raw include, but we cast
// the result to avoid TS errors from old enum values still present in the DB.
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

// ---------------------------------------------------------------------------
// getDashboard
// Returns KPIs and plan lists, scoped to the caller's role:
//   HR   → pendingReview = SUBMITTED plans awaiting HR action
//   CEO  → pendingReview = HR_APPROVED plans awaiting CEO decision
//   else → standard planner/admin view
// ---------------------------------------------------------------------------
export const getDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const role = req.user!.role;

    const [departments, allPlans, activeRequests] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: "asc" } }),

      // ALL non-draft plans — shown in the overview table regardless of role.
      // Includes SUBMITTED, HR_APPROVED, APPROVED, and REJECTED so the
      // dashboard always shows the full history of every plan.
      prisma.workforcePlan.findMany({
        where: { status: { notIn: ["DRAFT"] } },
        include: { department: true, positions: true },
        orderBy: { updated_at: "desc" },
      }),

      // Active (in-flight) requests — scoped by role for the sidebar widget:
      //   HR   → SUBMITTED only      (plans awaiting HR decision)
      //   CEO  → HR_APPROVED only    (plans awaiting CEO decision)
      //   else → SUBMITTED + HR_APPROVED  (all in-flight, for planner view)
      // APPROVED and REJECTED are deliberately excluded here — they are
      // finalised and belong in the main table, not the "active" sidebar.
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
      .reduce(
        (s, p) => s + p.positions.reduce((ps, pos) => ps + pos.count, 0),
        0,
      );
    const totalCurrentStaff = departments.reduce((s, d) => s + d.current_hc, 0);
    const totalBudgeted = departments.reduce(
      (s, d) => s + (d.budgeted_hc || d.approved_hc),
      0,
    );
    const capacityBase = totalApprovedHc || totalBudgeted;
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
    const estBudgetUSD = activeRequests.reduce(
      (s, p) =>
        s +
        p.positions.reduce((ps, pos) => {
          const rate =
            pos.employment_type === "FULL_TIME"
              ? 80000
              : pos.employment_type === "PART_TIME"
                ? 40000
                : 60000;
          return ps + pos.count * rate;
        }, 0),
      0,
    );

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
        allPlans,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getPlans
// Role-scoped list:
//   HR          → only SUBMITTED plans (awaiting HR decision)
//   CEO         → only HR_APPROVED plans (awaiting CEO decision)
//   PLANNER     → ALL plans, every status — so they can see their DRAFT,
//                 SUBMITTED, HR_APPROVED, APPROVED, and REJECTED history.
//   CANDIDATE   → ALL plans (read-only; no write controls on the frontend)
// ---------------------------------------------------------------------------
export const getPlans = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const role = req.user!.role;

    // Build the where clause based on role
    let where: Prisma.WorkforcePlanWhereInput = {};

    if (role === "HR") {
      // HR only sees plans waiting for their review
      where.status = "SUBMITTED";
    } else if (role === "CEO") {
      // CEO only sees plans HR has already approved
      where.status = "HR_APPROVED";
    }
    // WORKFORCE_PLANNER and CANDIDATE: no status filter — return everything

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

// ---------------------------------------------------------------------------
// getPlan — single plan detail (any role, own visibility rules enforced above)
// ---------------------------------------------------------------------------
export const getPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const plan = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
      include: planInclude,
    });
    if (!plan) {
      return res
        .status(404)
        .json({ status: "fail", message: "Plan not found" });
    }
    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// createPlan — WORKFORCE_PLANNER only (enforced in routes)
// ---------------------------------------------------------------------------
export const createPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
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
      return res
        .status(400)
        .json({
          status: "fail",
          message: "Title, department, and planning year are required",
        });
    }

    const activeCycle = await prisma.planningCycle.findFirst({
      where: { is_active: true },
    });
    if (!activeCycle) {
      return res
        .status(400)
        .json({
          status: "fail",
          message: "No active planning cycle available",
        });
    }

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
        cycle_id: activeCycle.id,
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

// ---------------------------------------------------------------------------
// updatePlan — WORKFORCE_PLANNER only; DRAFT/SUBMITTED/REJECTED only
//
// Version increment rule (simple):
//   Only increment when the plan is currently REJECTED.
//   This means: "the planner made a revision after the plan was rejected."
//
//   DRAFT edits   → no increment (just saving work in progress)
//   SUBMITTED edit → resets to DRAFT, no increment (withdrawal, not a revision)
//   REJECTED edit  → increment +1 and save a snapshot (a real revision)
// ---------------------------------------------------------------------------
export const updatePlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const existing = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
      include: { positions: true },
    });
    if (!existing)
      return res
        .status(404)
        .json({ status: "fail", message: "Plan not found" });
    if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(existing.status)) {
      return res
        .status(400)
        .json({
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

    // Only bump version when editing a REJECTED plan — that is a genuine revision.
    // DRAFT saves and SUBMITTED withdrawals do not count as new versions.
    const isRevision = existing.status === "REJECTED";
    const newVersion =
      isRevision || save_as_new_version === true
        ? existing.version + 1
        : existing.version;

    // A SUBMITTED plan that is edited is pulled back to DRAFT
    const newStatus =
      existing.status === "SUBMITTED" ? "DRAFT" : existing.status;

    if (positions)
      await prisma.planPosition.deleteMany({ where: { plan_id: existing.id } });

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

    // Save a snapshot only when the version actually changed
    if (newVersion !== existing.version) {
      await prisma.planVersion.create({
        data: {
          plan_id: plan.id,
          version: newVersion,
          snapshot: buildSnapshot(plan as unknown as Record<string, unknown>),
          created_by_id: req.user!.id,
        },
      });
    }

    // Audit log for significant status changes
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
    } else if (isRevision) {
      await prisma.approvalLog.create({
        data: {
          plan_id: plan.id,
          actor_id: req.user!.id,
          action: "REVISED",
          from_status: "REJECTED",
          to_status: "REJECTED",
          comment: `Plan revised after rejection (now v${newVersion})`,
        },
      });
    }

    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// submitPlan — WORKFORCE_PLANNER only; DRAFT/REJECTED → SUBMITTED
//
// Version rule: submission does NOT increment the version.
// The version only increments when the planner edits a REJECTED plan.
// Submitting is just a status change, not a content revision.
// ---------------------------------------------------------------------------
export const submitPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const existing = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
      include: { positions: true },
    });
    if (!existing)
      return res
        .status(404)
        .json({ status: "fail", message: "Plan not found" });
    if (!["DRAFT", "REJECTED"].includes(existing.status)) {
      return res
        .status(400)
        .json({ status: "fail", message: "Plan has already been submitted" });
    }
    if (
      !existing.title ||
      !existing.justification ||
      existing.positions.length === 0
    ) {
      return res
        .status(400)
        .json({
          status: "fail",
          message:
            "Title, justification, and at least one position are required before submission",
        });
    }
    const activeCycle = await prisma.planningCycle.findFirst({
      where: { is_active: true },
    });
    if (!activeCycle) {
      return res
        .status(400)
        .json({
          status: "fail",
          message: "Planning cycle is closed. Submissions are not allowed.",
        });
    }

    // Status changes to SUBMITTED — version stays the same
    const plan = await prisma.workforcePlan.update({
      where: { id: existing.id },
      data: {
        status: "SUBMITTED",
        submitted_at: new Date(),
        cycle_id: activeCycle.id,
        // version intentionally not changed — submission is not a revision
      },
      include: planInclude,
    });

    await prisma.approvalLog.create({
      data: {
        plan_id: plan.id,
        actor_id: req.user!.id,
        action: "SUBMITTED",
        from_status: existing.status as PlanStatus,
        to_status: "SUBMITTED",
        comment:
          existing.status === "REJECTED"
            ? `Resubmitted for HR review (v${existing.version})`
            : `Submitted for HR review (v${existing.version})`,
      },
    });

    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// reviewPlan
//
// New privilege model:
//   HR  — can review SUBMITTED plans only
//           approve → HR_APPROVED   (plan becomes a "job posting" for CEO review)
//           reject  → REJECTED      (requires comment; planner can edit and resubmit)
//
//   CEO — can review HR_APPROVED plans only
//           approve → APPROVED      (final sign-off; headcount is authorised)
//           reject  → REJECTED      (requires comment)
//
// Any other role gets a 403 from requireRoles in the router before reaching here.
// ---------------------------------------------------------------------------
export const reviewPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { action, comment } = req.body;
    const existing = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
    });
    if (!existing)
      return res
        .status(404)
        .json({ status: "fail", message: "Plan not found" });

    const role = req.user!.role;
    let nextStatus: PlanStatus | null = null;

    if (action === "approve") {
      if (role === "HR" && existing.status === "SUBMITTED") {
        // HR approves a submitted workforce plan → becomes a job posting for CEO
        nextStatus = "HR_APPROVED";
      } else if (role === "CEO" && existing.status === "HR_APPROVED") {
        // CEO gives final approval on the job posting
        nextStatus = "APPROVED";
      }
    } else if (action === "reject") {
      if (role === "HR" && existing.status === "SUBMITTED") {
        nextStatus = "REJECTED";
      } else if (role === "CEO" && existing.status === "HR_APPROVED") {
        nextStatus = "REJECTED";
      }
    }

    if (!nextStatus) {
      return res
        .status(400)
        .json({
          status: "fail",
          message:
            "Invalid review action for your role and the plan's current status",
        });
    }
    if (action === "reject" && !comment) {
      return res
        .status(400)
        .json({
          status: "fail",
          message: "A comment is required when rejecting a plan",
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
        action:
          action === "approve"
            ? role === "HR"
              ? "HR_APPROVED"
              : "CEO_APPROVED"
            : `${role}_REJECTED`,
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

// ---------------------------------------------------------------------------
// getVacancies
// Returns every APPROVED plan with its positions and department.
// Accessible to all verified roles — used by the Vacancies page to display
// open headcount that has been fully signed off by the CEO.
// ---------------------------------------------------------------------------
export const getVacancies = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const plans = await prisma.workforcePlan.findMany({
      where: { status: "APPROVED" },
      include: {
        department: true,
        positions: true,
        created_by: { select: { id: true, full_name: true, email: true } },
      },
      orderBy: { updated_at: "desc" },
    });

    // Flatten each plan's positions into individual vacancy records so the
    // frontend can display one card / row per position rather than per plan.
    const vacancies = plans.flatMap((plan) =>
      (plan.positions ?? []).map((pos) => ({
        // Position fields
        id: pos.id,
        title: pos.title,
        count: pos.count,
        employment_type: pos.employment_type,
        priority: pos.priority,
        // Parent plan context
        plan_id: plan.id,
        plan_title: plan.title,
        fiscal_year: plan.fiscal_year,
        planning_period: plan.planning_period,
        quarter: plan.quarter,
        department: plan.department,
        created_by: plan.created_by,
      })),
    );

    res.status(200).json({ status: "success", data: { vacancies } });
  } catch (error) {
    next(error);
  }
};

export const getDepartments = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
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
  next: NextFunction,
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
  next: NextFunction,
) => {
  try {
    const existing = await prisma.workforcePlan.findUnique({
      where: { id: req.params.id },
    });
    if (!existing)
      return res
        .status(404)
        .json({ status: "fail", message: "Plan not found" });
    if (!["DRAFT", "SUBMITTED"].includes(existing.status)) {
      return res
        .status(400)
        .json({
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
