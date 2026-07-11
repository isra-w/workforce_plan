/**
 * routes/authRoutes.ts
 *
 * Mounts all authentication-related HTTP endpoints under the /api/auth prefix
 * (set by server.ts). Public routes are available without a token:
 *
 *   POST /register              — create a new user account
 *   POST /login                 — authenticate and receive a JWT
 *   GET  /verify/:token         — confirm an email-verification link
 *   POST /resend-verification   — request a new verification email
 *
 * Routes below the `protect` middleware require a valid Bearer token:
 *
 *   GET   /me                   — return the current user's profile
 *   PATCH /complete-profile     — update optional profile fields (e.g. title)
 */
import express from "express";
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  getMe,
  completeProfile,
} from "src/controllers/authController";
import { protect } from "src/middleware/authMiddleware";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/verify/:token", verifyEmail);
router.post("/resend-verification", resendVerification);

router.use(protect);
router.get("/me", getMe);
router.patch("/complete-profile", completeProfile);

export default router;
