/**
 * pages/Review/HRReviewPage.tsx
 *
 * Exclusive to the HR role. Shows every workforce plan that has status
 * SUBMITTED — i.e. plans the workforce planner has submitted and are
 * awaiting HR's first-level decision.
 *
 * What HR can do on this page:
 *   Approve → sends the plan to HR_APPROVED status (surfaces to CEO as a job posting)
 *   Reject  → sends the plan to REJECTED status (planner can edit and resubmit)
 *             A rejection comment is required before the button is enabled.
 *
 * Layout:
 *   Page header with title and plan count badge.
 *   Card grid — one ReviewCard per SUBMITTED plan showing:
 *     • Plan title, department, planning period, headcount, version
 *     • Submitted-by name and submission date
 *     • Positions table (role title, count, type, priority)
 *     • Justification text
 *     • Attachments list (view-only links)
 *     • Approve / Reject action bar with comment textarea
 *
 * State per card:
 *   reviewState[planId] = { comment: string; loading: boolean; rejected: boolean }
 *   rejected flag shows/hides the comment textarea before submission.
 */
import { useEffect, useState } from "react";
import { FiCheckCircle, FiXCircle, FiFileText, FiChevronDown, FiChevronUp } from "react-icons/fi";
import toast from "react-hot-toast";
import StatusBadge from "../../components/common/StatusBadge";
import { workforceService } from "../../services/workforceService";
import { WorkforcePlan } from "../../../utils/types";

interface CardReviewState {
  comment: string;
  loading: boolean;
  showRejectBox: boolean;
  expanded: boolean;
}

export default function HRReviewPage() {
  const [plans, setPlans] = useState<WorkforcePlan[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-plan review UI state
  const [reviewState, setReviewState] = useState<Record<string, CardReviewState>>({});

  // Load SUBMITTED plans — backend already filters to SUBMITTED for HR role
  useEffect(() => {
    workforceService
      .getPlans()
      .then((res) => {
        const fetched: WorkforcePlan[] = res.data.data.plans;
        setPlans(fetched);
        // Initialise per-card state
        const init: Record<string, CardReviewState> = {};
        fetched.forEach((p) => {
          init[p.id] = { comment: "", loading: false, showRejectBox: false, expanded: false };
        });
        setReviewState(init);
      })
      .catch(() => toast.error("Failed to load plans"))
      .finally(() => setLoading(false));
  }, []);

  /** Update a single field in one card's state without touching others */
  const patch = (planId: string, update: Partial<CardReviewState>) =>
    setReviewState((prev) => ({ ...prev, [planId]: { ...prev[planId], ...update } }));

  /** Approve — SUBMITTED → HR_APPROVED */
  const handleApprove = async (plan: WorkforcePlan) => {
    patch(plan.id, { loading: true });
    try {
      await workforceService.reviewPlan(plan.id, "approve");
      toast.success(`"${plan.title}" approved and sent to CEO for final sign-off.`);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Approval failed";
      toast.error(msg);
      patch(plan.id, { loading: false });
    }
  };

  /** Reject — SUBMITTED → REJECTED (comment required) */
  const handleReject = async (plan: WorkforcePlan) => {
    const state = reviewState[plan.id];
    if (!state?.comment.trim()) {
      toast.error("Please enter a rejection reason before rejecting.");
      return;
    }
    patch(plan.id, { loading: true });
    try {
      await workforceService.reviewPlan(plan.id, "reject", state.comment.trim());
      toast.success(`"${plan.title}" rejected. The planner will be notified.`);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Rejection failed";
      toast.error(msg);
      patch(plan.id, { loading: false });
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="loader-icon" /></div>;
  }

  return (
    <div className="review-page">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">HR Review Queue</h1>
          <p className="page-description">
            Workforce plans submitted by planners and awaiting your decision.
          </p>
        </div>
        <span className="review-count-badge">
          {plans.length} pending
        </span>
      </div>

      {/* ── Empty state ── */}
      {plans.length === 0 && (
        <div className="review-empty">
          <FiCheckCircle size={40} className="review-empty-icon" />
          <p className="review-empty-title">All caught up!</p>
          <p className="review-empty-sub">No workforce plans are waiting for your review.</p>
        </div>
      )}

      {/* ── Plan cards ── */}
      <div className="review-card-list">
        {plans.map((plan) => {
          const state = reviewState[plan.id] ?? { comment: "", loading: false, showRejectBox: false, expanded: false };
          const totalHc = plan.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
          const period = plan.planning_period === "QUARTERLY" && plan.quarter
            ? `Q${plan.quarter} ${plan.fiscal_year}`
            : `Annual ${plan.fiscal_year}`;

          return (
            <div key={plan.id} className="review-card">
              {/* ── Card header ── */}
              <div className="review-card-header">
                <div className="review-card-meta">
                  <div className="review-card-title-row">
                    <h2 className="review-card-title">{plan.title}</h2>
                    <StatusBadge status={plan.status} />
                  </div>
                  <div className="review-card-tags">
                    <span className="review-tag">{plan.department?.name}</span>
                    <span className="review-tag">{period}</span>
                    <span className="review-tag">{totalHc} positions</span>
                    <span className="review-tag">v{plan.version}</span>
                  </div>
                  <p className="review-card-submitter">
                    Submitted by <strong>{plan.created_by?.full_name ?? "—"}</strong>
                    {plan.approval_logs?.find((l) => l.action === "SUBMITTED")?.created_at
                      ? ` on ${new Date(plan.approval_logs.find((l) => l.action === "SUBMITTED")!.created_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                {/* Expand / collapse details toggle */}
                <button
                  className="review-expand-btn"
                  onClick={() => patch(plan.id, { expanded: !state.expanded })}
                  title={state.expanded ? "Collapse details" : "Expand details"}
                >
                  {state.expanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                </button>
              </div>

              {/* ── Expanded details ── */}
              {state.expanded && (
                <div className="review-card-details">
                  {/* Justification */}
                  {plan.justification && (
                    <div className="review-detail-section">
                      <p className="review-detail-label">Business Justification</p>
                      <p className="review-detail-text">{plan.justification}</p>
                    </div>
                  )}

                  {/* Positions table */}
                  {plan.positions && plan.positions.length > 0 && (
                    <div className="review-detail-section">
                      <p className="review-detail-label">Requested Positions</p>
                      <table className="review-positions-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Count</th>
                            <th>Type</th>
                            <th>Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.positions.map((pos, i) => (
                            <tr key={i}>
                              <td>{pos.title}</td>
                              <td>{pos.count}</td>
                              <td>{pos.employment_type.replace("_", " ")}</td>
                              <td><StatusBadge status={pos.priority} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Attachments */}
                  {plan.attachments && plan.attachments.length > 0 && (
                    <div className="review-detail-section">
                      <p className="review-detail-label">
                        <FiFileText size={13} style={{ marginRight: 4 }} />
                        Supporting Documents
                      </p>
                      <ul className="review-attachment-list">
                        {plan.attachments.map((att) => (
                          <li key={att.id} className="review-attachment-item">
                            <span>📎</span>
                            <span>{att.filename}</span>
                            <span className="review-attachment-size">
                              {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ── Action bar ── */}
              <div className="review-action-bar">
                {/* Reject flow: toggle comment box first, then confirm */}
                {state.showRejectBox ? (
                  <div className="review-reject-box">
                    <textarea
                      className="review-comment-input"
                      placeholder="Required: explain the reason for rejection so the planner can act on it..."
                      rows={3}
                      value={state.comment}
                      onChange={(e) => patch(plan.id, { comment: e.target.value })}
                    />
                    <div className="review-reject-actions">
                      <button
                        className="review-btn review-btn-cancel"
                        onClick={() => patch(plan.id, { showRejectBox: false, comment: "" })}
                        disabled={state.loading}
                      >
                        Cancel
                      </button>
                      <button
                        className="review-btn review-btn-reject"
                        onClick={() => handleReject(plan)}
                        disabled={state.loading || !state.comment.trim()}
                      >
                        {state.loading ? <span className="btn-spinner" /> : <FiXCircle size={15} />}
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="review-decision-btns">
                    <button
                      className="review-btn review-btn-reject-init"
                      onClick={() => patch(plan.id, { showRejectBox: true })}
                      disabled={state.loading}
                    >
                      <FiXCircle size={15} />
                      Reject
                    </button>
                    <button
                      className="review-btn review-btn-approve"
                      onClick={() => handleApprove(plan)}
                      disabled={state.loading}
                    >
                      {state.loading ? <span className="btn-spinner" /> : <FiCheckCircle size={15} />}
                      Approve & Forward to CEO
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
