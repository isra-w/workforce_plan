/**
 * pages/Workforce/WorkforceDashboard.tsx
 *
 * Main dashboard page at /workforce. Visible to all roles.
 *
 * Shows:
 *   1. Three KPI cards — Total Approved Headcount, Pending Requests, Open Vacancies
 *   2. "All Workforce Plans" table — every plan regardless of status (DRAFT excluded
 *      by the backend). Includes SUBMITTED, HR_APPROVED, APPROVED, REJECTED.
 *   3. "Active Requests" sidebar — in-flight plans still moving through the pipeline.
 *
 * Role visibility:
 *   WORKFORCE_PLANNER — sees all plans in the table; active sidebar shows SUBMITTED
 *                       and HR_APPROVED.
 *   HR               — same table; active sidebar shows only SUBMITTED plans.
 *   CEO              — same table; active sidebar shows only HR_APPROVED plans.
 *   CANDIDATE        — read-only; no "Create plan" links shown.
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
import { useAuth } from "../../context/AuthContext";

/* ── Helpers ──────────────────────────────────────────────────────────── */

function formatBudget(usd: number): string {
  if (usd === 0) return "—";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${Math.round(usd / 1_000)}k`;
  return `$${usd}`;
}

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
      <p className="kpi-card-value">{value}</p>
      {subtitle && (
        <p className="kpi-card-subtitle">
          {trend && <FiTrendingUp className="kpi-card-trend" size={13} />}
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ── Status label map — human-readable names for every PlanStatus ─────── */
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  HR_APPROVED: "HR Approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function WorkforceDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isPlanner = user?.role === "WORKFORCE_PLANNER";

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

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loader-icon" />
      </div>
    );
  }

  const kpis = data?.kpis;
  const activeRequests = data?.activeRequests ?? [];

  // allPlans comes from the backend with status NOT IN ('DRAFT').
  // It includes SUBMITTED, HR_APPROVED, APPROVED, and REJECTED plans.
  const allPlans = data?.allPlans ?? [];

  // Counts per status — used in the table header summary
  const approvedCount = allPlans.filter((p) => p.status === "APPROVED").length;
  const rejectedCount = allPlans.filter((p) => p.status === "REJECTED").length;
  const pendingCount = allPlans.filter((p) =>
    ["SUBMITTED", "HR_APPROVED"].includes(p.status),
  ).length;

  return (
    <div className="dashboard-page">
      {/* ── Page header ── */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Workforce Planning</h1>
          <p className="dashboard-description">
            Headcount allocation and recruitment overview
          </p>
        </div>
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
        <KpiCard
          title="Total Approved Headcount"
          value={kpis?.totalApprovedHeadcount?.toLocaleString() ?? "0"}
          subtitle={
            approvedCount
              ? `From ${approvedCount} approved plan${approvedCount !== 1 ? "s" : ""}`
              : "No approved plans yet"
          }
          icon={<FiUsers size={20} />}
          trend={!!kpis?.totalApprovedHeadcount}
          empty={!kpis?.totalApprovedHeadcount}
        />
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
        {/* ── Left: all plans table ── */}
        <div className="table-card">
          <div className="card-header">
            <div>
              <h2 className="section-title">All Workforce Plans</h2>
              {/* Summary row showing counts per status */}
              <p className="dashboard-plan-summary">
                {allPlans.length} total
                {approvedCount > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="summary-approved">
                      {approvedCount} approved
                    </span>
                  </>
                )}
                {pendingCount > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="summary-pending">
                      {pendingCount} pending
                    </span>
                  </>
                )}
                {rejectedCount > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <span className="summary-rejected">
                      {rejectedCount} rejected
                    </span>
                  </>
                )}
              </p>
            </div>
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
                  <tr>
                    <td colSpan={6} className="empty-state">
                      <span className="empty-state-text">
                        No workforce plans found.
                      </span>
                      {/* Only planners can create plans */}
                      {isPlanner && (
                        <Link
                          to="/workforce/plans/new"
                          className="empty-state-link"
                        >
                          Create the first plan
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  allPlans.map((plan: WorkforcePlan) => {
                    const totalHc =
                      plan.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
                    const period =
                      plan.planning_period === "QUARTERLY" && plan.quarter
                        ? `Q${plan.quarter} ${plan.fiscal_year}`
                        : `Annual ${plan.fiscal_year}`;

                    // Row accent class so approved/rejected rows are visually distinct
                    const rowClass =
                      plan.status === "APPROVED"
                        ? "table-row table-row-approved"
                        : plan.status === "REJECTED"
                          ? "table-row table-row-rejected"
                          : "table-row";

                    return (
                      <tr key={plan.id} className={rowClass}>
                        <td className="table-cell table-cell-emphasis">
                          {/* Planners get an edit/view link; others just see the title */}
                          {isPlanner ? (
                            <Link
                              to={`/workforce/plans/${plan.id}`}
                              className="table-plan-link"
                            >
                              {plan.title}
                            </Link>
                          ) : (
                            plan.title
                          )}
                        </td>
                        <td className="table-cell">
                          {plan.department?.name ?? "—"}
                        </td>
                        <td className="table-cell table-cell-muted">
                          {period}
                        </td>
                        <td className="table-cell">
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

          {allPlans.length > 0 && isPlanner && (
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
            <span className="status-pill">{activeRequests.length}</span>
          </div>

          {activeRequests.length === 0 ? (
            <div className="active-requests-empty">
              <p>No in-flight requests right now.</p>
              {isPlanner && (
                <Link to="/workforce/plans/new" className="empty-state-link">
                  Submit a new plan
                </Link>
              )}
            </div>
          ) : (
            <div className="active-requests-list">
              {activeRequests.map((req: WorkforcePlan) => {
                const totalHc =
                  req.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
                return (
                  <Link
                    key={req.id}
                    to={isPlanner ? `/workforce/plans/${req.id}` : "#"}
                    className="request-card"
                    onClick={(e) => !isPlanner && e.preventDefault()}
                  >
                    <div className="request-card-header">
                      <span className="request-card-tag">
                        {req.department?.name ?? "—"}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    <h3 className="request-card-title">{req.title}</h3>
                    <p className="request-card-text">
                      {req.justification || "No justification provided"}
                    </p>
                    <div className="request-card-footer">
                      <span className="request-card-hc">
                        {totalHc} position{totalHc !== 1 ? "s" : ""}
                      </span>
                      <span className="request-card-action">
                        {STATUS_LABEL[req.status] ?? req.status}
                      </span>
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
