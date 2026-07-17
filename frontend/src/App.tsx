/**
 * App.tsx
 *
 * Root component. Wires together:
 *   BrowserRouter → AuthProvider → Toaster → AppRouter
 *
 * Route map by role:
 *
 *   Public (no auth):
 *     /login  /signup  /verify-email
 *
 *   WORKFORCE_PLANNER (protected + verified):
 *     /workforce            → WorkforceDashboard
 *     /workforce/planning   → PlanningListPage
 *     /workforce/plans/new  → CreatePlanPage
 *     /workforce/plans/:id  → CreatePlanPage
 *     /workforce/vacancies  → VacanciesPage
 *     /workforce/candidates → PlaceholderPage
 *     /workforce/interviews → PlaceholderPage
 *     /workforce/offers     → PlaceholderPage
 *     /workforce/analytics  → PlaceholderPage
 *
 *   HR (protected + verified):
 *     /workforce            → WorkforceDashboard
 *     /review/hr            → HRReviewPage  (SUBMITTED plans)
 *
 *   CEO (protected + verified):
 *     /workforce            → WorkforceDashboard
 *     /review/ceo           → CEOReviewPage (HR_APPROVED plans)
 *     /review/ceo/:id       → JobPostingDetailPage
 *
 *   CANDIDATE (protected + verified):
 *     /workforce            → WorkforceDashboard
 *     /workforce/candidates → PlaceholderPage
 *
 *   All roles:
 *     /settings             → PlaceholderPage
 *     unknown path          → redirect /workforce
 */
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
} from "react-router-dom";
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
import HRReviewPage from "./app/pages/Review/HRReviewPage";
import CEOReviewPage from "./app/pages/Review/CEOReviewPage";
import JobPostingDetailPage from "./app/pages/Review/JobPostingDetailPage";
import RoleManagementPage from "./app/pages/Review/RoleManagementPage";
import VacanciesPage from "./app/pages/Workforce/VacanciesPage";
import { hasPermission, PermissionKey } from "./app/utils/permissions";

/** Placeholder for routes that are linked in the sidebar but not yet built */
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
 * Guards a single route by permission key.
 * Rendered at route-time (after auth has loaded), so user is always available.
 * Redirects to /workforce if the user lacks the required permission.
 */
function PermissionRoute({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!user || !hasPermission(user.permissions, permission, user.role)) {
    return <Navigate to="/workforce" replace />;
  }
  return <>{children}</>;
}

/**
 * The router is created ONCE, outside any component, so it never changes
 * identity and React Router never unmounts/remounts the provider.
 * Permission enforcement is delegated to PermissionRoute wrappers that
 * run at render time (after AuthContext has resolved).
 */
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Public routes */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/signup" element={<SignupForm />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Protected routes – ProtectedRoute handles loading + auth checks */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/workforce"
            element={
              <PermissionRoute permission="VIEW_DASHBOARD">
                <WorkforceDashboard />
              </PermissionRoute>
            }
          />

          <Route
            path="/workforce/planning"
            element={
              <PermissionRoute permission="MANAGE_WORKFORCE_PLANS">
                <PlanningListPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/workforce/plans/new"
            element={
              <PermissionRoute permission="MANAGE_WORKFORCE_PLANS">
                <CreatePlanPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/workforce/plans/:id"
            element={
              <PermissionRoute permission="MANAGE_WORKFORCE_PLANS">
                <CreatePlanPage />
              </PermissionRoute>
            }
          />

          <Route
            path="/workforce/vacancies"
            element={
              <PermissionRoute permission="VIEW_VACANCIES">
                <VacanciesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/workforce/candidates"
            element={
              <PermissionRoute permission="VIEW_CANDIDATES">
                <PlaceholderPage title="Candidates" />
              </PermissionRoute>
            }
          />
          <Route
            path="/workforce/interviews"
            element={
              <PermissionRoute permission="VIEW_INTERVIEWS">
                <PlaceholderPage title="Interviews" />
              </PermissionRoute>
            }
          />
          <Route
            path="/workforce/offers"
            element={
              <PermissionRoute permission="VIEW_OFFERS">
                <PlaceholderPage title="Offers" />
              </PermissionRoute>
            }
          />
          <Route
            path="/workforce/analytics"
            element={
              <PermissionRoute permission="VIEW_ANALYTICS">
                <PlaceholderPage title="Analytics" />
              </PermissionRoute>
            }
          />

          <Route
            path="/review/hr"
            element={
              <PermissionRoute permission="VIEW_HR_REVIEW">
                <HRReviewPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/review/ceo"
            element={
              <PermissionRoute permission="VIEW_CEO_REVIEW">
                <CEOReviewPage />
              </PermissionRoute>
            }
          />
          <Route
            path="/review/ceo/:id"
            element={
              <PermissionRoute permission="VIEW_CEO_REVIEW">
                <JobPostingDetailPage />
              </PermissionRoute>
            }
          />

          <Route
            path="/settings"
            element={<PlaceholderPage title="Settings" />}
          />
          <Route
            path="/settings/roles"
            element={
              <PermissionRoute permission="MANAGE_ROLES">
                <RoleManagementPage />
              </PermissionRoute>
            }
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/workforce" replace />} />
      <Route path="*" element={<Navigate to="/workforce" replace />} />
    </>,
  ),
);

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
