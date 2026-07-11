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
 * File upload (any verified role):
 *   POST /plans/:id/attachments  — upload a file attachment (max 10 MB) via multer;
 *                                   stored on disk under /uploads and recorded in DB.
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

router.get("/dashboard", getDashboard);
router.get("/departments", getDepartments);
router.get("/plans", getPlans);
router.get("/plans/:id", getPlan);
router.get("/plans/:id/versions", getVersions);
router.post("/plans", requireRoles("WORKFORCE_PLANNER"), createPlan);
router.put("/plans/:id", requireRoles("WORKFORCE_PLANNER"), updatePlan);
router.post("/plans/:id/submit", requireRoles("WORKFORCE_PLANNER"), submitPlan);
router.delete("/plans/:id", requireRoles("WORKFORCE_PLANNER"), deletePlan);

router.post("/plans/:id/review", requireRoles("CEO"), reviewPlan);

router.post("/plans/:id/attachments", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: "fail", message: "No file uploaded" });
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
});

export default router;
