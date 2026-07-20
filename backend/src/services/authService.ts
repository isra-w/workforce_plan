/**
 * services/authService.ts
 *
 * All database interactions and business logic for user authentication,
 * registration, verification, profile management, and role/permission
 * management.
 *
 * Controllers call these methods and only deal with HTTP concerns.
 * No Express types live here.
 */
import { UserRole } from "@prisma/client";
import { prisma } from "src/utils/prisma";
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateVerificationToken,
} from "src/utils/auth";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

// Columns returned for every user query — never exposes password_hash or tokens
export const userSelect = {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

export function parseRole(role: unknown): UserRole | null {
  if (typeof role !== "string") return null;
  return Object.values(UserRole).includes(role as UserRole)
    ? (role as UserRole)
    : null;
}

export async function getPermissionsForRole(
  role: UserRole,
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

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  role?: string;
}

export async function registerUser(input: RegisterInput) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) throw new Error("DUPLICATE_EMAIL");

  const allowedRoles = Object.values(UserRole);
  const normalizedRole =
    typeof input.role === "string" ? input.role.trim() : "";
  const selectedRole = allowedRoles.includes(normalizedRole as UserRole)
    ? (normalizedRole as UserRole)
    : UserRole.WORKFORCE_PLANNER;

  const verificationToken = generateVerificationToken();
  const password_hash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password_hash,
      full_name: input.full_name.trim(),
      role: selectedRole,
      permissions: [],
      verification_token: verificationToken,
    },
    select: userSelect,
  });

  return { user, verificationToken };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function loginUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !(await comparePassword(password, user.password_hash))) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!user.is_active) throw new Error("ACCOUNT_INACTIVE");

  const token = generateToken(user.id, user.role);
  const permissions = await getPermissionsForRole(user.role);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      title: user.title,
      permissions,
      is_verified: user.is_verified,
    },
  };
}

// ---------------------------------------------------------------------------
// Verify email
// ---------------------------------------------------------------------------

export async function verifyUserEmail(token: string) {
  const user = await prisma.user.findFirst({
    where: { verification_token: token },
  });
  if (!user) throw new Error("INVALID_TOKEN");

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { is_verified: true, verification_token: null },
    select: userSelect,
  });

  const jwtToken = generateToken(updated.id, updated.role);
  const permissions = await getPermissionsForRole(updated.role);

  return { token: jwtToken, user: { ...updated, permissions } };
}

// ---------------------------------------------------------------------------
// Resend verification
// ---------------------------------------------------------------------------

export async function resendVerificationToken(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.is_verified) throw new Error("ALREADY_VERIFIED");

  const verificationToken = generateVerificationToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { verification_token: verificationToken },
  });

  return { verificationToken };
}

// ---------------------------------------------------------------------------
// Get profile
// ---------------------------------------------------------------------------

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) return null;
  const permissions = await getPermissionsForRole(user.role);
  return { ...user, permissions };
}

// ---------------------------------------------------------------------------
// Complete profile
// ---------------------------------------------------------------------------

export async function updateUserTitle(id: string, title: string | null) {
  const user = await prisma.user.update({
    where: { id },
    data: { title: title || null },
    select: userSelect,
  });
  const permissions = await getPermissionsForRole(user.role);
  return { ...user, permissions };
}

// ---------------------------------------------------------------------------
// List users
// ---------------------------------------------------------------------------

export async function listAllUsers() {
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

  return Promise.all(
    users.map(async (user) => ({
      ...user,
      permissions: await getPermissionsForRole(user.role),
    })),
  );
}

// ---------------------------------------------------------------------------
// Role permissions
// ---------------------------------------------------------------------------

export async function listAllRolePermissions() {
  const rows = await prisma.rolePermission.findMany();
  const rowMap = rows.reduce<Record<string, PermissionValue[]>>((acc, row) => {
    acc[row.role] = row.permissions.filter(
      (value): value is PermissionValue =>
        typeof value === "string" &&
        (validPermissions as readonly string[]).includes(value),
    );
    return acc;
  }, {});

  return Object.values(UserRole).map((role) => ({
    role,
    permissions: rowMap[role] ?? defaultPermissionsByRole[role] ?? [],
  }));
}

export async function setRolePermissions(
  role: UserRole,
  permissions: string[],
) {
  return prisma.rolePermission.upsert({
    where: { role },
    create: { role, permissions },
    update: { permissions },
  });
}

// ---------------------------------------------------------------------------
// User permissions
// ---------------------------------------------------------------------------

export async function setUserPermissions(id: string, permissions: string[]) {
  return prisma.user.update({
    where: { id },
    data: { permissions },
    select: userSelect,
  });
}
