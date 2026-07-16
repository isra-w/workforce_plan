/**
 * pages/Review/JobPostingDetailPage.tsx
 *
 * Full read-only detail view of a single HR-approved job posting.
 * Accessible at /review/ceo/:id — CEO role only.
 *
 * Layout (two-column):
 *   Left column (main):
 *     1. Basic Information  — title, department, fiscal year, period, dates
 *     2. Requested Positions — full table (title, count, type, priority)
 *     3. Business Justification — full text
 *     4. Supporting Documents — attachment list
 *     5. Approval History — timeline of every approval log entry
 *
 *   Right sidebar:
 *     Status card  — current status badge + version
 *     Submitted by — planner name + email
 *     HR Approval  — who approved and when
 *     Action card  — Approve and Reject buttons (same two-step flow as the
 *                    review list, so the CEO can act directly from this page)
 *
 * Navigation:
 *   Back button returns to /review/ceo without losing the list state.
 *   After approve or reject the user is sent back to /review/ceo.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiArrowLeft, FiCheckCircle, FiXCircle,
  FiFileText, FiUser, FiCalendar, FiInfo,
  FiUsers, FiClock,
} from "react-icons/fi";
import toast from "react-hot-toast";
import StatusBadge from "../../components/common/StatusBadge";
import { workforceService } from "../../services/workforceService";
import { WorkforcePlan } from "../../../utils/types";

export default function JobPostingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [plan, setPlan]                   = useState<WorkforcePlan | null>(null);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectComment, setRejectComment] = useState("");

  useEffect(() => {
    if (!id) return;
    workforceService
      .getPlan(id)
      .then((res) => setPlan(res.data.data.plan))
      .catch(() => toast.error("Failed to load job posting"))
      .finally(() => setLoading(false));
  }, [id]);

  /** Approve — HR_APPROVED → APPROVED */
  const handleApprove = async () => {
    if (!plan) return;
    setActionLoading(true);
    try {
      await workforceService.reviewPlan(plan.id, "approve");
      toast.success(`"${plan.title}" approved. Headcount is now authorised.`);
      navigate("/review/ceo");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Approval failed";
      toast.error(msg);
      setActionLoading(false);
    }
  };

  /** Reject — HR_APPROVED → REJECTED */
  const handleReject = async () => {
    if (!plan) return;
    if (!rejectComment.trim()) {
      toast.error("A rejection reason is required.");
      return;
    }
    setActionLoading(true);
    try {
      await workforceService.reviewPlan(plan.id, "reject", rejectComment.trim());
      toast.success(`"${plan.title}" rejected.`);
      navigate("/review/ceo");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Rejection failed";
      toast.error(msg);
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="page-loading"><div className="loader-icon" /></div>;
  }

  if (!plan) {
    return (
      <div className="jp-not-found">
        <p>Job posting not found.</p>
        <Link to="/review/ceo" className="jp-back-link">← Back to job postings</Link>
      </div>
    );
  }

  const totalHc = plan.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
  const period  = plan.planning_period === "QUARTERLY" && plan.quarter
    ? `Q${plan.quarter} ${plan.fiscal_year}`
    : `Annual ${plan.fiscal_year}`;

  // Find key log entries for the sidebar
  const hrLog       = plan.approval_logs?.find((l) => l.action === "HR_APPROVED");
  const submitLog   = plan.approval_logs?.find((l) => l.action === "SUBMITTED");
  const isActionable = plan.status === "HR_APPROVED";

  return (
    <div className="jp-page">

      {/* ── Page header ── */}
      <div className="jp-page-header">
        <div className="jp-breadcrumb-row">
          <button
            className="jp-back-btn"
            onClick={() => navigate("/review/ceo")}
          >
            <FiArrowLeft size={16} />
            Job Postings
          </button>
          <span className="jp-breadcrumb-sep">›</span>
          <span className="jp-breadcrumb-title">{plan.title}</span>
        </div>
        <div className="jp-title-row">
          <h1 className="jp-title">{plan.title}</h1>
          <StatusBadge status={plan.status} />
        </div>
        <p className="jp-subtitle">
          {plan.department?.name} · {period} · {totalHc} position{totalHc !== 1 ? "s" : ""} · v{plan.version}
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="jp-grid">

        {/* ── Main column ── */}
        <div className="jp-main">

          {/* Section 1 — Basic Information */}
          <section className="jp-section">
            <div className="jp-section-header">
              <FiInfo size={17} className="jp-section-icon" />
              <h2 className="jp-section-title">Basic Information</h2>
            </div>
            <div className="jp-info-grid">
              <div className="jp-info-item">
                <span className="jp-info-label">Department</span>
                <span className="jp-info-value">{plan.department?.name ?? "—"}</span>
              </div>
              <div className="jp-info-item">
                <span className="jp-info-label">Fiscal Year</span>
                <span className="jp-info-value">{plan.fiscal_year}</span>
              </div>
              <div className="jp-info-item">
                <span className="jp-info-label">Planning Period</span>
                <span className="jp-info-value">{period}</span>
              </div>
              <div className="jp-info-item">
                <span className="jp-info-label">Total Headcount</span>
                <span className="jp-info-value jp-info-value-bold">{totalHc}</span>
              </div>
              {plan.start_date && (
                <div className="jp-info-item">
                  <span className="jp-info-label">Start Date</span>
                  <span className="jp-info-value">
                    {new Date(plan.start_date).toLocaleDateString()}
                  </span>
                </div>
              )}
              {plan.end_date && (
                <div className="jp-info-item">
                  <span className="jp-info-label">End Date</span>
                  <span className="jp-info-value">
                    {new Date(plan.end_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Section 2 — Requested Positions */}
          {plan.positions && plan.positions.length > 0 && (
            <section className="jp-section">
              <div className="jp-section-header">
                <FiUsers size={17} className="jp-section-icon" />
                <h2 className="jp-section-title">Requested Positions</h2>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr className="table-header-row">
                      <th className="table-heading">Position Title</th>
                      <th className="table-heading">Count</th>
                      <th className="table-heading">Employment Type</th>
                      <th className="table-heading">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.positions.map((pos, i) => (
                      <tr key={i} className="table-row">
                        <td className="table-cell table-cell-emphasis">{pos.title}</td>
                        <td className="table-cell">{pos.count}</td>
                        <td className="table-cell">
                          {pos.employment_type.replace(/_/g, " ")}
                        </td>
                        <td className="table-cell">
                          <StatusBadge status={pos.priority} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Section 3 — Business Justification */}
          <section className="jp-section">
            <div className="jp-section-header">
              <FiFileText size={17} className="jp-section-icon" />
              <h2 className="jp-section-title">Business Justification</h2>
            </div>
            <p className="jp-justification">
              {plan.justification || "No justification provided."}
            </p>
          </section>

          {/* Section 4 — Supporting Documents */}
          {plan.attachments && plan.attachments.length > 0 && (
            <section className="jp-section">
              <div className="jp-section-header">
                <FiFileText size={17} className="jp-section-icon" />
                <h2 className="jp-section-title">Supporting Documents</h2>
              </div>
              <ul className="jp-attachment-list">
                {plan.attachments.map((att) => (
                  <li key={att.id} className="jp-attachment-item">
                    <span className="jp-attachment-icon">
                      {att.mimetype?.includes("pdf")   ? "📄"
                       : att.mimetype?.includes("image") ? "🖼️"
                       : att.mimetype?.includes("sheet") ? "📊"
                       : "📎"}
                    </span>
                    <div className="jp-attachment-info">
                      <p className="jp-attachment-name">{att.filename}</p>
                      <p className="jp-attachment-meta">
                        {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ""}
                        {att.created_at
                          ? ` · ${new Date(att.created_at).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Section 5 — Approval History */}
          {plan.approval_logs && plan.approval_logs.length > 0 && (
            <section className="jp-section">
              <div className="jp-section-header">
                <FiClock size={17} className="jp-section-icon" />
                <h2 className="jp-section-title">Approval History</h2>
              </div>
              <ol className="jp-timeline">
                {plan.approval_logs.map((log, i) => (
                  <li key={log.id} className="jp-timeline-item">
                    <div className={`jp-timeline-dot ${i === 0 ? "jp-timeline-dot-first" : ""}`} />
                    <div className="jp-timeline-body">
                      <div className="jp-timeline-row">
                        <span className="jp-timeline-action">{log.action.replace(/_/g, " ")}</span>
                        <span className="jp-timeline-date">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      {log.actor && (
                        <p className="jp-timeline-actor">
                          by <strong>{log.actor.full_name}</strong>
                          <span className="jp-timeline-role"> ({log.actor.role.replace(/_/g, " ")})</span>
                        </p>
                      )}
                      {log.from_status && (
                        <p className="jp-timeline-transition">
                          <StatusBadge status={log.from_status} />
                          <span className="jp-timeline-arrow">→</span>
                          <StatusBadge status={log.to_status} />
                        </p>
                      )}
                      {log.comment && (
                        <p className="jp-timeline-comment">"{log.comment}"</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="jp-sidebar">

          {/* Status card */}
          <div className="jp-side-card">
            <p className="jp-side-label">Current Status</p>
            <StatusBadge status={plan.status} />
            <p className="jp-side-version">Version v{plan.version}</p>
          </div>

          {/* Submitted by */}
          <div className="jp-side-card">
            <p className="jp-side-label">
              <FiUser size={13} style={{ marginRight: 4 }} />
              Submitted By
            </p>
            <p className="jp-side-name">{plan.created_by?.full_name ?? "—"}</p>
            <p className="jp-side-email">{plan.created_by?.email ?? ""}</p>
            {submitLog && (
              <p className="jp-side-date">
                <FiCalendar size={12} style={{ marginRight: 4 }} />
                {new Date(submitLog.created_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* HR approval info */}
          {hrLog && (
            <div className="jp-side-card jp-side-card-hr">
              <p className="jp-side-label">
                <FiCheckCircle size={13} style={{ marginRight: 4, color: "#16a34a" }} />
                HR Approved By
              </p>
              <p className="jp-side-name">{hrLog.actor?.full_name ?? "HR"}</p>
              <p className="jp-side-date">
                <FiCalendar size={12} style={{ marginRight: 4 }} />
                {new Date(hrLog.created_at).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Action card — only shown when the plan is still actionable */}
          {isActionable && (
            <div className="jp-side-card jp-side-card-actions">
              <p className="jp-side-label">Your Decision</p>

              {showRejectBox ? (
                <>
                  <textarea
                    className="jp-reject-textarea"
                    placeholder="Required: explain why this job posting is being rejected..."
                    rows={4}
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                  />
                  <div className="jp-action-btn-row">
                    <button
                      className="jp-btn jp-btn-cancel"
                      onClick={() => { setShowRejectBox(false); setRejectComment(""); }}
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                    <button
                      className="jp-btn jp-btn-reject"
                      onClick={handleReject}
                      disabled={actionLoading || !rejectComment.trim()}
                    >
                      {actionLoading
                        ? <span className="btn-spinner" />
                        : <FiXCircle size={15} />}
                      Confirm Rejection
                    </button>
                  </div>
                </>
              ) : (
                <div className="jp-action-btn-col">
                  <button
                    className="jp-btn jp-btn-approve"
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    {actionLoading
                      ? <span className="btn-spinner" />
                      : <FiCheckCircle size={15} />}
                    Approve Job Posting
                  </button>
                  <button
                    className="jp-btn jp-btn-reject-init"
                    onClick={() => setShowRejectBox(true)}
                    disabled={actionLoading}
                  >
                    <FiXCircle size={15} />
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
