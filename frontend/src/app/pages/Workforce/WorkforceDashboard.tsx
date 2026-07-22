/**
 * pages/Workforce/WorkforceDashboard.tsx
 *
 * Main dashboard page at /workforce. Visible to all roles.
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
    <div className={`bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 ${empty ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          {trend && <FiTrendingUp className="text-green-500" size={13} />}
          {subtitle}
        </p>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  HR_APPROVED: "HR Approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

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
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-green-600" />
      </div>
    );
  }

  const kpis = data?.kpis;
  const activeRequests = data?.activeRequests ?? [];
  const allPlans = data?.allPlans ?? [];

  const approvedCount = allPlans.filter((p) => p.status === "APPROVED").length;
  const rejectedCount = allPlans.filter((p) => p.status === "REJECTED").length;
  const pendingCount = allPlans.filter((p) =>
    ["SUBMITTED", "HR_APPROVED"].includes(p.status),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workforce Planning</h1>
          <p className="text-sm text-slate-500 mt-1">
            Headcount allocation and recruitment overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            onClick={() => load(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <FiRefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              ? `${kpis.pendingRequests} in-flight request${kpis.pendingRequests !== 1 ? "s" : ""}`
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
              className={kpis?.openVacancies ? "text-amber-500" : ""}
            />
          }
          empty={!kpis?.openVacancies}
        />
      </div>

      {/* Two-column main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* All plans table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">All Workforce Plans</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {allPlans.length} total
              {approvedCount > 0 && (
                <> · <span className="text-green-600 font-medium">{approvedCount} approved</span></>
              )}
              {pendingCount > 0 && (
                <> · <span className="text-yellow-600 font-medium">{pendingCount} pending</span></>
              )}
              {rejectedCount > 0 && (
                <> · <span className="text-red-500 font-medium">{rejectedCount} rejected</span></>
              )}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Plan Title</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Department</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Period</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Headcount</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Version</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {allPlans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">
                      <span className="block mb-1">No workforce plans found.</span>
                      {isPlanner && (
                        <Link to="/workforce/plans/new" className="text-green-600 font-semibold hover:underline">
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

                    const rowBg =
                      plan.status === "APPROVED"
                        ? "bg-green-50/40"
                        : plan.status === "REJECTED"
                          ? "bg-red-50/40"
                          : "";

                    return (
                      <tr key={plan.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${rowBg}`}>
                        <td className="px-5 py-3.5 font-medium text-slate-800">
                          {isPlanner ? (
                            <Link to={`/workforce/plans/${plan.id}`} className="text-green-600 hover:underline">
                              {plan.title}
                            </Link>
                          ) : (
                            plan.title
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{plan.department?.name ?? "—"}</td>
                        <td className="px-5 py-3.5 text-slate-500">{period}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{totalHc}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">v{plan.version}</td>
                        <td className="px-5 py-3.5">
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
            <div className="px-5 py-3 border-t border-slate-100">
              <Link to="/workforce/planning" className="text-sm text-green-600 font-semibold hover:underline">
                View all workforce plans →
              </Link>
            </div>
          )}
        </div>

        {/* Active requests sidebar */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800">Active Requests</h2>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {activeRequests.length}
            </span>
          </div>

          {activeRequests.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 px-5 text-center">
              <p className="text-sm text-slate-500">No in-flight requests right now.</p>
              {isPlanner && (
                <Link to="/workforce/plans/new" className="text-sm text-green-600 font-semibold hover:underline">
                  Submit a new plan
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-0 overflow-y-auto">
              {activeRequests.map((req: WorkforcePlan) => {
                const totalHc =
                  req.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
                return (
                  <Link
                    key={req.id}
                    to={isPlanner ? `/workforce/plans/${req.id}` : "#"}
                    className="block px-5 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors no-underline"
                    onClick={(e) => !isPlanner && e.preventDefault()}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {req.department?.name ?? "—"}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800 leading-tight mb-1">{req.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                      {req.justification || "No justification provided"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        {totalHc} position{totalHc !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs font-medium text-green-600">
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
