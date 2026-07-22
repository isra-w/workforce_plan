/**
 * routes/authRoutes.ts
 *
 * Mounts all authentication-related HTTP endpoints under the /api/auth prefix
 * (set by server.ts).
 *
 * Public routes (no token required):
 *   POST /register              — create a new user account
 *   POST /login                 — authenticate and receive a JWT
 *   GET  /verify/:token         — confirm an email-verification link
 *   POST /resend-verification   — request a new verification email
 *
 * Protected routes (valid Bearer token required):
 *   GET   /me                   — return the current user's profile
 *   PATCH /complete-profile     — update optional profile fields (e.g. title)
 *   GET   /users                — list all users (HR, CEO, and HR_ADMIN)
 */
import express from "express";
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  getMe,
  completeProfile,
  listUsers,
  updateUserPermissions,
  listRolePermissions,
  updateRolePermissions,
  getResourcePermissions,
  setResourcePermissions,
} from "src/controllers/authController";
import { protect, requireRoles } from "src/middleware/authMiddleware";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────
router.post("/register", register);
router.post("/login", login);
router.get("/verify/:token", verifyEmail);
router.post("/resend-verification", resendVerification);

// ── Protected (JWT required) ──────────────────────────────────────────────
router.use(protect);
router.get("/me", getMe);
router.patch("/complete-profile", completeProfile);
router.get("/users", requireRoles("HR", "CEO", "HR_ADMIN"), listUsers);
router.get("/roles/permissions", requireRoles("HR_ADMIN"), listRolePermissions);
router.patch(
  "/roles/:role/permissions",
  requireRoles("HR_ADMIN"),
  updateRolePermissions,
);
router.patch(
  "/users/:id/permissions",
  requireRoles("HR_ADMIN"),
  updateUserPermissions,
);

// ── Granular resource × action permissions (HR_ADMIN only) ───────────────
router.get(
  "/users/:id/resource-permissions",
  requireRoles("HR_ADMIN"),
  getResourcePermissions,
);
router.put(
  "/users/:id/resource-permissions",
  requireRoles("HR_ADMIN"),
  setResourcePermissions,
);

export default router;
