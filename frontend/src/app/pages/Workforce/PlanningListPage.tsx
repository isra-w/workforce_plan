/**
 * pages/Workforce/PlanningListPage.tsx
 *
 * The main listing page for all workforce plans, accessible at /workforce/planning.
 *
 * What it shows:
 *   A full-width table with one row per plan, displaying:
 *     - Plan Title
 *     - Department name
 *     - Planning period (Annual / Quarterly + quarter number)
 *     - Total headcount (sum of all position counts)
 *     - Version number (e.g. v1, v2)
 *     - Status badge (DRAFT, SUBMITTED, APPROVED, etc.)
 *     - Actions column: "Edit" link for editable plans, "View" for read-only,
 *       and a delete (trash) icon button for DRAFT and SUBMITTED plans.
 *
 * Data loading:
 *   On mount, loadPlans() calls workforceService.getPlans() (GET /workforce/plans)
 *   with no filters, so all plans are returned. The loading state shows a
 *   full-page spinner while the request is in flight.
 *
 * handleDelete:
 *   1. Shows a native confirm() dialog to prevent accidental deletion.
 *   2. Calls workforceService.deletePlan(id) (DELETE /workforce/plans/:id).
 *   3. On success, removes the deleted plan from the local state array
 *      (optimistic UI update — no need to re-fetch the whole list).
 *   4. The deleting state tracks which plan ID is being deleted so the
 *      delete button is individually disabled during the operation.
 *
 * State:
 *   plans     WorkforcePlan[]  — the fetched list of plans.
 *   loading   boolean          — true during the initial fetch.
 *   deleting  string | null    — ID of the plan currently being deleted, or null.
 *
 * Header action:
 *   A "Create Plan" button (green, primary) links to /workforce/plans/new.
 *
 * Empty state:
 *   When no plans exist a full-width table cell shows a message and a link
 *   to create the first plan.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import toast from "react-hot-toast";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/Core/ui/Button";
import { workforceService } from "../../services/workforceService";
import { WorkforcePlan } from "../../../utils/types";

export default function PlanningListPage() {
  const [plans, setPlans] = useState<WorkforcePlan[]>([]);
  const [loading, setLoading] = useState(true);
  // Stores the ID of the plan currently being deleted to disable its button
  const [deleting, setDeleting] = useState<string | null>(null);

  /** Fetches all workforce plans and updates the local state */
  const loadPlans = () => {
    workforceService
      .getPlans()
      .then((res) => setPlans(res.data.data.plans))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Load plans once on mount
  useEffect(() => {
    loadPlans();
  }, []);

  /**
   * Deletes a plan after the user confirms the action.
   * Removes the plan from local state on success to avoid a full re-fetch.
   */
  const handleDelete = async (planId: string, planTitle: string) => {
    // Native confirm dialog — stops accidental deletions
    if (
      !window.confirm(
        `Are you sure you want to delete "${planTitle}"? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(planId); // disable only this row's delete button
    try {
      await workforceService.deletePlan(planId);
      toast.success("Plan deleted");
      // Optimistic removal — filter the plan out of local state
      setPlans(plans.filter((p) => p.id !== planId));
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete plan";
      toast.error(message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="plans-page">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Workforce Plans</h1>
          <p className="page-description">
            Manage annual and quarterly headcount planning requests
          </p>
        </div>
        {/* Create Plan button — navigates to the new plan form */}
        <Link to="/workforce/plans/new">
          <Button icon={<FiPlus size={16} />}>Create Plan</Button>
        </Link>
      </div>

      {/* ── Content: spinner while loading, table when ready ── */}
      {loading ? (
        <div className="page-loading">
          <div className="loader-icon" />
        </div>
      ) : (
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
              {plans.map((plan) => {
                // Sum all position counts for the total headcount column
                const totalHc =
                  plan.positions?.reduce((s, p) => s + p.count, 0) || 0;
                return (
                  <tr key={plan.id} className="table-row">
                    <td className="table-cell table-cell-emphasis">
                      {plan.title}
                    </td>
                    <td className="table-cell">{plan.department?.name}</td>
                    <td className="table-cell table-cell-capitalize">
                      {/* Show "quarterly Q2" or just "annual" */}
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
                        {/* "Edit" for mutable plans, "View" for locked/approved plans */}
                        <Link
                          to={`/workforce/plans/${plan.id}`}
                          className="action-link"
                        >
                          {["DRAFT", "SUBMITTED"].includes(plan.status)
                            ? "View"
                            : "View"}
                        </Link>

                        {/* Delete button — only shown for DRAFT and SUBMITTED plans */}
                        {["DRAFT", "SUBMITTED"].includes(plan.status) && (
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

              {/* Empty state row when no plans exist */}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    <span className="empty-state-text">
                      No workforce plans yet.
                    </span>
                    <Link
                      to="/workforce/plans/new"
                      className="empty-state-link"
                    >
                      Create your first plan
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
