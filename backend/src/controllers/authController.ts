/**
 * controllers/authController.ts
 *
 * Handles all user authentication logic. Each exported function is an Express
 * route handler (req, res, next) that talks to the database via Prisma and
 * delegates crypto operations to utils/auth.ts.
 *
 * register         — validates required fields, checks for duplicate emails,
 *                    hashes the password, generates an email-verification token,
 *                    creates the user in the DB, and returns the new user object
 *                    along with the raw verification token (for dev convenience).
 *
 * login            — looks up the user by email, compares the submitted password
 *                    against the stored bcrypt hash, checks account status, and
 *                    returns a signed JWT together with the user's public profile.
 *
 * verifyEmail      — accepts a verification token from the URL, marks the user as
 *                    verified, clears the token, and returns a new JWT so the
 *                    client is immediately logged in after verification.
 *
 * resendVerification — generates a fresh verification token and persists it;
 *                      returns the token so the frontend can redirect or display it.
 *
 * getMe            — returns the authenticated user's profile (relies on the JWT
 *                    decoded by the protect middleware).
 *
 * completeProfile  — lets the authenticated user set an optional job title after
 *                    registration.
 *
 * userSelect       — shared Prisma `select` object that limits the columns returned
 *                    for user queries to avoid leaking password_hash or tokens.
 */
import { Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "src/utils/prisma";
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateVerificationToken,
} from "src/utils/auth";
import { AuthRequest } from "src/middleware/authMiddleware";

const userSelect = {
  id: true,
  email: true,
  full_name: true,
  role: true,
  title: true,
  is_verified: true,
  is_active: true,
  created_at: true,
};

export const register = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, full_name, role } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({
        status: "fail",
        message: "Full name, email, and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: "fail",
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return res.status(400).json({
        status: "fail",
        message: "An account with this email already exists",
      });
    }

    const allowedRoles = ["WORKFORCE_PLANNER", "HR", "CEO", "CANDIDATE"] as const;
    const normalizedRole = typeof role === "string" ? role.trim() : "";

    if (normalizedRole && !allowedRoles.includes(normalizedRole as (typeof allowedRoles)[number])) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid role selected",
      });
    }

    const verificationToken = generateVerificationToken();
    const password_hash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password_hash,
        full_name: String(full_name).trim(),
        role: (normalizedRole || "WORKFORCE_PLANNER") as UserRole,
        verification_token: verificationToken,
      },
      select: userSelect,
    });

    res.status(201).json({
      status: "success",
      message: "Account created. Please verify your email.",
      data: {
        user,
        verificationToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide email and password",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({
        status: "fail",
        message: "Incorrect email or password",
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        status: "fail",
        message: "Your account has been deactivated",
      });
    }

    const token = generateToken(user.id, user.role);

    res.status(200).json({
      status: "success",
      token,
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          title: user.title,
          is_verified: user.is_verified,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.params;

    const user = await prisma.user.findFirst({
      where: { verification_token: token },
    });

    if (!user) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid or expired verification token",
      });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { is_verified: true, verification_token: null },
      select: userSelect,
    });

    const jwtToken = generateToken(updated.id, updated.role);

    res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      token: jwtToken,
      data: { user: updated },
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "No account found with this email",
      });
    }

    if (user.is_verified) {
      return res.status(400).json({
        status: "fail",
        message: "Email is already verified",
      });
    }

    const verificationToken = generateVerificationToken();
    await prisma.user.update({
      where: { id: user.id },
      data: { verification_token: verificationToken },
    });

    res.status(200).json({
      status: "success",
      message: "Verification email sent",
      data: { verificationToken },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: userSelect,
    });

    res.status(200).json({ status: "success", data: { user } });
  } catch (error) {
    next(error);
  }
};

export const completeProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { title: title || null },
      select: userSelect,
    });

    res.status(200).json({
      status: "success",
      message: "Profile completed",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
