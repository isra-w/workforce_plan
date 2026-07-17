/**
 * routes/workforcePlanRoutes.ts
 *
 * Privilege model:
 *   WORKFORCE_PLANNER  POST/PUT/DELETE plans, submit, upload attachments
 *   HR                 GET plans (scoped to SUBMITTED only), POST review
 *   CEO                GET plans (scoped to HR_APPROVED only), POST review
 *   All verified roles GET dashboard, departments, single plan, versions
 */
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getDashboard, getPlans, getPlan,
  createPlan, updatePlan, submitPlan, reviewPlan,
  getDepartments, getVersions, deletePlan, getVacancies,
} from "src/controllers/workforcePlanController";
import { protect, requireVerified, requireRoles } from "src/middleware/authMiddleware";
import { prisma } from "src/utils/prisma";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.use(protect, requireVerified);

// ── Read-only (any verified role) ──────────────────────────────────────────
// getPlans and getDashboard are role-aware inside the controller:
//   HR  → sees only SUBMITTED plans
//   CEO → sees only HR_APPROVED plans
router.get("/dashboard",          getDashboard);
router.get("/departments",        getDepartments);
router.get("/vacancies",          getVacancies);
router.get("/plans",              getPlans);
router.get("/plans/:id",          getPlan);
router.get("/plans/:id/versions", getVersions);

// ── Workforce Planner write operations ────────────────────────────────────
router.post("/plans",             requireRoles("WORKFORCE_PLANNER"), createPlan);
router.put("/plans/:id",          requireRoles("WORKFORCE_PLANNER"), updatePlan);
router.post("/plans/:id/submit",  requireRoles("WORKFORCE_PLANNER"), submitPlan);
router.delete("/plans/:id",       requireRoles("WORKFORCE_PLANNER"), deletePlan);

// ── HR review — SUBMITTED → HR_APPROVED or REJECTED ───────────────────────
router.post("/plans/:id/review",  requireRoles("HR", "CEO"), reviewPlan);

// ── Attachment upload (planner only) ──────────────────────────────────────
router.post(
  "/plans/:id/attachments",
  requireRoles("WORKFORCE_PLANNER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ status: "fail", message: "No file uploaded" });
      const allowed = [
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg", "image/png", "image/gif",
      ];
      if (!allowed.includes(req.file.mimetype)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ status: "fail", message: "File type not allowed. Upload PDF, Word, Excel, or image files only." });
      }
      const plan = await prisma.workforcePlan.findUnique({ where: { id: req.params.id } });
      if (!plan) { fs.unlinkSync(req.file.path); return res.status(404).json({ status: "fail", message: "Plan not found" }); }
      const attachment = await prisma.planAttachment.create({
        data: { plan_id: req.params.id, filename: req.file.originalname, filepath: req.file.path, mimetype: req.file.mimetype, size: req.file.size },
      });
      res.status(201).json({ status: "success", data: { attachment } });
    } catch (error) { next(error); }
  }
);

// ── Attachment delete (planner only) ──────────────────────────────────────
router.delete(
  "/plans/:id/attachments/:attachmentId",
  requireRoles("WORKFORCE_PLANNER"),
  async (req, res, next) => {
    try {
      const { id: planId, attachmentId } = req.params;
      const plan = await prisma.workforcePlan.findUnique({ where: { id: planId } });
      if (!plan) return res.status(404).json({ status: "fail", message: "Plan not found" });
      if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(plan.status)) {
        return res.status(400).json({ status: "fail", message: "Attachments cannot be removed from approved or in-review plans" });
      }
      const attachment = await prisma.planAttachment.findUnique({ where: { id: attachmentId } });
      if (!attachment || attachment.plan_id !== planId) {
        return res.status(404).json({ status: "fail", message: "Attachment not found" });
      }
      await prisma.planAttachment.delete({ where: { id: attachmentId } });
      if (attachment.filepath && fs.existsSync(attachment.filepath)) fs.unlinkSync(attachment.filepath);
      res.status(200).json({ status: "success", message: "Attachment deleted" });
    } catch (error) { next(error); }
  }
);

export default router;
