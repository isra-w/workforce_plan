/**
 * components/Header/Header.tsx
 *
 * Sticky top bar rendered inside AppLayout above every authenticated page.
 *
 * Layout (left → right):
 *   1. Sidebar toggle button — shows FiMenu when sidebar is closed, FiX when
 *      open. Clicking it calls onToggleSidebar() which flips sidebarOpen in
 *      AppLayout. aria-label and title update accordingly for accessibility.
 *
 *   2. Search bar — a text input with a magnifying-glass icon. Currently a
 *      UI placeholder; search logic is not yet wired to any data source.
 *
 *   3. Action icons — three icon buttons on the right:
 *        Bell (FiBell)       — notifications; has a red dot badge.
 *        Help (FiHelpCircle) — help/documentation link.
 *        Settings (FiSettings) — settings shortcut.
 *
 *   4. Profile section — shows the authenticated user's name and role/title,
 *      an avatar circle with their initial, and a Logout button.
 *      - user comes from AuthContext via useAuth().
 *      - The avatar displays the first character of full_name, capitalised.
 *      - The role line shows user.title if set, otherwise falls back to role.
 *      - Clicking Logout calls logout() from AuthContext, which clears
 *        localStorage and resets the user state, triggering a redirect to /login.
 *
 * Props:
 *   onToggleSidebar  () => void  — callback fired when the toggle button is clicked.
 *   sidebarOpen      boolean     — current sidebar state; used to choose the icon
 *                                  and aria-label on the toggle button.
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
    <header className="header">
      {/* ── Sidebar toggle ── */}
      <button
        className="header-sidebar-toggle"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {/* Show X when open so the user knows clicking will close it */}
        {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>

      {/* ── Search bar ── */}
      <div className="header-search">
        <div className="header-search-wrapper">
          <FiSearch className="header-search-icon" size={16} />
          <input
            type="text"
            placeholder="Search planning data..."
            className="header-search-input"
          />
        </div>
      </div>

      {/* ── Right-side action icons + profile ── */}
      <div className="header-actions">
        {/* Notification bell with a red dot indicator */}
        <button className="header-icon-btn" aria-label="Notifications">
          <FiBell size={20} />
          <span className="header-notification-badge" />
        </button>

        {/* Help and settings shortcut buttons */}
        <button className="header-icon-btn" aria-label="Help">
          <FiHelpCircle size={20} />
        </button>
        <button className="header-icon-btn" aria-label="Settings">
          <FiSettings size={20} />
        </button>

        {/* ── User profile block ── */}
        <div className="header-profile">
          {/* Name and role/title text — hidden on mobile via CSS */}
          <div className="header-profile-info">
            <p className="header-profile-name">{user?.full_name || "User"}</p>
            {/* Show custom title if set, fall back to the role enum value */}
            <p className="header-profile-role">{user?.title || user?.role}</p>
          </div>

          {/* Avatar circle — shows the first letter of the user's name */}
          <div className="header-profile-avatar">
            {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          {/* Logout clears the session and redirects to /login via AuthContext */}
          <button onClick={logout} className="header-logout-btn">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
