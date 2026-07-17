/**
 * pages/Review/RoleManagementPage.tsx
 *
 * HRAdmin-only page for managing user permissions and role access.
 * Lists all users and lets HRAdmin grant or revoke the visible app permissions.
 * It is accessible from the sidebar as "Role Management".
 */
import { useEffect, useState } from "react";
import { authService } from "../../services/workforceService";
import {
  PermissionKey,
  allPermissionKeys,
  normalizePermissions,
} from "../../utils/permissions";
import { UserRole } from "../../../utils/types";
import {
  FiSave,
  FiSearch,
  FiChevronDown,
  FiChevronRight,
  FiUsers,
  FiSliders,
} from "react-icons/fi";
import toast from "react-hot-toast";

interface RolePermissionRow {
  role: UserRole;
  permissions: PermissionKey[];
}

// Map roles to descriptions and static visual properties to match mockup layout
const ROLE_METADATA: Record<string, { desc: string; isSystem: boolean }> = {
  HR_ADMIN: {
    desc: "Full HR operations and system configuration access",
    isSystem: true,
  },
  HRAdmin: {
    desc: "Full HR operations and system configuration access",
    isSystem: true,
  },
  CEO: {
    desc: "Final approver for workforce plans and high-priority posts",
    isSystem: true,
  },
  WORK_UNIT: {
    desc: "Operational unit user for workforce submissions",
    isSystem: true,
  },
  DEPARTMENT_MANAGER: {
    desc: "Initiates workforce planning and recruitment requests",
    isSystem: false,
  },
  DEFAULT: {
    desc: "Standard platform permissions and basic access",
    isSystem: false,
  },
};

export default function RoleManagementPage() {
  const [roles, setRoles] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<UserRole | null>(null);

  // UX State
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    authService
      .getRolePermissions()
      .then((res) => {
        const list = res.data.data.roles.map((roleRow: any) => ({
          role: roleRow.role as UserRole,
          permissions: normalizePermissions(roleRow.permissions, roleRow.role),
        }));
        setRoles(list);
        if (list.length > 0) {
          setSelectedRole(list[0].role);
        }
      })
      .catch((error) => {
        console.error(error);
        toast.error("Failed to load role permissions");
      })
      .finally(() => setLoading(false));
  }, []);

  const activeRoleData = roles.find((r) => r.role === selectedRole);

  const togglePermission = (role: UserRole, permission: PermissionKey) => {
    setRoles((prev) =>
      prev.map((roleRow) => {
        if (roleRow.role !== role) return roleRow;
        const has = roleRow.permissions.includes(permission);
        return {
          ...roleRow,
          permissions: has
            ? roleRow.permissions.filter((p) => p !== permission)
            : [...roleRow.permissions, permission],
        };
      }),
    );
  };

  const grantAllForModule = (role: UserRole, keys: PermissionKey[]) => {
    setRoles((prev) =>
      prev.map((roleRow) => {
        if (roleRow.role !== role) return roleRow;
        const merged = Array.from(new Set([...roleRow.permissions, ...keys]));
        return { ...roleRow, permissions: merged };
      }),
    );
  };

  const revokeAllForModule = (role: UserRole, keys: PermissionKey[]) => {
    setRoles((prev) =>
      prev.map((roleRow) => {
        if (roleRow.role !== role) return roleRow;
        return {
          ...roleRow,
          permissions: roleRow.permissions.filter((p) => !keys.includes(p)),
        };
      }),
    );
  };

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const savePermissions = async (roleRow: RolePermissionRow) => {
    setSavingRole(roleRow.role);
    try {
      await authService.updateRolePermissions(
        roleRow.role,
        roleRow.permissions,
      );
      toast.success("Role permissions updated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update role permissions");
    } finally {
      setSavingRole(null);
    }
  };

  // Helper to categorize PermissionKeys into groups/modules
  const getPermissionGroup = (key: string): string => {
    if (key.includes(":"))
      return key.split(":")[0].replace(/_/g, " ").toUpperCase();
    if (key.includes("_"))
      return key.split("_")[0].replace(/_/g, " ").toUpperCase();
    return "APPLICATION";
  };

  // Grouping, Filtering, and Sorting Permissions
  const groupedPermissions: Record<string, PermissionKey[]> = {};
  allPermissionKeys.forEach((key) => {
    const groupName = getPermissionGroup(key);
    if (!groupedPermissions[groupName]) {
      groupedPermissions[groupName] = [];
    }
    groupedPermissions[groupName].push(key);
  });

  const availableModules = Object.keys(groupedPermissions);

  return (
    <div className="role-management-workspace">
      {/* Scope specific styling context inside the container wrapper */}
      <style>{`
        .role-management-workspace {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          height: 100%;
          font-family: inherit;
        }
        .rm-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 1rem;
        }
        .rm-title-wrapper h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .rm-title-wrapper p {
          font-size: 0.85rem;
          color: #64748b;
          margin: 0.25rem 0 0 0;
        }
        .rm-split-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .rm-split-layout {
            grid-template-columns: 1fr;
          }
        }
        /* LEFT SIDEBAR ROLES LIST */
        .rm-roles-sidebar {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .rm-sidebar-heading-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .rm-sidebar-heading-row h2 {
          font-size: 1.7rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        .rm-new-role-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          background-color: #16a34a;
          color: white;
          font-size: 0.8rem;
          font-weight: 600;
          padding: 0.45rem 0.75rem;
          border-radius: 0.5rem;
          border: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .rm-new-role-btn:hover {
          background-color: #15803d;
        }
        .rm-editing-status-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.5rem;
        }
        .rm-status-text {
          font-size: 0.7rem;
          font-weight: 700;
          color: #16a34a;
          letter-spacing: 0.05em;
        }
        .rm-status-badge {
          font-size: 1rem;
          font-weight: 700;
          background: #eff6ff;
          color: #1d4ed8;
          padding: 0.15rem 0.4rem;
          border-radius: 0.25rem;
          text-transform: uppercase;
        }
        .rm-search-box {
          position: relative;
        }
        .rm-search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 0.9rem;
        }
        .rm-search-input {
          width: 100%;
          padding: 0.55rem 0.75rem 0.55rem 2.25rem;
          border-radius: 0.5rem;
          border: 1px solid #e2e8f0;
          background-color: #f8fafc;
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.15s, background-color 0.15s;
        }
        .rm-search-input:focus {
          border-color: #16a34a;
          background-color: #ffffff;
        }
        .rm-roles-list-cards {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .rm-role-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          padding: 1rem;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .rm-role-card:hover {
          border-color: #cbd5e1;
        }
        .rm-role-card.active {
          border: 2px solid #16a34a;
          background: #fcfdfd;
        }
        .rm-role-card-info {
          flex: 1;
          min-width: 0;
          padding-right: 0.5rem;
        }
        .rm-role-title-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }
        .rm-role-card-name {
          font-size: 0.825rem;
          font-weight: 700;
          color: #0f172a;
          text-transform: uppercase;
        }
        .rm-system-tag {
          font-size: 0.6rem;
          font-weight: 700;
          background: #fef3c7;
          color: #d97706;
          padding: 0.1rem 0.3rem;
          border-radius: 0.25rem;
          text-transform: uppercase;
        }
        .rm-role-card-desc {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .rm-role-perm-count {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.72rem;
          color: #64748b;
          margin-top: 0.4rem;
        }
        .rm-role-card-icon-wrapper {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          flex-shrink: 0;
        }
        .rm-role-card.active .rm-role-card-icon-wrapper {
          background: #dcfce7;
          color: #16a34a;
        }

        /* RIGHT MATRIX PANEL */
        .rm-matrix-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 1rem;
          padding: 1.5rem;
        }
        .rm-matrix-header-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 1.25rem;
        }
        .rm-matrix-meta-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: #16a34a;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .rm-matrix-role-badge {
          font-size: 0.65rem;
          font-weight: 700;
          background: #fef3c7;
          color: #d97706;
          padding: 0.1rem 0.4rem;
          border-radius: 0.25rem;
          text-transform: uppercase;
        }
        .rm-matrix-role-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0.25rem 0 0 0;
        }
        .rm-matrix-role-desc {
          font-size: 0.8rem;
          color: #64748b;
          margin: 0.25rem 0 0 0;
        }
        .rm-save-changes-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background-color: #0f172a;
          color: white;
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.55rem 1rem;
          border-radius: 0.5rem;
          border: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .rm-save-changes-btn:hover:not(:disabled) {
          background-color: #1e293b;
        }
        .rm-save-changes-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .rm-matrix-filters-row {
          display: flex;
          gap: 0.75rem;
          margin: 1rem 0 1.5rem 0;
          flex-wrap: wrap;
        }
        .rm-perm-search-box {
          flex: 1;
          position: relative;
          min-width: 240px;
        }
        .rm-module-select {
          padding: 0.55rem 2rem 0.55rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #e2e8f0;
          background-color: #ffffff;
          font-size: 0.85rem;
          color: #1e293b;
          outline: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.65rem center;
          cursor: pointer;
          min-width: 160px;
        }

        /* ACCORDION GROUPS */
        .rm-accordion-group {
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          margin-bottom: 1rem;
          overflow: hidden;
        }
        .rm-accordion-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.875rem 1.25rem;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          cursor: pointer;
          user-select: none;
        }
        .rm-accordion-header-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .rm-accordion-chevron {
          color: #64748b;
          display: flex;
          align-items: center;
        }
        .rm-accordion-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: 0.03em;
        }
        .rm-accordion-enabled-badge {
          font-size: 0.7rem;
          font-weight: 600;
          background: #dcfce7;
          color: #16a34a;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
        }
        .rm-accordion-enabled-badge.muted {
          background: #f1f5f9;
          color: #64748b;
        }
        .rm-accordion-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .rm-acc-action-btn {
          font-size: 0.78rem;
          font-weight: 600;
          padding: 0.3rem 0.65rem;
          border-radius: 0.35rem;
          border: none;
          cursor: pointer;
          transition: background 0.1s, color 0.1s;
        }
        .rm-acc-action-btn.grant {
          background: #f1f5f9;
          color: #334155;
        }
        .rm-acc-action-btn.grant:hover {
          background: #e2e8f0;
        }
        .rm-acc-action-btn.revoke {
          background: #fee2e2;
          color: #dc2626;
        }
        .rm-acc-action-btn.revoke:hover {
          background: #fecaca;
        }
        .rm-accordion-content {
          background: #ffffff;
        }
        
        /* INDIVIDUAL PERMISSION ROWS */
        .rm-perm-item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .rm-perm-item-row:last-child {
          border-bottom: none;
        }
        .rm-perm-item-left {
          flex: 1;
          min-width: 0;
          padding-right: 1rem;
        }
        .rm-perm-item-name {
          font-size: 0.85rem;
          font-weight: 700;
          color: #0f172a;
        }
        .rm-perm-item-desc {
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 0.15rem;
        }
        
        /* TOGGLE PILL BUTTON */
        .rm-toggle-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 80px;
          padding: 0.35rem 0.75rem;
          font-size: 0.72rem;
          font-weight: 700;
          border-radius: 9999px;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s;
          user-select: none;
          text-transform: uppercase;
        }
        .rm-toggle-pill.allowed {
          background-color: #16a34a;
          color: white;
          border-color: #16a34a;
        }
        .rm-toggle-pill.allowed:hover {
          background-color: #15803d;
        }
        .rm-toggle-pill.denied {
          background-color: #f1f5f9;
          color: #64748b;
          border-color: #cbd5e1;
        }
        .rm-toggle-pill.denied:hover {
          background-color: #e2e8f0;
          color: #334155;
        }
        .rm-spinner {
          width: 0.9rem;
          height: 0.9rem;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Main Header */}
      <div className="rm-header">
        <div className="rm-title-wrapper">
          <h1>Role Management</h1>
          <p>
            Manage company roles and their access permissions. System roles
            cannot be deleted.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="loader-icon" />
        </div>
      ) : (
        <div className="rm-split-layout">
          {/* LEFT SIDEBAR: ROLES SELECTOR */}
          <div className="rm-roles-sidebar">
            <div className="rm-sidebar-heading-row">
              <h2>Roles</h2>
              <button
                className="rm-new-role-btn"
                onClick={() => toast.success("Creation workflow loaded")}
              >
                <span>+</span> New Role
              </button>
            </div>

            <div className="rm-editing-status-label">
              <span className="rm-status-text">CURRENTLY EDITING</span>
              {selectedRole && (
                <span className="rm-status-badge">
                  {selectedRole.replace(/_/g, " ")}
                </span>
              )}
            </div>

            {/* Role Search */}
            <div className="rm-search-box">
              <FiSearch className="rm-search-icon" />
              <input
                type="text"
                placeholder="Search roles..."
                className="rm-search-input"
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
              />
            </div>

            {/* Role Cards List */}
            <div className="rm-roles-list-cards">
              {roles
                .filter((roleRow) =>
                  roleRow.role.toLowerCase().includes(roleSearch.toLowerCase()),
                )
                .map((roleRow) => {
                  const meta =
                    ROLE_METADATA[roleRow.role] || ROLE_METADATA.DEFAULT;
                  const isActive = roleRow.role === selectedRole;
                  const displayLabel = roleRow.role.replace(/_/g, " ");

                  return (
                    <div
                      key={roleRow.role}
                      className={`rm-role-card ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedRole(roleRow.role)}
                    >
                      <div className="rm-role-card-info">
                        <div className="rm-role-title-row">
                          <span className="rm-role-card-name">
                            {displayLabel}
                          </span>
                          {meta.isSystem && (
                            <span className="rm-system-tag">SYSTEM</span>
                          )}
                        </div>
                        <div className="rm-role-card-desc">{meta.desc}</div>
                        <div className="rm-role-perm-count">
                          <span>🔑</span> {roleRow.permissions.length}{" "}
                          permissions
                        </div>
                      </div>
                      <div className="rm-role-card-icon-wrapper">
                        {isActive ? (
                          <FiSliders size={14} />
                        ) : (
                          <FiUsers size={14} />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* RIGHT PANEL: ROLE PERMISSIONS MATRIX */}
          {activeRoleData && (
            <div className="rm-matrix-panel">
              {/* Header inside Matrix Panel */}
              <div className="rm-matrix-header-row">
                <div>
                  <div className="rm-matrix-meta-label">
                    <span>ROLE MANAGEMENT MATRIX</span>
                    {(
                      ROLE_METADATA[activeRoleData.role] ||
                      ROLE_METADATA.DEFAULT
                    ).isSystem && (
                      <span className="rm-matrix-role-badge">SYSTEM ROLE</span>
                    )}
                  </div>
                  <h2 className="rm-matrix-role-title">
                    {activeRoleData.role.replace(/_/g, " ")}
                  </h2>
                  <p className="rm-matrix-role-desc">
                    {
                      (
                        ROLE_METADATA[activeRoleData.role] ||
                        ROLE_METADATA.DEFAULT
                      ).desc
                    }
                  </p>
                </div>

                <button
                  className="rm-save-changes-btn"
                  disabled={savingRole === activeRoleData.role}
                  onClick={() => savePermissions(activeRoleData)}
                >
                  {savingRole === activeRoleData.role ? (
                    <div className="rm-spinner" />
                  ) : (
                    <FiSave size={15} />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>

              {/* Filtering Controls */}
              <div className="rm-matrix-filters-row">
                <div className="rm-perm-search-box">
                  <FiSearch className="rm-search-icon" />
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    className="rm-search-input"
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                  />
                </div>

                <select
                  className="rm-module-select"
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                >
                  <option value="all">All Modules</option>
                  {availableModules.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
              </div>

              {/* Permissions Accordions */}
              {availableModules
                .filter((mod) => moduleFilter === "all" || moduleFilter === mod)
                .map((groupName) => {
                  const allGroupKeys = groupedPermissions[groupName];

                  // Filter individual group items by search string
                  const filteredKeys = allGroupKeys.filter((key) =>
                    key.toLowerCase().includes(permissionSearch.toLowerCase()),
                  );

                  if (filteredKeys.length === 0) return null;

                  const isCollapsed = !!collapsedGroups[groupName];
                  const activeCount = filteredKeys.filter((key) =>
                    activeRoleData.permissions.includes(key),
                  ).length;

                  return (
                    <div className="rm-accordion-group" key={groupName}>
                      {/* Accordion Trigger */}
                      <div className="rm-accordion-header">
                        <div
                          className="rm-accordion-header-left"
                          onClick={() => toggleGroupCollapse(groupName)}
                        >
                          <span className="rm-accordion-chevron">
                            {isCollapsed ? (
                              <FiChevronRight size={16} />
                            ) : (
                              <FiChevronDown size={16} />
                            )}
                          </span>
                          <span className="rm-accordion-title">
                            {groupName}
                          </span>
                          <span
                            className={`rm-accordion-enabled-badge ${activeCount === 0 ? "muted" : ""}`}
                          >
                            {activeCount} / {filteredKeys.length} Enabled
                          </span>
                        </div>

                        <div className="rm-accordion-actions">
                          <button
                            type="button"
                            className="rm-acc-action-btn grant"
                            onClick={() =>
                              grantAllForModule(
                                activeRoleData.role,
                                filteredKeys,
                              )
                            }
                          >
                            Grant All
                          </button>
                          <button
                            type="button"
                            className="rm-acc-action-btn revoke"
                            onClick={() =>
                              revokeAllForModule(
                                activeRoleData.role,
                                filteredKeys,
                              )
                            }
                          >
                            Revoke All
                          </button>
                        </div>
                      </div>

                      {/* Expandable permission row list */}
                      {!isCollapsed && (
                        <div className="rm-accordion-content">
                          {filteredKeys.map((permissionKey) => {
                            const isAllowed =
                              activeRoleData.permissions.includes(
                                permissionKey,
                              );

                            // Humanize labels e.g. "Application:Read" or "PLAN_CREATE" -> "Read Applications"
                            const prettyName = permissionKey.includes(":")
                              ? permissionKey.split(":")[1]
                              : permissionKey.replace(/_/g, " ");

                            return (
                              <div
                                className="rm-perm-item-row"
                                key={permissionKey}
                              >
                                <div className="rm-perm-item-left">
                                  <div className="rm-perm-item-name">
                                    {permissionKey}
                                  </div>
                                  <div className="rm-perm-item-desc">
                                    Enables action access for{" "}
                                    {prettyName.toLowerCase()}.
                                  </div>
                                </div>

                                <div
                                  className={`rm-toggle-pill ${isAllowed ? "allowed" : "denied"}`}
                                  onClick={() =>
                                    togglePermission(
                                      activeRoleData.role,
                                      permissionKey,
                                    )
                                  }
                                >
                                  {isAllowed ? "Allowed" : "Denied"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
