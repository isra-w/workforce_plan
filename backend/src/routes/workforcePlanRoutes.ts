/**
 * routes/workforcePlanRoutes.ts
 *
 * Registers all workforce-plan HTTP routes and delegates attachment I/O to
 * inline handlers that use the plan service for DB work — keeping raw Prisma
 * calls out of the route file entirely.
 *
 * Privilege model:
 *   WORKFORCE_PLANNER  POST/PUT/DELETE plans, submit, upload/delete attachments
 *   HR                 GET plans (scoped to SUBMITTED), POST review
 *   CEO                GET plans (scoped to HR_APPROVED), POST review
 *   All verified roles GET dashboard, departments, single plan, versions, vacancies
 */
import express from "express";
import multer from "multer";
import fs from "fs";
import {
  getDashboard, getPlans, getPlan,
  createPlan, updatePlan, submitPlan, reviewPlan,
  getDepartments, getVersions, deletePlan, getVacancies,
} from "src/controllers/workforcePlanController";
import { protect, requireVerified, requireRoles } from "src/middleware/authMiddleware";
import * as planService from "src/services/workforcePlanService";
import { config } from "src/config";

const router = express.Router();

// ── Multer — disk storage, path and size limit come from config ───────────
const { uploadDir, uploadMaxBytes, allowedMimeTypes } = config;

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: uploadMaxBytes } });

const ALLOWED_MIME_TYPES = allowedMimeTypes;

// ── Auth guard for every route below ──────────────────────────────────────
router.use(protect, requireVerified);

// ── Read-only (any verified role) ─────────────────────────────────────────
router.get("/dashboard",          getDashboard);
router.get("/departments",        getDepartments);
router.get("/vacancies",          getVacancies);
router.get("/plans",              getPlans);
router.get("/plans/:id",          getPlan);
router.get("/plans/:id/versions", getVersions);

// ── Workforce Planner write operations ────────────────────────────────────
router.post("/plans",            requireRoles("WORKFORCE_PLANNER"), createPlan);
router.put("/plans/:id",         requireRoles("WORKFORCE_PLANNER"), updatePlan);
router.post("/plans/:id/submit", requireRoles("WORKFORCE_PLANNER"), submitPlan);
router.delete("/plans/:id",      requireRoles("WORKFORCE_PLANNER"), deletePlan);

// ── HR / CEO review ───────────────────────────────────────────────────────
router.post("/plans/:id/review", requireRoles("HR", "CEO"), reviewPlan);

// ── Attachment upload (planner only) ──────────────────────────────────────
router.post(
  "/plans/:id/attachments",
  requireRoles("WORKFORCE_PLANNER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: "fail", message: "No file uploaded" });
      }

      if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          status: "fail",
          message: "File type not allowed. Upload PDF, Word, Excel, or image files only.",
        });
      }

      const plan = await planService.findPlanForAttachment(req.params.id);
      if (!plan) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ status: "fail", message: "Plan not found" });
      }

      const attachment = await planService.createAttachment({
        plan_id:  req.params.id,
        filename: req.file.originalname,
        filepath: req.file.path,
        mimetype: req.file.mimetype,
        size:     req.file.size,
      });

      res.status(201).json({ status: "success", data: { attachment } });
    } catch (error) {
      next(error);
    }
  },
);

// ── Attachment delete (planner only) ──────────────────────────────────────
router.delete(
  "/plans/:id/attachments/:attachmentId",
  requireRoles("WORKFORCE_PLANNER"),
  async (req, res, next) => {
    try {
      const { id: planId, attachmentId } = req.params;

      const plan = await planService.findPlanForAttachment(planId);
      if (!plan) {
        return res.status(404).json({ status: "fail", message: "Plan not found" });
      }

      if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(plan.status)) {
        return res.status(400).json({
          status: "fail",
          message: "Attachments cannot be removed from approved or in-review plans",
        });
      }

      const attachment = await planService.findAttachment(attachmentId);
      if (!attachment || attachment.plan_id !== planId) {
        return res.status(404).json({ status: "fail", message: "Attachment not found" });
      }

      await planService.deleteAttachment(attachmentId);

      if (attachment.filepath && fs.existsSync(attachment.filepath)) {
        fs.unlinkSync(attachment.filepath);
      }

      res.status(200).json({ status: "success", message: "Attachment deleted" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
