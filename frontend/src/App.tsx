/**
 * App.tsx
 *
 * Root component. Wires together:
 *   BrowserRouter → AuthProvider → Toaster → RoleAwareRoutes
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
 *     /workforce/*          → PlaceholderPage
 *     /settings             → PlaceholderPage
 *
 *   HR (protected + verified):
 *     /workforce            → WorkforceDashboard
 *     /review/hr            → HRReviewPage  (SUBMITTED plans)
 *     (any /workforce/plans/* redirects to /review/hr)
 *
 *   CEO (protected + verified):
 *     /workforce            → WorkforceDashboard
 *     /review/ceo           → CEOReviewPage (HR_APPROVED plans)
 *     (any /workforce/plans/* redirects to /review/ceo)
 *
 *   CANDIDATE (protected + verified):
 *     /workforce            → WorkforceDashboard
 *     /workforce/candidates → PlaceholderPage
 *
 *   All roles:
 *     /settings             → PlaceholderPage
 *     unknown path          → redirect /workforce
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
import HRReviewPage from "./app/pages/Review/HRReviewPage";
import CEOReviewPage from "./app/pages/Review/CEOReviewPage";

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

function RoleAwareRoutes() {
  const { user } = useAuth();
  const role = user?.role;

  const isPlanner   = role === "WORKFORCE_PLANNER";
  const isHR        = role === "HR";
  const isCEO       = role === "CEO";
  const isCandidate = role === "CANDIDATE";

  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/login"        element={<LoginForm />} />
      <Route path="/signup"       element={<SignupForm />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* ── Protected ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          {/* Dashboard — visible to all roles */}
          <Route path="/workforce" element={<WorkforceDashboard />} />

          {/* ── HR role ── */}
          {isHR && (
            <>
              {/* HR's primary working page */}
              <Route path="/review/hr" element={<HRReviewPage />} />
              {/* Redirect any attempt to reach planner pages to the HR queue */}
              <Route path="/workforce/planning"  element={<Navigate to="/review/hr" replace />} />
              <Route path="/workforce/plans/*"   element={<Navigate to="/review/hr" replace />} />
            </>
          )}

          {/* ── CEO role ── */}
          {isCEO && (
            <>
              {/* CEO's primary working page */}
              <Route path="/review/ceo" element={<CEOReviewPage />} />
              {/* Redirect any attempt to reach planner pages to the CEO queue */}
              <Route path="/workforce/planning"  element={<Navigate to="/review/ceo" replace />} />
              <Route path="/workforce/plans/*"   element={<Navigate to="/review/ceo" replace />} />
            </>
          )}

          {/* ── WORKFORCE_PLANNER role ── */}
          {isPlanner && (
            <>
              <Route path="/workforce/planning"   element={<PlanningListPage />} />
              <Route path="/workforce/plans/new"  element={<CreatePlanPage />} />
              <Route path="/workforce/plans/:id"  element={<CreatePlanPage />} />
              <Route path="/workforce/vacancies"  element={<PlaceholderPage title="Vacancies" />} />
              <Route path="/workforce/candidates" element={<PlaceholderPage title="Candidates" />} />
              <Route path="/workforce/interviews" element={<PlaceholderPage title="Interviews" />} />
              <Route path="/workforce/offers"     element={<PlaceholderPage title="Offers" />} />
              <Route path="/workforce/analytics"  element={<PlaceholderPage title="Analytics" />} />
            </>
          )}

          {/* ── CANDIDATE role ── */}
          {isCandidate && (
            <Route path="/workforce/candidates" element={<PlaceholderPage title="Candidates" />} />
          )}

          {/* ── Shared routes (all roles) ── */}
          <Route path="/settings" element={<PlaceholderPage title="Settings" />} />

        </Route>
      </Route>

      {/* ── Fallback ── */}
      <Route path="/" element={<Navigate to="/workforce" replace />} />
      <Route path="*" element={<Navigate to="/workforce" replace />} />
    </Routes>
  );
}

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
