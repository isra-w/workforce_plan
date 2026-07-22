import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/Core/ui/Button";
import { workforceService } from "../../services/workforceService";
import { WorkforcePlan } from "../../../utils/types";
import { useAuth } from "../../context/AuthContext";

const ALL_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "HR_APPROVED", label: "HR Approved" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

function rowBg(status: string): string {
  if (status === "APPROVED") return "bg-green-50/40";
  if (status === "REJECTED") return "bg-red-50/40";
  if (status === "HR_APPROVED") return "bg-blue-50/30";
  return "";
}

const EDITABLE_STATUSES = ["DRAFT", "SUBMITTED", "REJECTED"];
const DELETABLE_STATUSES = ["DRAFT", "SUBMITTED"];

export default function PlanningListPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<WorkforcePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("ALL");

  if (user?.role === "CEO") return <Navigate to="/review/ceo" replace />;

  const isPlanner = user?.role === "WORKFORCE_PLANNER";

  const loadPlans = () => {
    workforceService
      .getPlans()
      .then((res) => setPlans(res.data.data.plans))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleDelete = async (planId: string, planTitle: string) => {
    if (!window.confirm(`Delete "${planTitle}"? This cannot be undone.`))
      return;
    setDeleting(planId);
    try {
      await workforceService.deletePlan(planId);
      toast.success("Plan deleted");
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete plan";
      toast.error(msg);
    } finally {
      setDeleting(null);
    }
  };

  const countByStatus = (status: string) =>
    status === "ALL"
      ? plans.length
      : plans.filter((p) => p.status === status).length;

  const visibleTabs = ALL_TABS.filter(
    (t) => t.key === "ALL" || countByStatus(t.key) > 0,
  );

  const visiblePlans =
    activeTab === "ALL" ? plans : plans.filter((p) => p.status === activeTab);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workforce Plans</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isPlanner
              ? "Create, track, and manage all your headcount planning requests."
              : "View submitted workforce plans."}
          </p>
        </div>
        {isPlanner && (
          <Link to="/workforce/plans/new">
            <Button icon={<FiPlus size={16} />}>Create Plan</Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-green-600" />
        </div>
      ) : (
        <>
          {/* Status filter tabs */}
          {isPlanner && visibleTabs.length > 1 && (
            <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px
                    ${activeTab === tab.key
                      ? "border-green-600 text-green-600"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  <span
                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold
                      ${activeTab === tab.key
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500"
                      }`}
                  >
                    {countByStatus(tab.key)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Plans table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePlans.map((plan) => {
                    const totalHc =
                      plan.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
                    const canEdit =
                      isPlanner && EDITABLE_STATUSES.includes(plan.status);
                    const canDelete =
                      isPlanner && DELETABLE_STATUSES.includes(plan.status);

                    return (
                      <tr key={plan.id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${rowBg(plan.status)}`}>
                        <td className="px-5 py-3.5 font-medium text-slate-800">{plan.title}</td>
                        <td className="px-5 py-3.5 text-slate-600">{plan.department?.name ?? "—"}</td>
                        <td className="px-5 py-3.5 text-slate-600 capitalize">
                          {plan.planning_period.toLowerCase()}
                          {plan.quarter ? ` Q${plan.quarter}` : ""}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{totalHc}</td>
                        <td className="px-5 py-3.5 text-slate-500">v{plan.version}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={plan.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/workforce/plans/${plan.id}`}
                              className="text-sm font-medium text-green-600 hover:text-green-700 hover:underline"
                            >
                              {canEdit ? "Edit" : "View"}
                            </Link>
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(plan.id, plan.title)}
                                disabled={deleting === plan.id}
                                className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                title="Delete plan"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {visiblePlans.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-sm">
                        <span className="block mb-1">
                          {activeTab === "ALL"
                            ? "No workforce plans yet."
                            : `No ${activeTab.toLowerCase().replace("_", " ")} plans.`}
                        </span>
                        {isPlanner && activeTab === "ALL" && (
                          <Link to="/workforce/plans/new" className="text-green-600 font-semibold hover:underline">
                            Create your first plan
                          </Link>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
