/**
 * components/DefaultLayout/AppLayout.tsx
 *
 * The main application shell used by all authenticated pages.
 * It composes the Sidebar, Header, and a scrollable content area, and uses
 * React Router's <Outlet> to render the currently matched child route.
 *
 * Layout structure:
 *   <div.app-layout>          — full-viewport flex row (sidebar + main)
 *     <Sidebar isOpen />      — collapsible left navigation panel
 *     <div.app-main>          — flex column that fills remaining width
 *       <Header />            — sticky top bar with search, actions, profile
 *       <main.app-content>    — scrollable page content area
 *         <Outlet />          — child route content (e.g. WorkforceDashboard)
 *
 * State:
 *   sidebarOpen  boolean — tracks whether the sidebar is expanded (true) or
 *                collapsed to icon-only mode (false). Defaults to open.
 *                Toggled by the hamburger button in the Header and reflected on
 *                the layout wrapper via data-sidebar="open|closed" so CSS
 *                transitions can animate the sidebar width.
 *
 * How the toggle works:
 *   AppLayout owns the sidebarOpen state and passes:
 *     - isOpen prop → Sidebar, which uses it to conditionally render labels
 *       and adjust its own CSS class.
 *     - onToggleSidebar callback → Header, which triggers it when the
 *       hamburger/X icon is clicked.
 */
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebars/Sidebar";
import Header from "../Header/Header";

export default function AppLayout() {
  // Controls whether the sidebar is expanded or collapsed
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="app-layout" data-sidebar={sidebarOpen ? "open" : "closed"}>
      {/* Left navigation — collapses to icon-only when sidebarOpen is false */}
      <Sidebar isOpen={sidebarOpen} />

      {/* Right column: sticky header + scrollable page content */}
      <div className="app-main">
        <Header
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
        {/* Scrollable content area — child routes are rendered here by <Outlet> */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
