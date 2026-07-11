/**
 * pages/Workforce/WorkforceDashboard.tsx
 *
 * Main landing page for authenticated users at /workforce.
 * Pulls data from GET /workforce/dashboard and presents it in two areas:
 *
 *   1. KPI grid (top row)  — three metric cards:
 *        Total Approved Headcount  — from approved plans
 *        Pending Requests          — in-flight plans (SUBMITTED → CEO_REVIEW)
 *        Open Vacancies            — headcount in pending plans
 *
 *   2. Main grid (two columns):
 *        Left  — "Submitted Workforce Plans" table: all non-draft plans
 *                 with title, department, period, headcount badge, version, status.
 *                 Each title links to the plan's edit/view page.
 *        Right — "Active Requests" sidebar: compact card list of in-flight
 *                 plans showing department, status badge, title, and headcount.
 *
 * Helper components (defined in this file):
 *   formatBudget  — formats a USD number as $1.5M / $120k / $80 for display.
 *   KpiCard       — reusable card component for the KPI grid.
 *
 * Data loading:
 *   load(showSpinner?) is called on mount and also when the user clicks the
 *   "Refresh" button in the header. When showSpinner is true a rotating icon
 *   is shown on the button while the request is in flight.
 *
 * State:
 *   data        DashboardData | null  — full API response from the dashboard endpoint.
 *   loading     boolean               — true on initial load (shows full-page spinner).
 *   refreshing  boolean               — true during a manual refresh (shows button spinner).
 *
 * FY label:
 *   The fiscal year range shown in the subtitle is derived dynamically from the
 *   min and max fiscal_year values across all loaded plans.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiTrendingUp,
  FiUsers,
  FiClock,
  FiAlertTriangle,
  FiRefreshCw,
} from "react-icons/fi";
import StatusBadge from "../../components/common/StatusBadge";
import { workforceService } from "../../services/workforceService";
import { DashboardData, WorkforcePlan } from "../../../utils/types";

/* ── Helpers ──────────────────────────────────────────────────────────── */

/**
 * formatBudget
 * Converts a raw USD integer into a human-readable string.
 *   0        → "—"
 *   1500000  → "$1.5M"
 *   120000   → "$120k"
 *   800      → "$800"
 */
function formatBudget(usd: number): string {
  if (usd === 0) return "—";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}k`;
  return `$${usd}`;
}

/* ── KPI card component ───────────────────────────────────────────────── */

/**
 * KpiCard
 *
 * A single metric card in the KPI grid row.
 *
 * Props:
 *   title     Label shown above the value (e.g. "Pending Requests").
 *   value     The main number or text to display prominently.
 *   subtitle  Optional secondary line below the value.
 *   icon      Icon element shown top-right of the card.
 *   trend     When true, shows a FiTrendingUp icon before the subtitle.
 *   empty     When true, applies muted styling for zero-value cards.
 */
function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  empty,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: boolean;
  empty?: boolean;
}) {
  return (
    <div className={`kpi-card${empty ? " kpi-card-empty" : ""}`}>
      <div className="kpi-card-header">
        <p className="kpi-card-title">{title}</p>
        <span className="kpi-card-icon">{icon}</span>
      </div>
      {/* Large prominent metric value */}
      <p className="kpi-card-value">{value}</p>
      {subtitle && (
        <p className="kpi-card-subtitle">
          {/* Trend arrow shown next to subtitle for positive metrics */}
          {trend && <FiTrendingUp className="kpi-card-trend" size={13} />}
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ── Page component ───────────────────────────────────────────────────── */

export default function WorkforceDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Fetches dashboard data from the API.
   * @param showSpinner — when true, sets refreshing=true to animate the refresh button.
   *                       Used for manual refresh; initial load uses the full-page spinner.
   */
  const load = (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    workforceService
      .getDashboard()
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  // Fetch data once on mount
  useEffect(() => { load(); }, []);

  // Show full-page spinner on initial load before any data arrives
  if (loading) {
    return <div className="page-loading"><div className="loader-icon" /></div>;
  }

  const kpis           = data?.kpis;
  const activeRequests = data?.activeRequests ?? [];
  const allPlans       = data?.allPlans ?? []; // every non-draft plan

  // Build a fiscal year range label from the plans' fiscal_year values
  const fyYears = allPlans.map((r) => r.fiscal_year).filter(Boolean);
  const fyLabel =
    fyYears.length > 0
      ? `${Math.min(...fyYears)}–${Math.max(...fyYears)}`
      : `${new Date().getFullYear()}`;

  return (
    <div className="dashboard-page">

      {/* ── Page header ── */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Workforce Planning</h1>
          <p className="dashboard-description">
            Live headcount allocation and recruitment demand — {fyLabel}
          </p>
        </div>
        {/* Manual refresh button — spins the icon while refreshing */}
        <div className="toolbar">
          <button
            className="toolbar-button toolbar-button-secondary"
            onClick={() => load(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <FiRefreshCw size={15} className={refreshing ? "spin-icon" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="kpi-grid">
        {/* Card 1: total approved headcount from all APPROVED plans */}
        <KpiCard
          title="Total Approved Headcount"
          value={kpis?.totalApprovedHeadcount?.toLocaleString() ?? "0"}
          subtitle={
            kpis?.totalApprovedHeadcount
              ? `From ${allPlans.filter((p) => p.status === "APPROVED").length} approved plan(s)`
              : "No approved plans yet"
          }
          icon={<FiUsers size={20} />}
          trend={!!kpis?.totalApprovedHeadcount}
          empty={!kpis?.totalApprovedHeadcount}
        />
        {/* Card 2: in-flight requests with estimated budget */}
        <KpiCard
          title="Pending Requests"
          value={kpis?.pendingRequests ?? 0}
          subtitle={
            kpis?.pendingRequests
              ? `Est. budget: ${formatBudget(kpis?.estBudgetUSD ?? 0)}`
              : "No in-flight requests"
          }
          icon={<FiClock size={20} />}
          empty={!kpis?.pendingRequests}
        />
        {/* Card 3: total positions in pending plans + high-priority count */}
        <KpiCard
          title="Open Vacancies"
          value={kpis?.openVacancies ?? 0}
          subtitle={
            kpis?.openVacancies
              ? `${kpis.criticalRoles} high-priority role${kpis.criticalRoles !== 1 ? "s" : ""}`
              : "No pending vacancies"
          }
          icon={
            <FiAlertTriangle
              size={20}
              className={kpis?.openVacancies ? "status-icon-warning" : ""}
            />
          }
          empty={!kpis?.openVacancies}
        />
      </div>

      {/* ── Two-column main grid ── */}
      <div className="dashboard-grid">

        {/* ── Left: submitted plans table ── */}
        <div className="table-card">
          <div className="card-header">
            <h2 className="section-title">Submitted Workforce Plans</h2>
            <span className="dashboard-table-note">
              {allPlans.length} plan{allPlans.length !== 1 ? "s" : ""} submitted
            </span>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr className="table-header-row">
                  <th className="table-heading">Plan Title</th>
                  <th className="table-heading">Department</th>
                  <th className="table-heading">Period</th>
                  <th className="table-heading">Headcount</th>
                  <th className="table-heading">Version</th>
                  <th className="table-heading">Status</th>
                </tr>
              </thead>
              <tbody>
                {allPlans.length === 0 ? (
                  /* Empty state */
                  <tr>
                    <td colSpan={6} className="empty-state">
                      <span className="empty-state-text">
                        No workforce plans have been submitted yet.
                      </span>
                      <Link to="/workforce/plans/new" className="empty-state-link">
                        Create the first plan
                      </Link>
                    </td>
                  </tr>
                ) : (
                  allPlans.map((plan: WorkforcePlan) => {
                    // Sum all position counts for the headcount badge
                    const totalHc =
                      plan.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
                    // Build human-readable period string
                    const period =
                      plan.planning_period === "QUARTERLY" && plan.quarter
                        ? `Q${plan.quarter} ${plan.fiscal_year}`
                        : `Annual ${plan.fiscal_year}`;
                    return (
                      <tr key={plan.id} className="table-row">
                        <td className="table-cell table-cell-emphasis">
                          {/* Title links to the plan's detail / edit page */}
                          <Link
                            to={`/workforce/plans/${plan.id}`}
                            className="table-plan-link"
                          >
                            {plan.title}
                          </Link>
                        </td>
                        <td className="table-cell">
                          {plan.department?.name ?? "—"}
                        </td>
                        <td className="table-cell table-cell-muted">
                          {period}
                        </td>
                        <td className="table-cell">
                          {/* Pill badge for the headcount number */}
                          <span className="table-hc-badge">{totalHc}</span>
                        </td>
                        <td className="table-cell table-cell-muted">
                          v{plan.version}
                        </td>
                        <td className="table-cell">
                          <StatusBadge status={plan.status} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer link to the full planning list page */}
          {allPlans.length > 0 && (
            <div className="card-footer">
              <Link to="/workforce/planning" className="view-link">
                View all workforce plans →
              </Link>
            </div>
          )}
        </div>

        {/* ── Right: active requests sidebar ── */}
        <div className="active-requests-card">
          <div className="card-header card-header-spaced">
            <h2 className="section-title">Active Requests</h2>
            {/* Count pill showing total in-flight requests */}
            <span className="status-pill">{activeRequests.length}</span>
          </div>

          {activeRequests.length === 0 ? (
            /* Empty state when no plans are in review */
            <div className="active-requests-empty">
              <p>No in-flight requests right now.</p>
              <Link to="/workforce/plans/new" className="empty-state-link">
                Submit a new plan
              </Link>
            </div>
          ) : (
            /* Card list — each card links to the plan's detail page */
            <div className="active-requests-list">
              {activeRequests.map((req: WorkforcePlan) => {
                const totalHc =
                  req.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
                return (
                  <Link
                    key={req.id}
                    to={`/workforce/plans/${req.id}`}
                    className="request-card"
                  >
                    <div className="request-card-header">
                      {/* Department tag and current status badge */}
                      <span className="request-card-tag">
                        {req.department?.name ?? "—"}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    <h3 className="request-card-title">{req.title}</h3>
                    {/* Truncated justification text (2-line clamp via CSS) */}
                    <p className="request-card-text">
                      {req.justification || "No justification provided"}
                    </p>
                    <div className="request-card-footer">
                      <span className="request-card-hc">
                        {totalHc} position{totalHc !== 1 ? "s" : ""}
                      </span>
                      <span className="request-card-action">View plan →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
