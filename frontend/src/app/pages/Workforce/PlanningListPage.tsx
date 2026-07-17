import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/Core/ui/Button";
import { workforceService } from "../../services/workforceService";
import { WorkforcePlan } from "../../../utils/types";
import { useAuth } from "../../context/AuthContext";

// All possible filter tabs — shown in this order
const ALL_TABS = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "HR_APPROVED", label: "HR Approved" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

// Row accent class by status
function rowClass(status: string): string {
  if (status === "APPROVED") return "table-row table-row-approved";
  if (status === "REJECTED") return "table-row table-row-rejected";
  if (status === "HR_APPROVED") return "table-row table-row-hr-approved";
  return "table-row";
}

// Which statuses let the planner edit (vs view-only)
const EDITABLE_STATUSES = ["DRAFT", "SUBMITTED", "REJECTED"];
// Which statuses show the delete button
const DELETABLE_STATUSES = ["DRAFT", "SUBMITTED"];

export default function PlanningListPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<WorkforcePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("ALL");

  // HR and CEO have dedicated review pages
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

  // Count plans per status for tab badges
  const countByStatus = (status: string) =>
    status === "ALL"
      ? plans.length
      : plans.filter((p) => p.status === status).length;

  // Only show a tab if it has at least one plan (except "All" which is always shown)
  const visibleTabs = ALL_TABS.filter(
    (t) => t.key === "ALL" || countByStatus(t.key) > 0,
  );

  // Plans shown in the current tab
  const visiblePlans =
    activeTab === "ALL" ? plans : plans.filter((p) => p.status === activeTab);

  return (
    <div className="plans-page">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Workforce Plans</h1>
          <p className="page-description">
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
        <div className="page-loading">
          <div className="loader-icon" />
        </div>
      ) : (
        <>
          {/* ── Status filter tabs ── */}
          {isPlanner && visibleTabs.length > 1 && (
            <div className="plan-tabs">
              {visibleTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`plan-tab${activeTab === tab.key ? " plan-tab-active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  <span
                    className={`plan-tab-count${activeTab === tab.key ? " plan-tab-count-active" : ""}`}
                  >
                    {countByStatus(tab.key)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── Plans table ── */}
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr className="table-header-row">
                  <th className="table-heading">Plan Title</th>
                  <th className="table-heading">Department</th>
                  <th className="table-heading">Period</th>
                  <th className="table-heading">Headcount</th>
                  <th className="table-heading">Version</th>
                  <th className="table-heading">Status</th>
                  <th className="table-heading">Actions</th>
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
                    <tr key={plan.id} className={rowClass(plan.status)}>
                      <td className="table-cell table-cell-emphasis">
                        {plan.title}
                      </td>
                      <td className="table-cell">
                        {plan.department?.name ?? "—"}
                      </td>
                      <td className="table-cell table-cell-capitalize">
                        {plan.planning_period.toLowerCase()}
                        {plan.quarter ? ` Q${plan.quarter}` : ""}
                      </td>
                      <td className="table-cell">{totalHc}</td>
                      <td className="table-cell">v{plan.version}</td>
                      <td className="table-cell">
                        <StatusBadge status={plan.status} />
                      </td>
                      <td className="table-cell">
                        <div className="action-group">
                          {/* Edit for mutable statuses, View for locked ones */}
                          <Link
                            to={`/workforce/plans/${plan.id}`}
                            className="action-link"
                          >
                            {canEdit ? "Edit" : "View"}
                          </Link>

                          {/* Delete — only DRAFT and SUBMITTED */}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(plan.id, plan.title)}
                              disabled={deleting === plan.id}
                              className="delete-button"
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
                    <td colSpan={7} className="empty-state">
                      <span className="empty-state-text">
                        {activeTab === "ALL"
                          ? "No workforce plans yet."
                          : `No ${activeTab.toLowerCase().replace("_", " ")} plans.`}
                      </span>
                      {isPlanner && activeTab === "ALL" && (
                        <Link
                          to="/workforce/plans/new"
                          className="empty-state-link"
                        >
                          Create your first plan
                        </Link>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
