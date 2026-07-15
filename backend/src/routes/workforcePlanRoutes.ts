/**
 * routes/workforcePlanRoutes.ts
 *
 * Mounts all workforce-planning endpoints under /api/workforce (set by server.ts).
 * Every route requires authentication (protect) and a verified email (requireVerified).
 *
 * Read-only endpoints (any verified role):
 *   GET  /dashboard              — aggregated KPIs and department stats
 *   GET  /departments            — list all departments
 *   GET  /plans                  — list plans with optional status/department filters
 *   GET  /plans/:id              — single plan detail
 *   GET  /plans/:id/versions     — version history for a plan
 *
 * Planner-only write endpoints (WORKFORCE_PLANNER role):
 *   POST   /plans                — create a new draft plan
 *   PUT    /plans/:id            — update an existing draft/submitted/rejected plan
 *   POST   /plans/:id/submit     — submit a draft for approval
 *   DELETE /plans/:id            — delete a draft or submitted plan
 *
 * Review endpoint (CEO role):
 *   POST /plans/:id/review       — approve or reject a plan at the current stage
 *
 * File attachment endpoints (WORKFORCE_PLANNER role):
 *   POST   /plans/:id/attachments                  — upload a file (max 10 MB via multer);
 *                                                    saved to /uploads, metadata stored in DB.
 *   DELETE /plans/:id/attachments/:attachmentId    — delete a single attachment record and its
 *                                                    file from disk; only allowed while the plan
 *                                                    is in DRAFT, SUBMITTED, or REJECTED status.
 */
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getDashboard,
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
  submitPlan,
  reviewPlan,
  getDepartments,
  getVersions,
  deletePlan,
} from "src/controllers/workforcePlanController";
import { protect, requireVerified, requireRoles } from "src/middleware/authMiddleware";
import { prisma } from "src/utils/prisma";

const router = express.Router();

// Ensure the uploads directory exists on startup
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Store each uploaded file on disk with a unique timestamped filename
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

// Multer instance: disk storage, 10 MB per file limit
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// All routes below require a valid JWT and a verified email address
router.use(protect, requireVerified);

// ── Read-only (any verified role) ──────────────────────────────────────────
router.get("/dashboard", getDashboard);
router.get("/departments", getDepartments);
router.get("/plans", getPlans);
router.get("/plans/:id", getPlan);
router.get("/plans/:id/versions", getVersions);

// ── Planner write operations ───────────────────────────────────────────────
router.post("/plans",            requireRoles("WORKFORCE_PLANNER"), createPlan);
router.put("/plans/:id",         requireRoles("WORKFORCE_PLANNER"), updatePlan);
router.post("/plans/:id/submit", requireRoles("WORKFORCE_PLANNER"), submitPlan);
router.delete("/plans/:id",      requireRoles("WORKFORCE_PLANNER"), deletePlan);

// ── CEO review ────────────────────────────────────────────────────────────
router.post("/plans/:id/review", requireRoles("CEO"), reviewPlan);

// ── Attachment: upload ────────────────────────────────────────────────────
// Accepts a single multipart field named "file".
// Allowed types: PDF, Word, Excel, images — validated by mimetype below.
router.post(
  "/plans/:id/attachments",
  requireRoles("WORKFORCE_PLANNER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: "fail", message: "No file uploaded" });
      }

      // Validate MIME type — only allow documents and images
      const allowed = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/jpeg",
        "image/png",
        "image/gif",
      ];
      if (!allowed.includes(req.file.mimetype)) {
        // Remove the rejected file from disk immediately
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          status: "fail",
          message: "File type not allowed. Upload PDF, Word, Excel, or image files only.",
        });
      }

      // Verify the plan exists before saving the attachment record
      const plan = await prisma.workforcePlan.findUnique({
        where: { id: req.params.id },
      });
      if (!plan) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ status: "fail", message: "Plan not found" });
      }

      const attachment = await prisma.planAttachment.create({
        data: {
          plan_id: req.params.id,
          filename: req.file.originalname,
          filepath: req.file.path,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
      });

      res.status(201).json({ status: "success", data: { attachment } });
    } catch (error) {
      next(error);
    }
  }
);

// ── Attachment: delete ────────────────────────────────────────────────────
// Removes the DB record and the physical file from disk.
// Only the planner who owns the plan (or any planner) can delete attachments,
// and only while the plan is still in an editable status.
router.delete(
  "/plans/:id/attachments/:attachmentId",
  requireRoles("WORKFORCE_PLANNER"),
  async (req, res, next) => {
    try {
      const { id: planId, attachmentId } = req.params;

      // Verify the plan exists and is still editable
      const plan = await prisma.workforcePlan.findUnique({
        where: { id: planId },
      });
      if (!plan) {
        return res.status(404).json({ status: "fail", message: "Plan not found" });
      }
      if (!["DRAFT", "SUBMITTED", "REJECTED"].includes(plan.status)) {
        return res.status(400).json({
          status: "fail",
          message: "Attachments cannot be removed from approved or in-review plans",
        });
      }

      // Find the attachment record
      const attachment = await prisma.planAttachment.findUnique({
        where: { id: attachmentId },
      });
      if (!attachment || attachment.plan_id !== planId) {
        return res.status(404).json({ status: "fail", message: "Attachment not found" });
      }

      // Delete the DB record first so a failed file delete doesn't leave orphans
      await prisma.planAttachment.delete({ where: { id: attachmentId } });

      // Remove the physical file from disk (non-fatal if already missing)
      if (attachment.filepath && fs.existsSync(attachment.filepath)) {
        fs.unlinkSync(attachment.filepath);
      }

      res.status(200).json({ status: "success", message: "Attachment deleted" });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
