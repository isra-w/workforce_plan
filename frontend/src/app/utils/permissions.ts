import { UserRole } from "../../utils/types";

export type PermissionKey =
  | "VIEW_DASHBOARD"
  | "MANAGE_WORKFORCE_PLANS"
  | "VIEW_VACANCIES"
  | "VIEW_CANDIDATES"
  | "VIEW_HR_REVIEW"
  | "VIEW_CEO_REVIEW"
  | "VIEW_INTERVIEWS"
  | "VIEW_OFFERS"
  | "VIEW_ANALYTICS"
  | "MANAGE_ROLES";

export const defaultPermissionsByRole: Record<UserRole, PermissionKey[]> = {
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

export const allPermissionKeys: PermissionKey[] = Array.from(
  new Set(Object.values(defaultPermissionsByRole).flat()),
);

export type RawPermissions = PermissionKey[] | string[] | null | undefined;

export function normalizePermissions(
  permissions: RawPermissions,
  role?: UserRole,
): PermissionKey[] {
  if (permissions && Array.isArray(permissions) && permissions.length > 0) {
    const normalized = permissions.filter(
      (value): value is PermissionKey =>
        typeof value === "string" &&
        allPermissionKeys.includes(value as PermissionKey),
    );
    return Array.from(new Set(normalized) as Set<PermissionKey>);
  }
  return role ? (defaultPermissionsByRole[role] ?? []) : [];
}

export function hasPermission(
  permissions: RawPermissions,
  permission: PermissionKey,
  role?: UserRole,
): boolean {
  return normalizePermissions(permissions, role).includes(permission);
}
