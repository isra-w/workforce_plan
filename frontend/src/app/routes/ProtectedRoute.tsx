/**
 * routes/ProtectedRoute.tsx
 *
 * A route guard component that sits between the router and any page that
 * requires an authenticated, verified user.
 *
 * How it works:
 *   1. Reads { user, loading } from AuthContext.
 *
 *   2. While loading is true (AuthProvider is validating the stored JWT
 *      against the backend on first render) it shows a full-page spinner
 *      so the user doesn't see a flash-redirect to /login.
 *
 *   3. If no user is present (not logged in) it redirects to /login.
 *      The `replace` flag overwrites the history entry so the back-button
 *      doesn't send the user back to the protected route.
 *
 *   4. If the user exists but has not yet verified their email it redirects
 *      to /verify-email and passes their email in router state so the
 *      verify page can display it and offer a resend option.
 *
 *   5. If all checks pass it renders <Outlet /> — the matched child route
 *      (e.g. WorkforceDashboard, PlanningListPage, etc.) inside AppLayout.
 *
 * Usage (in App.tsx):
 *   <Route element={<ProtectedRoute />}>
 *     <Route element={<AppLayout />}>
 *       <Route path="/workforce" element={<WorkforceDashboard />} />
 *       ...
 *     </Route>
 *   </Route>
 */
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  // Still validating the stored token — show a spinner to avoid a flash redirect
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-green-600" />
      </div>
    );
  }

  // No valid session — send to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Valid session but email not yet confirmed — send to verify page
  if (!user.is_verified) {
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />;
  }

  // All checks passed — render the protected child route
  return <Outlet />;
}
