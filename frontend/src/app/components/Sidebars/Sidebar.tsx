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
  FiGrid, FiUsers, FiBriefcase, FiCalendar,
  FiFileText, FiBarChart2, FiSettings, FiHelpCircle,
  FiPlus, FiCheckSquare, FiAward,
} from "react-icons/fi";
import { MdChair } from "react-icons/md";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  isOpen: boolean;
}

// All possible nav items — visibility is controlled by role below
const plannerNav = [
  { to: "/workforce",            label: "Dashboard",          icon: FiGrid,      end: true  },
  { to: "/workforce/planning",   label: "Workforce Planning", icon: MdChair,     end: false },
  { to: "/workforce/vacancies",  label: "Vacancies",          icon: FiBriefcase, end: false },
  { to: "/workforce/candidates", label: "Candidates",         icon: FiUsers,     end: false },
  { to: "/workforce/interviews", label: "Interviews",         icon: FiCalendar,  end: false },
  { to: "/workforce/offers",     label: "Offers",             icon: FiFileText,  end: false },
  { to: "/workforce/analytics",  label: "Analytics",          icon: FiBarChart2, end: false },
];

const hrNav = [
  { to: "/workforce",  label: "Dashboard",       icon: FiGrid,        end: true  },
  { to: "/review/hr",  label: "HR Review Queue", icon: FiCheckSquare, end: false },
];

const ceoNav = [
  { to: "/workforce",  label: "Dashboard",              icon: FiGrid,   end: true  },
  { to: "/review/ceo", label: "Job Postings — Approval", icon: FiAward, end: false },
];

const candidateNav = [
  { to: "/workforce",            label: "Dashboard",  icon: FiGrid,  end: true  },
  { to: "/workforce/candidates", label: "Candidates", icon: FiUsers, end: false },
];

export default function Sidebar({ isOpen }: SidebarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Pick the nav set for this role
  const navItems =
    user?.role === "HR"        ? hrNav
    : user?.role === "CEO"     ? ceoNav
    : user?.role === "CANDIDATE" ? candidateNav
    : plannerNav;

  return (
    <aside className={`sidebar_${isOpen ? "sidebar-open" : "sidebar-closed"}`}>

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
            className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
            title={!isOpen ? label : undefined}
          >
            <Icon size={18} className="sidebar-nav-icon" />
            {isOpen && <span className="sidebar-nav-label">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        {/* "New Plan" shortcut — WORKFORCE_PLANNER only */}
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

        <NavLink
          to="/settings"
          className="sidebar-footer-link"
          title={!isOpen ? "Settings" : undefined}
        >
          <FiSettings size={16} />
          {isOpen && <span>Settings</span>}
        </NavLink>

        <a href="#" className="sidebar-footer-link" title={!isOpen ? "Support" : undefined}>
          <FiHelpCircle size={16} />
          {isOpen && <span>Support</span>}
        </a>
      </div>
    </aside>
  );
}
