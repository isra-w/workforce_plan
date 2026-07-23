/**
 * routes/authRoutes.ts
 *
 * Public routes (no token required):
 *   POST /register
 *   POST /login
 *   GET  /verify/:token
 *   POST /resend-verification
 *   GET  /roles                  — all roles for signup dropdown
 *
 * Protected routes (valid Bearer JWT required):
 *   GET   /me
 *   GET   /users                 — HR, CEO, HR_ADMIN
 *   GET   /roles/permissions     — HR_ADMIN
 *   PATCH /roles/:role/permissions — HR_ADMIN
 *   PATCH /users/:id/permissions — HR_ADMIN
 *   POST  /roles/create          — HR_ADMIN
 *   DELETE /roles/:name          — HR_ADMIN
 */
import express from "express";
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  getMe,
  listUsers,
  listRolePermissions,
  updateRolePermissions,
  updateUserPermissions,
  getAllRoles,
  createRole,
  deleteRole,
} from "src/controllers/authController";
import { protect, requireRoles } from "src/middleware/authMiddleware";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────
router.post("/register",             register);
router.post("/login",                login);
router.get( "/verify/:token",        verifyEmail);
router.post("/resend-verification",  resendVerification);
router.get( "/roles",                getAllRoles);   // needed by signup form

// ── Protected (JWT required) ──────────────────────────────────────────────
router.use(protect);

router.get("/me",    getMe);
router.get("/users", requireRoles("HR", "CEO", "HR_ADMIN"), listUsers);

// Role permissions
router.get(   "/roles/permissions",          requireRoles("HR_ADMIN"), listRolePermissions);
router.patch( "/roles/:role/permissions",    requireRoles("HR_ADMIN"), updateRolePermissions);
router.patch( "/users/:id/permissions",      requireRoles("HR_ADMIN"), updateUserPermissions);

// Role CRUD
router.post(  "/roles/create",  requireRoles("HR_ADMIN"), createRole);
router.delete("/roles/:name",   requireRoles("HR_ADMIN"), deleteRole);

export default router;
