/**
 * controllers/workforcePlanController.ts
 *
 * HTTP layer only — validates input, calls the service, and maps results to
 * HTTP responses. No Prisma or database logic lives here.
 *
 * Privilege model (enforced in routes via requireRoles):
 *   WORKFORCE_PLANNER  creates, edits, submits, and deletes DRAFT/SUBMITTED plans.
 *   HR                 sees only SUBMITTED plans; approve → HR_APPROVED or reject → REJECTED.
 *   CEO                sees only HR_APPROVED plans; approve → APPROVED or reject → REJECTED.
 *   CANDIDATE          read-only access.
 */
import { Response, NextFunction } from "express";
import { PlanningPeriod } from "@prisma/client";
import { AuthRequest } from "src/middleware/authMiddleware";
import * as planService from "src/services/workforcePlanService";

// ---------------------------------------------------------------------------
// getDashboard
// ---------------------------------------------------------------------------
export const getDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await planService.getDashboardData(req.user!.role);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getPlans
// ---------------------------------------------------------------------------
export const getPlans = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const plans = await planService.listPlans(req.user!.role);
    res.status(200).json({ status: "success", data: { plans } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getPlan
// ---------------------------------------------------------------------------
export const getPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const plan = await planService.findPlanById(req.params.id);
    if (!plan) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }
    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// createPlan
// ---------------------------------------------------------------------------
export const createPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { title, department_id, fiscal_year, planning_period, quarter, justification, positions } =
      req.body;

    if (!title || !department_id || !fiscal_year) {
      return res.status(400).json({
        status: "fail",
        message: "Title, department, and planning year are required",
      });
    }

    const plan = await planService.createPlan({
      title,
      department_id,
      fiscal_year: Number(fiscal_year),
      planning_period: (planning_period as PlanningPeriod) || "ANNUAL",
      quarter: quarter ? Number(quarter) : null,
      justification,
      positions,
      created_by_id: req.user!.id,
    });

    res.status(201).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// updatePlan
// ---------------------------------------------------------------------------
export const updatePlan = async (
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
      justification,
      positions,
      save_as_new_version,
    } = req.body;

    let plan;
    try {
      plan = await planService.updatePlan(req.params.id, {
        title,
        department_id,
        fiscal_year: fiscal_year ? Number(fiscal_year) : undefined,
        planning_period: planning_period as PlanningPeriod | undefined,
        quarter: quarter !== undefined ? Number(quarter) : undefined,
        justification,
        positions,
        save_as_new_version,
        updated_by_id: req.user!.id,
      });
    } catch (err: unknown) {
      return res.status(400).json({
        status: "fail",
        message: (err as Error).message,
      });
    }

    if (!plan) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }

    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// submitPlan
// ---------------------------------------------------------------------------
export const submitPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    let plan;
    try {
      plan = await planService.submitPlan(req.params.id, req.user!.id);
    } catch (err: unknown) {
      return res.status(400).json({
        status: "fail",
        message: (err as Error).message,
      });
    }

    if (!plan) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }

    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// reviewPlan
// ---------------------------------------------------------------------------
export const reviewPlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { action, comment } = req.body;

    let plan;
    try {
      plan = await planService.reviewPlan(req.params.id, {
        action,
        comment,
        actor_id: req.user!.id,
        role: req.user!.role,
      });
    } catch (err: unknown) {
      return res.status(400).json({
        status: "fail",
        message: (err as Error).message,
      });
    }

    if (!plan) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }

    res.status(200).json({ status: "success", data: { plan } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// deletePlan
// ---------------------------------------------------------------------------
export const deletePlan = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    let result;
    try {
      result = await planService.deletePlan(req.params.id);
    } catch (err: unknown) {
      return res.status(400).json({
        status: "fail",
        message: (err as Error).message,
      });
    }

    if (!result) {
      return res.status(404).json({ status: "fail", message: "Plan not found" });
    }

    res.status(200).json({ status: "success", message: "Plan deleted" });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getDepartments
// ---------------------------------------------------------------------------
export const getDepartments = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const departments = await planService.listDepartments();
    res.status(200).json({ status: "success", data: { departments } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getVersions
// ---------------------------------------------------------------------------
export const getVersions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const versions = await planService.listVersions(req.params.id);
    res.status(200).json({ status: "success", data: { versions } });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// getVacancies
// ---------------------------------------------------------------------------
export const getVacancies = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const vacancies = await planService.listVacancies();
    res.status(200).json({ status: "success", data: { vacancies } });
  } catch (error) {
    next(error);
  }
};
