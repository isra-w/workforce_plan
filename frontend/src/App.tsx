/**
 * App.tsx
 *
 *   1. Routing      — BrowserRouter wraps the whole tree so any component can
 *                     use React Router hooks (useNavigate, useParams, etc.).
 *
 *   2. Auth state   — AuthProvider reads the JWT + user from localStorage on
 *                     mount, exposes login/logout/register helpers via context ,
 *                     and keeps the user object in sync with the backend.
 *
 *   3. Notifications — <Toaster> (react-hot-toast) renders a portal-based
 *                     toast container anchored to the top-right corner. Any
 *                     component can call toast() to show a notification.
 *
 * RoleAwareRoutes (inner component)
 *   Must live *inside* AuthProvider so it can call useAuth() to read the
 *   current user's role. It conditionally registers plan-creation routes so
 *   CANDIDATE users never see them.
 *
 *   Route groups:
 *     Public  — /login, /signup, /verify-email
 *                 These are accessible without a token.
 *
 *     Protected (wrapped in <ProtectedRoute> which redirects to /login if no
 *     valid session exists, or to /verify-email if the email is unverified):
 *       /workforce            → WorkforceDashboard  (KPIs + plan table)
 *       /workforce/planning   → PlanningListPage    (all plans as a table)
 *       /workforce/plans/new  → CreatePlanPage      (non-candidates only)
 *       /workforce/plans/:id  → CreatePlanPage      (view/edit existing plan)
 *
 *     All protected routes share the <AppLayout> shell (sidebar + header).
 *
 *     Fallback — "/" and any unknown path redirect to /workforce.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./app/context/AuthContext";
import ProtectedRoute from "./app/routes/ProtectedRoute";
import AppLayout from "./app/components/DefaultLayout/AppLayout";
import LoginForm from "./app/components/auth/LoginForm";
import SignupForm from "./app/components/auth/SignupForm";
import VerifyEmailPage from "./app/pages/Auth/VerifyEmailPage";
import WorkforceDashboard from "./app/pages/Workforce/WorkforceDashboard";
import PlanningListPage from "./app/pages/Workforce/PlanningListPage";
import CreatePlanPage from "./app/pages/Workforce/CreatePlanPage";

/**
 * PlaceholderPage
 *
 * Simple stand-in component rendered for routes that are linked in the
 * sidebar but not yet implemented. Shows the section title and "Coming soon".
 */
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-card">
        <h2 className="placeholder-title">{title}</h2>
        <p className="placeholder-copy">Coming soon</p>
      </div>
    </div>
  );
}

/**
 * RoleAwareRoutes
 *
 * Reads the authenticated user's role from AuthContext and uses it to decide
 * which routes to register. CANDIDATE users must not be able to navigate to
 * plan creation/editing pages, so those <Route> elements are simply not
 * rendered for them — React Router will fall through to the catch-all redirect.
 *
 * This component is intentionally kept separate from App so it can call
 * useAuth() (which requires being inside AuthProvider).
 */
function RoleAwareRoutes() {
  const { user } = useAuth();

  // CANDIDATE users only see the dashboard and candidates page
  const isCandidate = user?.role === "CANDIDATE";

  return (
    <Routes>
      {/* ── Public routes — no auth required ── */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/signup" element={<SignupForm />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* ── Protected routes — requires valid, verified JWT ── */}
      <Route element={<ProtectedRoute />}>
        {/* AppLayout provides the sidebar + header shell for all inner pages */}
        <Route element={<AppLayout />}>
          <Route path="/workforce" element={<WorkforceDashboard />} />
          <Route path="/workforce/planning" element={<PlanningListPage />} />

          {/* Only planners / HR / CEO can create or edit plans */}
          {!isCandidate && <Route path="/workforce/plans/new" element={<CreatePlanPage />} />}
          {!isCandidate && <Route path="/workforce/plans/:id" element={<CreatePlanPage />} />}

          {/* Placeholder pages for future sections */}
          <Route path="/workforce/vacancies" element={<PlaceholderPage title="Vacancies" />} />
          <Route path="/workforce/candidates" element={<PlaceholderPage title="Candidates" />} />
          <Route path="/workforce/interviews" element={<PlaceholderPage title="Interviews" />} />
          <Route path="/workforce/offers" element={<PlaceholderPage title="Offers" />} />
          <Route path="/workforce/analytics" element={<PlaceholderPage title="Analytics" />} />
          <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
        </Route>
      </Route>

      {/* ── Fallback redirects ── */}
      <Route path="/" element={<Navigate to="/workforce" replace />} />
      <Route path="*" element={<Navigate to="/workforce" replace />} />
    </Routes>
  );
}

/**
 * App
 *
 * Top-level component exported and mounted by main.tsx.
 * Renders the provider stack (BrowserRouter → AuthProvider → Toaster)
 * then delegates all routing to RoleAwareRoutes.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <RoleAwareRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
