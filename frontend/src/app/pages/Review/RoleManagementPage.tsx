/**
 * pages/Review/RoleManagementPage.tsx
 *
 * HR_ADMIN page — left panel: role cards, right panel: resource × CRUD grid.
 * Each cell has a custom floating dropdown with two options:
 *   Denied  — no permission
 *   Allowed — permission granted
 */
import { useEffect, useRef, useState } from "react";
import { authService } from "../../services/workforceService";
import { normalizePermissions, PermissionKey } from "../../utils/permissions";
import { UserRole } from "../../../utils/types";
import {
  FiSearch,
  FiSave,
  FiUsers,
  FiSliders,
  FiChevronDown,
} from "react-icons/fi";
import toast from "react-hot-toast";

// ── Scope type & helpers ──────────────────────────────────────────────────

type Scope = "Denied" | "Allowed";
const SCOPES: Scope[] = ["Denied", "Allowed"];

function scopeLabel(s: Scope) {
  return s;
}
function isActive(s: Scope) {
  return s === "Allowed";
}

// ── Types ─────────────────────────────────────────────────────────────────

interface RoleRow {
  role: UserRole;
  permissions: PermissionKey[];
}
type Action = "READ" | "CREATE" | "UPDATE" | "DELETE";
const ACTIONS: Action[] = ["READ", "CREATE", "UPDATE", "DELETE"];

// ── Resource → permission-key mapping ────────────────────────────────────
const RESOURCES: Array<{
  label: string;
  module: string;
  keys: Record<Action, PermissionKey | null>;
}> = [
  {
    label: "Dashboard",
    module: "Core",
    keys: { READ: "VIEW_DASHBOARD", CREATE: null, UPDATE: null, DELETE: null },
  },
  {
    label: "Workforce Plans",
    module: "Workforce",
    keys: {
      READ: "MANAGE_WORKFORCE_PLANS",
      CREATE: "MANAGE_WORKFORCE_PLANS",
      UPDATE: "MANAGE_WORKFORCE_PLANS",
      DELETE: "MANAGE_WORKFORCE_PLANS",
    },
  },
  {
    label: "Vacancies",
    module: "Workforce",
    keys: { READ: "VIEW_VACANCIES", CREATE: null, UPDATE: null, DELETE: null },
  },
  {
    label: "Candidates",
    module: "Recruitment",
    keys: { READ: "VIEW_CANDIDATES", CREATE: null, UPDATE: null, DELETE: null },
  },
  {
    label: "Interviews",
    module: "Recruitment",
    keys: { READ: "VIEW_INTERVIEWS", CREATE: null, UPDATE: null, DELETE: null },
  },
  {
    label: "Offers",
    module: "Recruitment",
    keys: { READ: "VIEW_OFFERS", CREATE: null, UPDATE: null, DELETE: null },
  },
  {
    label: "Analytics",
    module: "Reporting",
    keys: { READ: "VIEW_ANALYTICS", CREATE: null, UPDATE: null, DELETE: null },
  },
  {
    label: "HR Review",
    module: "Review",
    keys: { READ: "VIEW_HR_REVIEW", CREATE: null, UPDATE: null, DELETE: null },
  },
  {
    label: "CEO Review",
    module: "Review",
    keys: { READ: "VIEW_CEO_REVIEW", CREATE: null, UPDATE: null, DELETE: null },
  },
  {
    label: "Role Management",
    module: "Admin",
    keys: {
      READ: "MANAGE_ROLES",
      CREATE: "MANAGE_ROLES",
      UPDATE: "MANAGE_ROLES",
      DELETE: "MANAGE_ROLES",
    },
  },
];

const MODULES = [
  "All Modules",
  ...Array.from(new Set(RESOURCES.map((r) => r.module))),
];

const ROLE_META: Record<string, { desc: string; isSystem: boolean }> = {
  WORKFORCE_PLANNER: {
    desc: "Standard platform permissions and workforce submissions",
    isSystem: false,
  },
  HR: { desc: "HR review and approval workflow access", isSystem: false },
  CEO: {
    desc: "Final approver for workforce plans and job postings",
    isSystem: true,
  },
  CANDIDATE: {
    desc: "Standard platform permissions and basic access",
    isSystem: false,
  },
  HR_ADMIN: {
    desc: "Full HR operations and system configuration access",
    isSystem: true,
  },
};

// ── ScopeDropdown ─────────────────────────────────────────────────────────
// A custom floating dropdown that replaces the native <select>.

interface ScopeDropdownProps {
  value: Scope;
  disabled?: boolean;
  onChange: (v: Scope) => void;
}

function ScopeDropdown({ value, disabled, onChange }: ScopeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = isActive(value);

  return (
    <div ref={ref} className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 px-2 py-1.5 min-w-[72px] border border-slate-200 rounded-md bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer outline-none transition-all justify-between hover:border-slate-300 hover:bg-slate-100 ${
          active ? "text-green-600" : ""
        } ${disabled ? "opacity-35 cursor-not-allowed hover:border-slate-200 hover:bg-slate-50" : ""}`}
      >
        <span>{value}</span>
        <FiChevronDown
          size={11}
          className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Floating panel */}
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 z-[999] bg-white border border-slate-200 rounded-lg shadow-lg min-w-[90px] overflow-hidden">
          {SCOPES.map((s) => (
            <div
              key={s}
              className={`px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer transition-colors hover:bg-slate-50 ${
                s === value ? "bg-slate-100 font-bold" : ""
              } ${isActive(s) ? "text-green-600 font-bold" : "text-red-600"}`}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [permSearch, setPermSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All Modules");

  // Per-cell scope state: key = `${role}__${resource}__${action}`
  const [scopes, setScopes] = useState<Record<string, Scope>>({});

  // ── Load roles ──────────────────────────────────────────────────────
  useEffect(() => {
    authService
      .getRolePermissions()
      .then((res) => {
        const list: RoleRow[] = res.data.data.roles.map(
          (r: { role: UserRole; permissions: PermissionKey[] }) => ({
            role: r.role,
            permissions: normalizePermissions(r.permissions, r.role),
          }),
        );
        setRoles(list);
        // Seed scope map: if permission key is in the role's permissions → "Allowed", else "Denied"
        const initial: Record<string, Scope> = {};
        for (const r of list) {
          for (const res of RESOURCES) {
            for (const action of ACTIONS) {
              const key = res.keys[action];
              const cellKey = `${r.role}__${res.label}__${action}`;
              initial[cellKey] =
                key && r.permissions.includes(key) ? "Allowed" : "Denied";
            }
          }
        }
        setScopes(initial);
        if (list.length > 0) setSelected(list[0].role);
      })
      .catch(() => toast.error("Failed to load role permissions"))
      .finally(() => setLoading(false));
  }, []);

  const activeRole = roles.find((r) => r.role === selected) ?? null;

  // Get scope for a cell
  const getScope = (resource: string, action: Action): Scope =>
    scopes[`${selected}__${resource}__${action}`] ?? "Denied";

  // Set scope for a cell
  const setScope = (resource: string, action: Action, value: Scope) => {
    setScopes((prev) => ({
      ...prev,
      [`${selected}__${resource}__${action}`]: value,
    }));
  };

  // Grant / Revoke all visible cells
  const setAll = (scope: Scope) => {
    if (!selected) return;
    setScopes((prev) => {
      const next = { ...prev };
      for (const res of visibleResources) {
        for (const action of ACTIONS) {
          if (res.keys[action] !== null) {
            next[`${selected}__${res.label}__${action}`] = scope;
          }
        }
      }
      return next;
    });
  };

  // Save — convert scopes back to flat permission key array
  const save = async () => {
    if (!activeRole) return;
    setSaving(true);
    try {
      // Build the new permissions list: include key if scope is "Allowed"
      const newPerms: PermissionKey[] = [];
      for (const res of RESOURCES) {
        for (const action of ACTIONS) {
          const key = res.keys[action];
          if (!key) continue;
          const scope = scopes[`${selected}__${res.label}__${action}`] ?? "Denied";
          if (scope === "Allowed") newPerms.push(key);
        }
      }
      // Deduplicate
      const deduped = Array.from(new Set(newPerms));
      await authService.updateRolePermissions(activeRole.role, deduped);
      // Update local role permission count
      setRoles((prev) =>
        prev.map((r) =>
          r.role === selected ? { ...r, permissions: deduped } : r,
        ),
      );
      toast.success("Permissions saved");
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const visibleResources = RESOURCES.filter((res) => {
    const matchModule =
      moduleFilter === "All Modules" || res.module === moduleFilter;
    const matchSearch = res.label
      .toLowerCase()
      .includes(permSearch.toLowerCase());
    return matchModule && matchSearch;
  });

  const filteredRoles = roles.filter((r) =>
    r.role.toLowerCase().includes(roleSearch.toLowerCase()),
  );

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="flex flex-col gap-5 font-sans">{/* ── ScopeDropdown styles moved to Tailwind classes ── */}

      {/* page header */}
      <div className="border-b border-slate-100 pb-4 mb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 m-0">Role Management</h1>
        <p className="text-sm text-slate-600 mt-1">Manage company roles and their resource-level access permissions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] xl:grid-cols-[280px_1fr] gap-5 items-start">
        {/* ── LEFT: role list ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 md:sticky md:top-4 max-h-[calc(100vh-12rem)] overflow-y-auto shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-base font-bold text-slate-900 m-0">Roles</h2>
            <button
              className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer hover:bg-green-700 transition-colors shadow-sm"
              onClick={() => toast("Contact super admin to create new roles.")}
            >
              + New Role
            </button>
          </div>
          <div className="relative">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              placeholder="Search roles"
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm bg-white outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
            />
          </div>
          <div className="flex flex-col gap-2">
            {filteredRoles.map((r) => {
              const meta = ROLE_META[r.role] ?? ROLE_META["WORKFORCE_PLANNER"];
              const isAct = r.role === selected;
              return (
                <div
                  key={r.role}
                  className={`border rounded-lg p-3 cursor-pointer flex justify-between items-start transition-all hover:shadow-sm ${
                    isAct ? "border-green-500 bg-green-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  onClick={() => setSelected(r.role)}
                >
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2">
                      {r.role.replace(/_/g, " ")}
                      {meta.isSystem && (
                        <span className="text-[0.6rem] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase">
                          System
                        </span>
                      )}
                    </div>
                    <div className="text-[0.7rem] text-slate-500 mt-1 line-clamp-2">
                      {meta.desc}
                    </div>
                    <div className="flex items-center gap-1 text-[0.65rem] text-amber-600 mt-1.5 font-medium">
                      <span>🔑</span>
                      <span>{r.permissions.length} permissions</span>
                    </div>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isAct ? "bg-white text-green-600" : "bg-slate-100 text-slate-400"
                  }`}>
                    <FiUsers size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: resource × CRUD grid ── */}
        {activeRole ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4 min-w-0 overflow-hidden">
            <div className="flex justify-between items-start flex-wrap gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="text-[0.68rem] font-bold text-green-600 tracking-wider uppercase">ROLE PERMISSIONS</div>
                <div className="text-xl font-extrabold text-slate-900 mt-1">
                  {activeRole.role.replace(/_/g, " ")}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {
                    (
                      ROLE_META[activeRole.role] ??
                      ROLE_META["WORKFORCE_PLANNER"]
                    ).desc
                  }
                </div>
              </div>
              <button 
                className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-lg border-none cursor-pointer whitespace-nowrap hover:bg-slate-700 disabled:opacity-55 disabled:cursor-not-allowed transition-colors" 
                onClick={save} 
                disabled={saving}
              >
                {saving ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                ) : (
                  <FiSave size={14} />
                )}
                Save Changes
              </button>
            </div>

            {/* filters */}
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-[220px]">
                <FiSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  placeholder="Search resources (name or code)..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:border-green-600 focus:bg-white transition-colors"
                />
              </div>
              <select
                className="py-2 pr-8 pl-3 border border-slate-200 rounded-lg text-sm bg-white outline-none appearance-none cursor-pointer min-w-[140px]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 0.6rem center"
                }}
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
              >
                {MODULES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* grant / revoke all */}
            <div className="flex justify-end gap-2 py-2 border-b border-slate-100">
              <button
                className="text-xs font-bold px-3 py-1.5 rounded-md border-none cursor-pointer bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                onClick={() => setAll("Allowed")}
              >
                Grant All
              </button>
              <button
                className="text-xs font-bold px-3 py-1.5 rounded-md border-none cursor-pointer bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                onClick={() => setAll("Denied")}
              >
                Revoke All
              </button>
            </div>

            {/* table */}
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full border-collapse text-sm min-w-[800px]">
                <thead>
                  <tr>
                    <th className="text-left font-bold text-slate-700 py-2.5 px-3.5 bg-slate-50 border-b-2 border-slate-200 whitespace-nowrap min-w-[160px]">Resources</th>
                    <th className="text-center font-bold text-slate-700 py-2.5 px-3.5 bg-slate-50 border-b-2 border-slate-200 whitespace-nowrap min-w-[100px]">Read</th>
                    <th className="text-center font-bold text-slate-700 py-2.5 px-3.5 bg-slate-50 border-b-2 border-slate-200 whitespace-nowrap min-w-[100px]">Create</th>
                    <th className="text-center font-bold text-slate-700 py-2.5 px-3.5 bg-slate-50 border-b-2 border-slate-200 whitespace-nowrap min-w-[100px]">Update</th>
                    <th className="text-center font-bold text-slate-700 py-2.5 px-3.5 bg-slate-50 border-b-2 border-slate-200 whitespace-nowrap min-w-[100px]">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResources.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 text-sm">
                        No resources match.
                      </td>
                    </tr>
                  )}
                  {visibleResources.map((res) => (
                    <tr key={res.label} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3.5 border-b border-slate-50 font-medium text-slate-900">{res.label}</td>
                      {ACTIONS.map((action) => (
                        <td key={action} className="py-2.5 px-3.5 border-b border-slate-50 text-center">
                          <ScopeDropdown
                            value={getScope(res.label, action)}
                            disabled={res.keys[action] === null}
                            onChange={(v) => setScope(res.label, action, v)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-sm">
            Select a role to manage permissions.
          </div>
        )}
      </div>
    </div>
  );
}
