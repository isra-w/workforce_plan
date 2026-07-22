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

/** System role names — kept as strings since the DB column is now TEXT */
export const SYSTEM_ROLES = [
  "WORKFORCE_PLANNER",
  "HR",
  "CEO",
  "CANDIDATE",
  "HR_ADMIN",
] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

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
  "MANAGE_PERMISSIONS",
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
  HR_ADMIN: ["VIEW_DASHBOARD", "MANAGE_ROLES", "MANAGE_PERMISSIONS"],
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

export function parseRole(role: unknown): string | null {
  if (typeof role !== "string") return null;
  return role.trim() || null;
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

  // Accept any active role from custom_roles table, default to WORKFORCE_PLANNER
  let selectedRole = "WORKFORCE_PLANNER";

  if (input.role) {
    const normalizedRole = input.role.trim();
    const roleExists = await prisma.customRole.findUnique({
      where: { name: normalizedRole, is_active: true },
    });
    if (roleExists) selectedRole = normalizedRole;
  }

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
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
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
  // Single source of truth: custom_roles table (includes system roles inserted by migration)
  const customRoles = await prisma.customRole.findMany({
    where: { is_active: true },
    orderBy: [{ is_system: "desc" }, { display_name: "asc" }],
  });

  const rows = await prisma.rolePermission.findMany();
  const rowMap = rows.reduce<Record<string, PermissionValue[]>>((acc, row) => {
    acc[row.role] = row.permissions.filter(
      (value): value is PermissionValue =>
        typeof value === "string" &&
        (validPermissions as readonly string[]).includes(value),
    );
    return acc;
  }, {});

  return customRoles.map((role) => ({
    role: role.name,
    display_name: role.display_name,
    description: role.description,
    is_system: role.is_system,
    permissions: rowMap[role.name] ?? defaultPermissionsByRole[role.name] ?? [],
  }));
}

export async function setRolePermissions(role: string, permissions: string[]) {
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

// ---------------------------------------------------------------------------
// Resource × action permissions
// ---------------------------------------------------------------------------

/** The canonical list of resources exposed in the permissions grid */
export const RESOURCES = [
  "Workforce Plans",
  "Departments",
  "Vacancies",
  "Candidates",
  "Interviews",
  "Offers",
  "Analytics",
  "HR Review",
  "CEO Review",
  "Role Management",
  "User Management",
  "Attachments",
  "Reports",
] as const;

export type Resource = (typeof RESOURCES)[number];

export type PermissionLevel = "N/A" | "Own" | "Team" | "Any";
export const PERMISSION_LEVELS: PermissionLevel[] = [
  "N/A",
  "Own",
  "Team",
  "Any",
];

/** Returns true if the level grants any access (Own, Team, or Any) */
export function isGranted(level: string): boolean {
  return level === "Own" || level === "Team" || level === "Any";
}

export const ACTIONS = ["READ", "CREATE", "UPDATE", "DELETE"] as const;
export type Action = (typeof ACTIONS)[number];

export interface UserPermissionRow {
  resource: Resource;
  READ: PermissionLevel;
  CREATE: PermissionLevel;
  UPDATE: PermissionLevel;
  DELETE: PermissionLevel;
}
export async function getUserPermissionGrid(
  userId: string,
): Promise<UserPermissionRow[]> {
  const rows = await prisma.userPermission.findMany({
    where: { user_id: userId },
  });

  const map: Record<string, Record<string, PermissionLevel>> = {};
  for (const row of rows) {
    if (!map[row.resource]) map[row.resource] = {};
    map[row.resource][row.action] = (row.level as PermissionLevel) ?? "N/A";
  }

  return RESOURCES.map((resource) => ({
    resource,
    READ: map[resource]?.["READ"] ?? "N/A",
    CREATE: map[resource]?.["CREATE"] ?? "N/A",
    UPDATE: map[resource]?.["UPDATE"] ?? "N/A",
    DELETE: map[resource]?.["DELETE"] ?? "N/A",
  }));
}

export interface PermissionPatch {
  resource: string;
  action: string;
  level: PermissionLevel;
}

/** Upsert a batch of resource×action level grants for a user (full replacement) */
export async function setUserPermissionGrid(
  userId: string,
  patches: PermissionPatch[],
) {
  await prisma.userPermission.deleteMany({ where: { user_id: userId } });

  const data = patches
    .filter(
      (p) =>
        ACTIONS.includes(p.action as Action) && p.resource && p.level !== "N/A",
    )
    .map((p) => ({
      user_id: userId,
      resource: p.resource,
      action: p.action,
      level: p.level,
    }));

  if (data.length > 0) {
    await prisma.userPermission.createMany({ data });
  }

  return getUserPermissionGrid(userId);
}

// ---------------------------------------------------------------------------
// Custom Role Management
// ---------------------------------------------------------------------------

export interface CreateRoleInput {
  name: string;
  display_name: string;
  description?: string;
}

/** Get all roles (system + custom) — single source of truth: custom_roles table */
export async function getAllRoles() {
  const roles = await prisma.customRole.findMany({
    where: { is_active: true },
    orderBy: [{ is_system: "desc" }, { display_name: "asc" }],
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    display_name: role.display_name,
    description: role.description,
    is_system: role.is_system,
    is_active: role.is_active,
  }));
}

/** Create a new custom role */
export async function createCustomRole(input: CreateRoleInput) {
  // Check if role already exists
  const existing = await prisma.customRole.findUnique({
    where: { name: input.name },
  });
  if (existing) throw new Error("ROLE_EXISTS");

  // Create the role
  const role = await prisma.customRole.create({
    data: {
      name: input.name,
      display_name: input.display_name,
      description: input.description || null,
      is_system: true,
      is_active: true,
    },
  });

  // Create empty role permissions entry
  await prisma.rolePermission.create({
    data: {
      role: input.name,
      permissions: [],
    },
  });

  return role;
}

/** Delete a custom role (only user-created roles) */
export async function deleteCustomRole(name: string) {
  const role = await prisma.customRole.findUnique({ where: { name } });

  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (role.is_system) throw new Error("CANNOT_DELETE_SYSTEM_ROLE");

  // Check if any users have this role
  const usersWithRole = await prisma.user.count({
    where: { role: name },
  });
  if (usersWithRole > 0) throw new Error("ROLE_IN_USE");

  // Delete role permissions
  await prisma.rolePermission.deleteMany({ where: { role: name } });

  // Delete the role
  await prisma.customRole.delete({ where: { name } });
}
