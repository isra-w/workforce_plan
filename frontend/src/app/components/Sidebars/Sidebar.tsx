/**
 * components/Sidebars/Sidebar.tsx
 *
 * Collapsible left navigation sidebar. Navigation items are role-scoped.
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
    <>
      <aside
        className={`
          flex flex-col bg-white border-r border-slate-100 h-full
          transition-all duration-300 ease-in-out
          fixed lg:relative top-0 left-0 z-30
          ${isOpen 
            ? "w-60 translate-x-0" 
            : "w-60 -translate-x-full lg:w-20 lg:translate-x-0"
          }
        `}
      >
        {/* Brand */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-center min-h-[3.75rem]">
          <h1 className={`font-extrabold text-green-600 tracking-tight transition-all ${isOpen ? "text-4xl" : "text-4xl lg:text-2xl"}`}>
            {isOpen ? "ADIU" : "A"}
          </h1>
        </div>

        {/* Primary navigation */}
        <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors no-underline
                ${isActive
                  ? "bg-green-50 text-green-600 font-semibold"
                  : "text-slate-800 hover:bg-slate-50"
                }
                ${isOpen ? "px-3 py-2.5" : "px-3 py-2.5 lg:px-2 lg:justify-center"}
                `
              }
              title={!isOpen ? label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className={`${isOpen ? "block" : "block lg:hidden"}`}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-slate-100 flex flex-col gap-1">
          {user &&
            hasPermission(
              user.permissions,
              "MANAGE_WORKFORCE_PLANS",
              user.role,
            ) && (
              <button
                onClick={() => navigate("/workforce/plans/new")}
                className={`w-full flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2.5 text-sm font-semibold border-none cursor-pointer transition-colors
                  ${isOpen ? "px-3 justify-center" : "px-3 justify-center lg:px-2"}
                `}
                title={!isOpen ? "New Workforce Plan" : undefined}
              >
                <FiPlus size={16} />
                <span className={`${isOpen ? "block" : "block lg:hidden"}`}>New Workforce Plan</span>
              </button>
            )}

          <NavLink
            to="/settings"
            className={`flex items-center gap-2.5 rounded-lg text-sm text-slate-800 no-underline hover:bg-slate-50 transition-colors
              ${isOpen ? "px-3 py-2" : "px-3 py-2 lg:px-2 lg:justify-center"}
            `}
            title={!isOpen ? "Settings" : undefined}
          >
            <FiSettings size={16} />
            <span className={`${isOpen ? "block" : "block lg:hidden"}`}>Settings</span>
          </NavLink>
        </div>
      </aside>

      {/* Collapse/Expand toggle button - desktop only, positioned on the sidebar edge */}
      <button
        onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}
        className="hidden lg:flex fixed top-20 z-40 w-6 h-6 items-center justify-center bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition-all"
        style={{
          left: isOpen ? '224px' : '64px',
          transition: 'left 0.3s ease-in-out'
        }}
        title={isOpen ? "Minimize sidebar" : "Expand sidebar"}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-slate-600 transition-transform ${isOpen ? "" : "rotate-180"}`}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </>
  );
}
