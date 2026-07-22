/**
 * components/Header/Header.tsx
 *
 * Sticky top bar rendered inside AppLayout above every authenticated page.
 */
import {
  FiBell,
  FiHelpCircle,
  FiSettings,
  FiSearch,
  FiMenu,
  FiX,
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export default function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="min-h-[3.75rem] bg-white border-b border-slate-200 flex flex-wrap items-center justify-between px-6 py-3 sticky top-0 z-20 gap-3">
      {/* ── Sidebar toggle ── */}
      <button
        className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-lg border-none bg-transparent text-slate-500 cursor-pointer transition-all hover:bg-slate-100 hover:text-slate-800"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>

      {/* ── Search bar ── */}
      <div className="flex items-center flex-1 max-w-[22rem]">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          <input
            type="text"
            placeholder="Search planning data..."
            className="w-full py-2 pl-9 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none transition-all focus:border-green-600 focus:bg-white"
          />
        </div>
      </div>

      {/* ── Right-side action icons + profile ── */}
      <div className="flex items-center gap-2">
        {/* Notification bell with a red dot indicator */}
        <button className="bg-transparent border-none cursor-pointer text-slate-500 transition-all relative p-2 flex items-center justify-center rounded-lg hover:bg-slate-100 hover:text-slate-800" aria-label="Notifications">
          <FiBell size={20} />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full border-2 border-white" />
        </button>

        {/* Help and settings shortcut buttons */}
        <button className="bg-transparent border-none cursor-pointer text-slate-500 transition-all p-2 flex items-center justify-center rounded-lg hover:bg-slate-100 hover:text-slate-800" aria-label="Help">
          <FiHelpCircle size={20} />
        </button>
        <button className="bg-transparent border-none cursor-pointer text-slate-500 transition-all p-2 flex items-center justify-center rounded-lg hover:bg-slate-100 hover:text-slate-800" aria-label="Settings">
          <FiSettings size={20} />
        </button>

        {/* ── User profile block ── */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 ml-1">
          {/* Name and role/title text — hidden on mobile via CSS */}
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800 m-0 leading-tight">{user?.full_name || "User"}</p>
            <p className="text-[0.7rem] text-slate-400 m-0 uppercase tracking-wider font-medium">{user?.title || user?.role}</p>
          </div>

          {/* Avatar circle — shows the first letter of the user's name */}
          <div className="h-[2.1rem] w-[2.1rem] rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          {/* Logout clears the session and redirects to /login via AuthContext */}
          <button onClick={logout} className="rounded-lg border border-slate-200 py-1.5 px-3 text-xs font-semibold text-slate-500 bg-white cursor-pointer transition-all hover:bg-red-50 hover:border-red-300 hover:text-red-600">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

