/**
 * middleware/authMiddleware.ts
 *
 * Express middleware for authentication and authorisation:
 *
 * - AuthRequest — extends Express Request with an optional `user` field that
 *   carries the resolved user's id, email, role, full_name, and is_verified flag.
 *
 * - protect — reads the Bearer token from the Authorization header, verifies it
 *   with verifyToken(), looks up the user in the database, and attaches the user
 *   object to req.user. Returns 401 if the token is missing, invalid, or the
 *   account is deactivated.
 *
 * - requireVerified — guard that rejects requests with 403 when the authenticated
 *   user has not yet confirmed their email address.
 *
 * - requireRoles(...roles) — factory that returns a middleware which rejects with
 *   403 if the authenticated user's role is not in the allowed list.
 */
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "src/utils/auth";
import { prisma } from "src/utils/prisma";

export const validPermissions = [
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

export type PermissionValue = (typeof validPermissions)[number];

export const defaultPermissionsByRole: Record<string, PermissionValue[]> = {
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

export function normalizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
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

export async function getPermissionsForRole(
  role: string,
): Promise<PermissionValue[]> {
  const row = await prisma.rolePermission.findUnique({ where: { role } });
  if (row && Array.isArray(row.permissions)) {
    return row.permissions.filter(
      (value): value is PermissionValue =>
        typeof value === "string" &&
        (validPermissions as readonly string[]).includes(value),
    );
  }
  return defaultPermissionsByRole[role] ?? [];
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    full_name: string;
    is_verified: boolean;
  };
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ status: "fail", message: "Not authorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        full_name: true,
        is_verified: true,
        is_active: true,
      },
    });

    if (!user || !user.is_active) {
      return res
        .status(401)
        .json({ status: "fail", message: "User not found" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      is_verified: user.is_verified,
    };
    next();
  } catch {
    return res.status(401).json({ status: "fail", message: "Invalid token" });
  }
};

export const requireVerified = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({ status: "fail", message: "Not authorized" });
  }
  if (!req.user.is_verified) {
    return res.status(403).json({
      status: "fail",
      message: "Please verify your email before continuing",
    });
  }
  next();
};

export const requireRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: "fail", message: "Access denied" });
    }
    next();
  };
};
