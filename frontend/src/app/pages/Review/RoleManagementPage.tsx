/**
 * pages/Review/RoleManagementPage.tsx
 *
 * HR_ADMIN page — left panel: role cards, right panel: resource × CRUD grid.
 * Each cell has a custom floating dropdown with four scope levels:
 *   N/A  — no permission at all
 *   Own  — user can act only on their own records
 *   Team — user can act on their whole department's records
 *   Any  — full access (own + team + everything else)  ← shown in orange
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

type Scope = "N/A" | "Own" | "Team" | "Any";
const SCOPES: Scope[] = ["N/A", "Own", "Team", "Any"];

function scopeLabel(s: Scope) {
  return s;
}
function isActive(s: Scope) {
  return s !== "N/A";
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
  {
    label: "Permissions",
    module: "Admin",
    keys: {
      READ: "MANAGE_PERMISSIONS",
      CREATE: "MANAGE_PERMISSIONS",
      UPDATE: "MANAGE_PERMISSIONS",
      DELETE: "MANAGE_PERMISSIONS",
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
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`sd-trigger${active ? " sd-active" : ""}${disabled ? " sd-disabled" : ""}`}
      >
        <span>{value}</span>
        <FiChevronDown
          size={11}
          className={`sd-chevron${open ? " sd-chevron-open" : ""}`}
        />
      </button>

      {/* Floating panel */}
      {open && (
        <div className="sd-panel">
          {SCOPES.map((s) => (
            <div
              key={s}
              className={`sd-option${s === value ? " sd-option-selected" : ""}${isActive(s) && s === "Any" ? " sd-option-any" : ""}`}
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
        // Seed scope map: if permission key is in the role's permissions → "Any", else "N/A"
        const initial: Record<string, Scope> = {};
        for (const r of list) {
          for (const res of RESOURCES) {
            for (const action of ACTIONS) {
              const key = res.keys[action];
              const cellKey = `${r.role}__${res.label}__${action}`;
              initial[cellKey] =
                key && r.permissions.includes(key) ? "Any" : "N/A";
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
    scopes[`${selected}__${resource}__${action}`] ?? "N/A";

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
      // Build the new permissions list: include key if scope !== "N/A"
      const newPerms: PermissionKey[] = [];
      for (const res of RESOURCES) {
        for (const action of ACTIONS) {
          const key = res.keys[action];
          if (!key) continue;
          const scope = scopes[`${selected}__${res.label}__${action}`] ?? "N/A";
          if (scope !== "N/A") newPerms.push(key);
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
      <div className="page-loading">
        <div className="loader-icon" />
      </div>
    );

  return (
    <div className="rm-page">
      <style>{`
        /* ── ScopeDropdown ── */
        .sd-trigger {
          display: inline-flex; align-items: center; gap: 0.3rem;
          padding: 0.28rem 0.55rem; min-width: 72px;
          border: 1px solid #e2e8f0; border-radius: 0.4rem;
          background: #f8fafc; color: #475569;
          font-size: 0.76rem; font-weight: 600;
          cursor: pointer; outline: none;
          transition: border-color 0.12s, background 0.12s;
          justify-content: space-between;
        }
        .sd-trigger:hover:not(.sd-disabled) { border-color: #cbd5e1; background: #f1f5f9; }
        .sd-trigger.sd-active { color: #16a34a;}
        .sd-trigger.sd-disabled { opacity: 0.35; cursor: not-allowed; }
        .sd-chevron { transition: transform 0.15s; color: currentColor; flex-shrink: 0; }
        .sd-chevron.sd-chevron-open { transform: rotate(180deg); }

        .sd-panel {
          position: absolute; top: calc(100% + 4px); left: 0; z-index: 999;
          background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem;
          box-shadow: 0 4px 16px rgba(0,0,0,0.10);
          min-width: 90px; overflow: hidden;
        }
        .sd-option {
          padding: 0.42rem 0.75rem;
          font-size: 0.8rem; font-weight: 500; color: #334155;
          cursor: pointer;
          transition: background 0.1s;
        }
        .sd-option:hover { background: #f8fafc; }
        .sd-option.sd-option-selected { background: #f1f5f9; font-weight: 700; }
        .sd-option.sd-option-any { color: #16a34a; font-weight: 700; }

        /* ── Page shell ── */
        .rm-page { display:flex; flex-direction:column; gap:1.25rem; font-family:inherit; }
        .rm-page-header { border-bottom:1px solid #f1f5f9; padding-bottom:1rem; }
        .rm-page-header h1 { font-size:1.5rem; font-weight:800; color:#0f172a; margin:0; }
        .rm-page-header p  { font-size:0.85rem; color:#64748b; margin:.2rem 0 0; }

        .rm-layout { display:grid; grid-template-columns:240px 1fr; gap:1.25rem; align-items:start; }
        @media(max-width:900px){ .rm-layout{ grid-template-columns:1fr; } }

        /* ── Left sidebar ── */
        .rm-sidebar {
          background:#fff; border:1px solid #e2e8f0; border-radius:1rem;
          padding:1.25rem; display:flex; flex-direction:column; gap:.875rem;
        }
        .rm-sidebar-top { display:flex; justify-content:space-between; align-items:center; }
        .rm-sidebar-top h2 { font-size:1.1rem; font-weight:800; color:#0f172a; margin:0; }
        .rm-new-btn {
          display:inline-flex; align-items:center; gap:.25rem;
          background:#16a34a; color:#fff; font-size:.75rem; font-weight:700;
          padding:.35rem .65rem; border-radius:.5rem; border:none; cursor:pointer;
        }
        .rm-new-btn:hover { background:#ea580c; }
        .rm-search { position:relative; }
        .rm-search svg { position:absolute; left:.6rem; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; }
        .rm-search input {
          width:100%; padding:.45rem .75rem .45rem 1.9rem;
          border:1px solid #e2e8f0; border-radius:.5rem;
          font-size:.8rem; background:#f8fafc; outline:none; box-sizing:border-box;
        }
        .rm-search input:focus { border-color:#16a34a; background:#fff; }
        .rm-role-list { display:flex; flex-direction:column; gap:.5rem; }
        .rm-role-card {
          border:1.5px solid #e2e8f0; border-radius:.75rem; padding:.85rem 1rem;
          cursor:pointer; display:flex; justify-content:space-between; align-items:center;
          transition:border-color .15s, background .15s;
        }
        .rm-role-card:hover { background:#fafafa; }
        .rm-role-info { flex:1; min-width:0; }
        .rm-role-name { font-size:.8rem; font-weight:800; color:#0f172a; text-transform:uppercase; }
        .rm-system-tag {
          display:inline-block; font-size:.6rem; font-weight:700;
          background:#fef3c7; color:#d97706; padding:.08rem .3rem;
          border-radius:.25rem; margin-left:.35rem; vertical-align:middle;
        }
        .rm-role-desc { font-size:.72rem; color:#64748b; margin:.2rem 0 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px; }
        .rm-role-count { font-size:.7rem; color:#64748b; margin-top:.3rem; }
        .rm-role-icon { width:1.8rem; height:1.8rem; border-radius:50%; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#64748b; flex-shrink:0; }
        .rm-role-card.active .rm-role-icon { background:#fed7aa; color:#16a34a; }

        /* ── Right panel ── */
        .rm-panel { background:#fff; border:1px solid #e2e8f0; border-radius:1rem; padding:1.5rem; display:flex; flex-direction:column; gap:1rem; }
        .rm-panel-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:.75rem; border-bottom:1px solid #f1f5f9; padding-bottom:1rem; }
        .rm-panel-meta { font-size:.68rem; font-weight:700; color:#16a34a; letter-spacing:.06em; text-transform:uppercase; }
        .rm-panel-title { font-size:1.25rem; font-weight:800; color:#0f172a; margin:.15rem 0 0; }
        .rm-panel-desc  { font-size:.78rem; color:#64748b; margin:.1rem 0 0; }
        .rm-save-btn { display:inline-flex; align-items:center; gap:.4rem; background:#0f172a; color:#fff; font-size:.82rem; font-weight:600; padding:.5rem 1rem; border-radius:.5rem; border:none; cursor:pointer; white-space:nowrap; }
        .rm-save-btn:hover:not(:disabled) { background:#1e293b; }
        .rm-save-btn:disabled { opacity:.55; cursor:not-allowed; }

        .rm-filters { display:flex; gap:.75rem; flex-wrap:wrap; align-items:center; }
        .rm-module-select { padding:.45rem 2rem .45rem .7rem; border:1px solid #e2e8f0; border-radius:.5rem; font-size:.82rem; background:#fff; outline:none; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right .6rem center; cursor:pointer; min-width:140px; }

        .rm-grant-row { display:flex; justify-content:flex-end; gap:.5rem; padding:.5rem 0; border-bottom:1px solid #f1f5f9; }
        .rm-grant-btn { font-size:.75rem; font-weight:700; padding:.3rem .75rem; border-radius:.4rem; border:none; cursor:pointer; }
        .rm-grant-btn.grant { background:#dcfce7; color:#15803d; }
        .rm-grant-btn.grant:hover { background:#bbf7d0; }
        .rm-grant-btn.revoke { background:#fee2e2; color:#dc2626; }
        .rm-grant-btn.revoke:hover { background:#fecaca; }

        .rm-table-scroll { overflow-x:auto; }
        .rm-table { width:100%; border-collapse:collapse; font-size:.82rem; }
        .rm-table th { text-align:left; font-weight:700; color:#334155; padding:.6rem .875rem; background:#f8fafc; border-bottom:2px solid #e2e8f0; white-space:nowrap; }
        .rm-table th:first-child { min-width:160px; }
        .rm-table th:not(:first-child) { text-align:center; min-width:100px; }
        .rm-table td { padding:.55rem .875rem; border-bottom:1px solid #f8fafc; vertical-align:middle; }
        .rm-table td:not(:first-child) { text-align:center; }
        .rm-table tr:hover td { background:#fafafa; }
        .rm-resource-name { font-weight:500; color:#1e293b; }

        .rm-spin { width:.8rem; height:.8rem; border-radius:50%; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; animation:rm-spin .6s linear infinite; display:inline-block; }
        @keyframes rm-spin { to { transform:rotate(360deg); } }
        .rm-empty { padding:2rem; text-align:center; color:#94a3b8; font-size:.85rem; }
      `}</style>

      {/* page header */}
      <div className="rm-page-header">
        <h1>Role Management</h1>
        <p>Manage company roles and their resource-level access permissions.</p>
      </div>

      <div className="rm-layout">
        {/* ── LEFT: role list ── */}
        <div className="rm-sidebar">
          <div className="rm-sidebar-top">
            <h2>Roles</h2>
            <button
              className="rm-new-btn"
              onClick={() => toast("Contact super admin to create new roles.")}
            >
              + New Role
            </button>
          </div>
          <div className="rm-search">
            <FiSearch size={13} />
            <input
              placeholder="Search roles..."
              value={roleSearch}
              onChange={(e) => setRoleSearch(e.target.value)}
            />
          </div>
          <div className="rm-role-list">
            {filteredRoles.map((r) => {
              const meta = ROLE_META[r.role] ?? ROLE_META["WORKFORCE_PLANNER"];
              const isAct = r.role === selected;
              return (
                <div
                  key={r.role}
                  className={`rm-role-card${isAct ? " active" : ""}`}
                  onClick={() => setSelected(r.role)}
                >
                  <div className="rm-role-info">
                    <div className="rm-role-name">
                      {r.role.replace(/_/g, " ")}
                      {meta.isSystem && (
                        <span className="rm-system-tag">SYSTEM</span>
                      )}
                    </div>
                    <div className="rm-role-desc">{meta.desc}</div>
                    <div className="rm-role-count">
                      🔑 {r.permissions.length} permissions
                    </div>
                  </div>
                  <div className="rm-role-icon">
                    {isAct ? <FiSliders size={13} /> : <FiUsers size={13} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: resource × CRUD grid ── */}
        {activeRole ? (
          <div className="rm-panel">
            <div className="rm-panel-header">
              <div>
                <div className="rm-panel-meta">ROLE PERMISSIONS</div>
                <div className="rm-panel-title">
                  {activeRole.role.replace(/_/g, " ")}
                </div>
                <div className="rm-panel-desc">
                  {
                    (
                      ROLE_META[activeRole.role] ??
                      ROLE_META["WORKFORCE_PLANNER"]
                    ).desc
                  }
                </div>
              </div>
              <button className="rm-save-btn" onClick={save} disabled={saving}>
                {saving ? <span className="rm-spin" /> : <FiSave size={14} />}
                Save Changes
              </button>
            </div>

            {/* filters */}
            <div className="rm-filters">
              <div className="rm-search" style={{ flex: 1, minWidth: 220 }}>
                <FiSearch size={13} />
                <input
                  placeholder="Search resources (name or code)..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                />
              </div>
              <select
                className="rm-module-select"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
              >
                {MODULES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* grant / revoke all */}
            <div className="rm-grant-row">
              <button
                className="rm-grant-btn grant"
                onClick={() => setAll("Any")}
              >
                Grant All
              </button>
              <button
                className="rm-grant-btn revoke"
                onClick={() => setAll("N/A")}
              >
                Revoke All
              </button>
            </div>

            {/* table */}
            <div className="rm-table-scroll">
              <table className="rm-table">
                <thead>
                  <tr>
                    <th>Resources</th>
                    <th>Read</th>
                    <th>Create</th>
                    <th>Update</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResources.length === 0 && (
                    <tr>
                      <td colSpan={5} className="rm-empty">
                        No resources match.
                      </td>
                    </tr>
                  )}
                  {visibleResources.map((res) => (
                    <tr key={res.label}>
                      <td className="rm-resource-name">{res.label}</td>
                      {ACTIONS.map((action) => (
                        <td key={action}>
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
          <div className="rm-panel rm-empty">
            Select a role to manage permissions.
          </div>
        )}
      </div>
    </div>
  );
}
