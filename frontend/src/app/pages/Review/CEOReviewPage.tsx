/**
 * pages/Review/CEOReviewPage.tsx
 *
 * Exclusive to the CEO role. Shows every plan with status HR_APPROVED —
 * these are "job postings" that HR has vetted and forwarded for final
 * executive sign-off.
 *
 * What the CEO can do:
 *   Approve → APPROVED  (headcount is officially authorised)
 *   Reject  → REJECTED  (requires a comment; planner can resubmit after revision)
 *
 * Layout:
 *   Page header with title and pending count badge.
 *   Card grid — one card per HR_APPROVED plan showing:
 *     • Plan title, department, planning period, headcount, version, HR-approval date
 *     • Positions table
 *     • Justification text
 *     • Attachments list
 *     • Approve / Reject action bar with comment textarea
 *
 * Identical card-level UX pattern to HRReviewPage for consistency.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiXCircle, FiFileText, FiChevronDown, FiChevronUp, FiEye } from "react-icons/fi";
import toast from "react-hot-toast";
import StatusBadge from "../../components/common/StatusBadge";
import { workforceService } from "../../services/workforceService";
import { WorkforcePlan } from "../../../utils/types";

interface CardState {
  comment: string;
  loading: boolean;
  showRejectBox: boolean;
  expanded: boolean;
}

export default function CEOReviewPage() {
  const [plans, setPlans] = useState<WorkforcePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardState, setCardState] = useState<Record<string, CardState>>({});

  // Load HR_APPROVED plans — backend scopes to HR_APPROVED for CEO role automatically
  useEffect(() => {
    workforceService
      .getPlans()
      .then((res) => {
        const fetched: WorkforcePlan[] = res.data.data.plans;
        setPlans(fetched);
        const init: Record<string, CardState> = {};
        fetched.forEach((p) => {
          init[p.id] = { comment: "", loading: false, showRejectBox: false, expanded: false };
        });
        setCardState(init);
      })
      .catch(() => toast.error("Failed to load job postings"))
      .finally(() => setLoading(false));
  }, []);

  const patch = (planId: string, update: Partial<CardState>) =>
    setCardState((prev) => ({ ...prev, [planId]: { ...prev[planId], ...update } }));

  /** Approve — HR_APPROVED → APPROVED (final sign-off) */
  const handleApprove = async (plan: WorkforcePlan) => {
    patch(plan.id, { loading: true });
    try {
      await workforceService.reviewPlan(plan.id, "approve");
      toast.success(`"${plan.title}" approved. Headcount is now authorised.`);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Approval failed";
      toast.error(msg);
      patch(plan.id, { loading: false });
    }
  };

  /** Reject — HR_APPROVED → REJECTED (comment required) */
  const handleReject = async (plan: WorkforcePlan) => {
    const state = cardState[plan.id];
    if (!state?.comment.trim()) {
      toast.error("Please enter a rejection reason.");
      return;
    }
    patch(plan.id, { loading: true });
    try {
      await workforceService.reviewPlan(plan.id, "reject", state.comment.trim());
      toast.success(`"${plan.title}" rejected.`);
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
          <h1 className="page-title">Job Postings — CEO Approval</h1>
          <p className="page-description">
            Workforce plans approved by HR and awaiting your final authorisation.
          </p>
        </div>
        <span className="review-count-badge review-count-badge-ceo">
          {plans.length} pending
        </span>
      </div>

      {/* ── Empty state ── */}
      {plans.length === 0 && (
        <div className="review-empty">
          <FiCheckCircle size={40} className="review-empty-icon" />
          <p className="review-empty-title">No pending approvals</p>
          <p className="review-empty-sub">There are no job postings waiting for your sign-off.</p>
        </div>
      )}

      {/* ── Plan cards ── */}
      <div className="review-card-list">
        {plans.map((plan) => {
          const state = cardState[plan.id] ?? { comment: "", loading: false, showRejectBox: false, expanded: false };
          const totalHc = plan.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
          const period = plan.planning_period === "QUARTERLY" && plan.quarter
            ? `Q${plan.quarter} ${plan.fiscal_year}`
            : `Annual ${plan.fiscal_year}`;

          // Find the HR approval log entry for the approved-by line
          const hrLog = plan.approval_logs?.find((l) => l.action === "HR_APPROVED");

          return (
            <div key={plan.id} className="review-card review-card-ceo">
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
                    {hrLog && (
                      <> · HR approved by <strong>{hrLog.actor?.full_name ?? "HR"}</strong>
                        {" on "}{new Date(hrLog.created_at).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                <button
                  className="review-expand-btn"
                  onClick={() => patch(plan.id, { expanded: !state.expanded })}
                  title={state.expanded ? "Collapse" : "Expand details"}
                >
                  {state.expanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                </button>
              </div>

              {/* ── Expanded details ── */}
              {state.expanded && (
                <div className="review-card-details">
                  {plan.justification && (
                    <div className="review-detail-section">
                      <p className="review-detail-label">Business Justification</p>
                      <p className="review-detail-text">{plan.justification}</p>
                    </div>
                  )}

                  {plan.positions && plan.positions.length > 0 && (
                    <div className="review-detail-section">
                      <p className="review-detail-label">Positions Requested</p>
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
                {state.showRejectBox ? (
                  <div className="review-reject-box">
                    <textarea
                      className="review-comment-input"
                      placeholder="Required: explain why this job posting is being rejected..."
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
                    {/* View — opens the full job posting detail page */}
                    <Link
                      to={`/review/ceo/${plan.id}`}
                      className="review-btn review-btn-view"
                    >
                      <FiEye size={15} />
                      View
                    </Link>
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
                      Approve Job Posting
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
