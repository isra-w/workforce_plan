/**
 * components/Sidebars/Sidebar.tsx
 *
 * Collapsible left navigation sidebar. Navigation items are role-scoped:
 *
 *   WORKFORCE_PLANNER
 *     Dashboard · Workforce Planning · Vacancies · Candidates
 *     Interviews · Offers · Analytics
 *     Footer: "New Workforce Plan" button
 *
 *   HR
 *     Dashboard · HR Review Queue
 *     (no plan-creation controls)
 *
 *   CEO
 *     Dashboard · Job Postings (CEO Approval)
 *     (no plan-creation controls)
 *
 *   CANDIDATE
 *     Dashboard · Candidates only
 *
 * Props:
 *   isOpen  boolean — expanded (labels + full width) vs collapsed (icons only).
 */
import { NavLink, useNavigate } from "react-router-dom";
import {
  FiGrid,
  FiUsers,
  FiBriefcase,
  FiCalendar,
  FiFileText,
  FiBarChart2,
  FiSettings,
  FiHelpCircle,
  FiPlus,
  FiCheckSquare,
  FiAward,
} from "react-icons/fi";
import { MdChair } from "react-icons/md";
import { IconType } from "react-icons";
import { useAuth } from "../../context/AuthContext";
import { hasPermission, PermissionKey } from "../../utils/permissions";

interface SidebarProps {
  isOpen: boolean;
}

interface NavItem {
  to: string;
  label: string;
  icon: IconType;
  end: boolean;
  permission: PermissionKey;
}

// All possible nav items — visibility is controlled by role below
const allNavItems: NavItem[] = [
  {
    to: "/workforce",
    label: "Dashboard",
    icon: FiGrid,
    end: true,
    permission: "VIEW_DASHBOARD",
  },
  {
    to: "/workforce/planning",
    label: "Workforce Planning",
    icon: MdChair,
    end: false,
    permission: "MANAGE_WORKFORCE_PLANS",
  },
  {
    to: "/workforce/vacancies",
    label: "Vacancies",
    icon: FiBriefcase,
    end: false,
    permission: "VIEW_VACANCIES",
  },
  {
    to: "/workforce/candidates",
    label: "Candidates",
    icon: FiUsers,
    end: false,
    permission: "VIEW_CANDIDATES",
  },
  {
    to: "/workforce/interviews",
    label: "Interviews",
    icon: FiCalendar,
    end: false,
    permission: "VIEW_INTERVIEWS",
  },
  {
    to: "/workforce/offers",
    label: "Offers",
    icon: FiFileText,
    end: false,
    permission: "VIEW_OFFERS",
  },
  {
    to: "/workforce/analytics",
    label: "Analytics",
    icon: FiBarChart2,
    end: false,
    permission: "VIEW_ANALYTICS",
  },
  {
    to: "/review/hr",
    label: "HR Review Queue",
    icon: FiCheckSquare,
    end: false,
    permission: "VIEW_HR_REVIEW",
  },
  {
    to: "/review/ceo",
    label: "Job Postings — Approval",
    icon: FiAward,
    end: false,
    permission: "VIEW_CEO_REVIEW",
  },
  {
    to: "/settings/roles",
    label: "Role Management",
    icon: FiUsers,
    end: false,
    permission: "MANAGE_ROLES",
  },
];

export default function Sidebar({ isOpen }: SidebarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const navItems = allNavItems.filter((item) =>
    user ? hasPermission(user.permissions, item.permission, user.role) : false,
  );

  return (
    <aside className={`sidebar ${isOpen ? "" : "sidebar-closed"}`}>
      {/* ── Brand ── */}
      <div className="sidebar-header">
        <h1 className="sidebar-title">{isOpen ? "ADIU" : "A"}</h1>
      </div>

      {/* ── Primary navigation ── */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
            title={!isOpen ? label : undefined}
          >
            <Icon size={18} className="sidebar-nav-icon" />
            {isOpen && <span className="sidebar-nav-label">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        {/* "New Plan" shortcut — only if the user has plan management permission */}
        {user &&
          hasPermission(
            user.permissions,
            "MANAGE_WORKFORCE_PLANS",
            user.role,
          ) && (
            <button
              onClick={() => navigate("/workforce/plans/new")}
              className="sidebar-new-plan-btn"
              title={!isOpen ? "New Workforce Plan" : undefined}
            >
              <FiPlus size={16} />
              {isOpen && <span>New Workforce Plan</span>}
            </button>
          )}

        <NavLink
          to="/settings"
          className="sidebar-footer-link"
          title={!isOpen ? "Settings" : undefined}
        >
          <FiSettings size={16} />
          {isOpen && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}
