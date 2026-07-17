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
 *                    along with the raw verification token.
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
 * listUsers        — returns all users sorted by name (admin utility).
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

const validPermissions = [
  "VIEW_DASHBOARD",
  "MANAGE_WORKFORCE_PLANS",
  "VIEW_VACANCIES",
  "VIEW_CANDIDATES",
  "VIEW_HR_REVIEW",
  "VIEW_CEO_REVIEW",
  "VIEW_INTERVIEWS",
  "VIEW_OFFERS",
  "VIEW_ANALYTICS",
  "MANAGE_ROLES",
] as const;

type PermissionValue = (typeof validPermissions)[number];

const defaultPermissionsByRole: Record<string, PermissionValue[]> = {
  WORKFORCE_PLANNER: [
    "VIEW_DASHBOARD",
    "MANAGE_WORKFORCE_PLANS",
    "VIEW_VACANCIES",
    "VIEW_CANDIDATES",
    "VIEW_INTERVIEWS",
    "VIEW_OFFERS",
    "VIEW_ANALYTICS",
  ],
  HR: ["VIEW_DASHBOARD", "VIEW_HR_REVIEW"],
  CEO: ["VIEW_DASHBOARD", "VIEW_CEO_REVIEW"],
  CANDIDATE: ["VIEW_DASHBOARD", "VIEW_CANDIDATES"],
  HR_ADMIN: ["VIEW_DASHBOARD", "MANAGE_ROLES"],
};

function normalizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input.filter(
        (value): value is string =>
          typeof value === "string" &&
          (validPermissions as readonly string[]).includes(value),
      ),
    ),
  );
}

// Columns returned for every user query — never exposes password_hash or tokens
const userSelect = {
  id: true,
  email: true,
  full_name: true,
  role: true,
  title: true,
  permissions: true,
  is_verified: true,
  is_active: true,
  created_at: true,
};

async function getPermissionsForRole(
  role: UserRole,
): Promise<PermissionValue[]> {
  const rolePermissions = await prisma.rolePermission.findUnique({
    where: { role },
  });

  if (rolePermissions && Array.isArray(rolePermissions.permissions)) {
    return rolePermissions.permissions.filter(
      (value): value is PermissionValue =>
        typeof value === "string" &&
        (validPermissions as readonly string[]).includes(value),
    );
  }

  return defaultPermissionsByRole[role] ?? [];
}

function parseRole(role: unknown): UserRole | null {
  if (typeof role !== "string") return null;
  return Object.values(UserRole).includes(role as UserRole)
    ? (role as UserRole)
    : null;
}

export const register = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
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

    const allowedRoles = Object.values(UserRole);
    const normalizedRole = typeof role === "string" ? role.trim() : "";
    const selectedRole = allowedRoles.includes(normalizedRole as UserRole)
      ? (normalizedRole as UserRole)
      : UserRole.WORKFORCE_PLANNER;

    const verificationToken = generateVerificationToken();
    const password_hash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password_hash,
        full_name: String(full_name).trim(),
        role: selectedRole,
        permissions: [],
        verification_token: verificationToken,
      },
      select: userSelect,
    });

    res.status(201).json({
      status: "success",
      message: "Account created. Please verify your email.",
      data: { user, verificationToken },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
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

    const permissions = await getPermissionsForRole(user.role);

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
          permissions,
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
  next: NextFunction,
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

    const permissions = await getPermissionsForRole(updated.role);

    res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      token: jwtToken,
      data: {
        user: {
          ...updated,
          permissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
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
  next: NextFunction,
) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: userSelect,
    });

    const permissions = await getPermissionsForRole(user!.role);
    res.status(200).json({
      status: "success",
      data: {
        user: {
          ...user,
          permissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const completeProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { title } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { title: title || null },
      select: userSelect,
    });

    const permissions = await getPermissionsForRole(user.role);

    res.status(200).json({
      status: "success",
      message: "Profile completed",
      data: {
        user: {
          ...user,
          permissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        full_name: true,
        role: true,
        title: true,
        is_verified: true,
        is_active: true,
        created_at: true,
      },
      orderBy: { full_name: "asc" },
    });

    const usersWithPermissions = await Promise.all(
      users.map(async (user) => ({
        ...user,
        permissions: await getPermissionsForRole(user.role),
      })),
    );

    res
      .status(200)
      .json({ status: "success", data: { users: usersWithPermissions } });
  } catch (error) {
    next(error);
  }
};

export const listRolePermissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const rows = await prisma.rolePermission.findMany();
    const rowMap = rows.reduce<Record<string, PermissionValue[]>>(
      (acc, row) => {
        acc[row.role] = row.permissions.filter(
          (value): value is PermissionValue =>
            typeof value === "string" &&
            (validPermissions as readonly string[]).includes(value),
        );
        return acc;
      },
      {} as Record<string, PermissionValue[]>,
    );

    const roles = Object.values(UserRole).map((role) => ({
      role,
      permissions: rowMap[role] ?? defaultPermissionsByRole[role] ?? [],
    }));

    res.status(200).json({ status: "success", data: { roles } });
  } catch (error) {
    next(error);
  }
};

export const updateRolePermissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const role = parseRole(req.params.role);
    if (!role) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid role",
      });
    }

    const permissions = normalizePermissions(req.body.permissions);
    const rolePermission = await prisma.rolePermission.upsert({
      where: { role },
      create: { role, permissions },
      update: { permissions },
    });

    res.status(200).json({
      status: "success",
      message: "Role permissions updated",
      data: { rolePermission },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserPermissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    const validatedPermissions = normalizePermissions(permissions);

    const user = await prisma.user.update({
      where: { id },
      data: { permissions: validatedPermissions },
      select: userSelect,
    });

    res.status(200).json({
      status: "success",
      message: "Permissions updated",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
