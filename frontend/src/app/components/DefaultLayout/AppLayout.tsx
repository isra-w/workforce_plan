/**
 * components/DefaultLayout/AppLayout.tsx
 *
 * The main application shell used by all authenticated pages.
 */
import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../Sidebars/Sidebar";
import Header from "../Header/Header";

export default function AppLayout() {
  // Start with sidebar open on desktop, closed on mobile
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024; // lg breakpoint
    }
    return true;
  });

  // Listen for sidebar toggle event from the collapse button
  useEffect(() => {
    const handleToggle = () => {
      setSidebarOpen(v => !v);
    };
    
    window.addEventListener('toggle-sidebar', handleToggle);
    return () => window.removeEventListener('toggle-sidebar', handleToggle);
  }, []);

  // No auto-close on resize - let user control sidebar state via hamburger/toggle
  // The CSS handles responsive behavior: overlay on mobile, persistent on desktop

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100" data-sidebar={sidebarOpen ? "open" : "closed"}>
      {/* Mobile overlay - only show on mobile when sidebar is open */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left navigation */}
      <Sidebar isOpen={sidebarOpen} />

      {/* Right column: sticky header + scrollable page content */}
      <div className="flex flex-col flex-1 min-w-0 w-full h-screen overflow-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden bg-slate-100">
          <div className="w-full max-w-[1920px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
