/**
 * components/Sidebars/Sidebar.tsx
 *
 * Collapsible left navigation sidebar rendered inside AppLayout.
 *
 * Structure:
 *   <aside>
 *     Brand header — shows "ADIU" when open, "A" when collapsed.
 *     <nav>        — list of NavLink items built from the navItems array.
 *     Footer       — "New Workforce Plan" button (planners only) + Settings + Support links.
 *
 * Props:
 *   isOpen  boolean — when true the sidebar is expanded (shows labels + full width).
 *                     When false it collapses to icon-only mode.
 *                     This state lives in AppLayout and is toggled by the Header.
 *
 * navItems constant:
 *   Defines every navigation destination: route path, display label, and icon.
 *   The `end` flag on the Dashboard item prevents it being marked active on every
 *   child route (React Router exact matching).
 *
 * Role-based filtering (visibleNavItems):
 *   CANDIDATE users can only see Dashboard and Candidates — all other nav items
 *   are filtered out. Every other role sees the full nav.
 *
 * NavLink active styling:
 *   React Router's NavLink passes isActive to the className callback. When true,
 *   the "active" class is added which highlights the item in green (globals.css).
 *   When the sidebar is collapsed, the item title is shown as a browser tooltip
 *   via the `title` attribute instead of the visible label.
 *
 * Footer:
 *   - "New Workforce Plan" button — only rendered for WORKFORCE_PLANNER role.
 *     Navigates to /workforce/plans/new. Hidden label when collapsed.
 *   - Settings NavLink — navigates to /settings.
 *   - Support link — placeholder anchor (href="#").
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
} from "react-icons/fi";
import { MdChair } from "react-icons/md";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  isOpen: boolean;
}

/**
 * navItems
 * Static list of all primary navigation destinations.
 * Each entry maps a route path to a label and icon component.
 * `end: true` on the dashboard ensures its active state doesn't bleed into child routes.
 */
const navItems = [
  { to: "/workforce",            label: "Dashboard",          icon: FiGrid,      end: true },
  { to: "/workforce/planning",   label: "Workforce Planning", icon: MdChair },
  { to: "/workforce/vacancies",  label: "Vacancies",          icon: FiBriefcase },
  { to: "/workforce/candidates", label: "Candidates",         icon: FiUsers },
  { to: "/workforce/interviews", label: "Interviews",         icon: FiCalendar },
  { to: "/workforce/offers",     label: "Offers",             icon: FiFileText },
  { to: "/workforce/analytics",  label: "Analytics",          icon: FiBarChart2 },
];

export default function Sidebar({ isOpen }: SidebarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  /**
   * Filter nav items by role.
   * CANDIDATE users only see Dashboard and Candidates to prevent them from
   * accessing plan creation or other internal-only sections.
   */
  const visibleNavItems = navItems.filter((item) => {
    if (user?.role === "CANDIDATE") {
      return item.to === "/workforce" || item.to === "/workforce/candidates";
    }
    return true;
  });

  return (
    // Class switches between open/closed to trigger CSS width transition
    <aside className={`sidebar_${isOpen ? "sidebar-open" : "sidebar-closed"}`}>

      {/* ── Brand / Logo ── */}
      <div className="sidebar-header">
        {/* Show abbreviated "A" when collapsed to fit the narrow icon strip */}
        <h1 className="sidebar-title">
          {isOpen ? "ADIU" : "A"}
        </h1>
      </div>

      {/* ── Primary navigation ── */}
      <nav className="sidebar-nav">
        {visibleNavItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              // "active" class turns the item green in globals.css
              `sidebar-nav-item ${isActive ? "active" : ""}`
            }
            // Show label as tooltip when sidebar is collapsed (icon-only mode)
            title={!isOpen ? label : undefined}
          >
            <Icon size={18} className="sidebar-nav-icon" />
            {/* Label is hidden when collapsed — CSS fades it out */}
            {isOpen && <span className="sidebar-nav-label">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer actions ── */}
      <div className="sidebar-footer">
        {/* "New Plan" shortcut — only shown for WORKFORCE_PLANNER role */}
        {user?.role === "WORKFORCE_PLANNER" && (
          <button
            onClick={() => navigate("/workforce/plans/new")}
            className="sidebar-new-plan-btn"
            title={!isOpen ? "New Workforce Plan" : undefined}
          >
            <FiPlus size={16} />
            {isOpen && <span>New Workforce Plan</span>}
          </button>
        )}

        {/* Settings link */}
        <NavLink
          to="/settings"
          className="sidebar-footer-link"
          title={!isOpen ? "Settings" : undefined}
        >
          <FiSettings size={16} />
          {isOpen && <span>Settings</span>}
        </NavLink>

        {/* Support placeholder link */}
        <a
          href="#"
          className="sidebar-footer-link"
          title={!isOpen ? "Support" : undefined}
        >
          <FiHelpCircle size={16} />
          {isOpen && <span>Support</span>}
        </a>
      </div>
    </aside>
  );
}
