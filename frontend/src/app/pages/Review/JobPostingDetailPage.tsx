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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg text-slate-700">Job posting not found.</p>
        <Link to="/review/ceo" className="text-green-600 hover:text-green-700 font-semibold">← Back to job postings</Link>
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
    <div className="flex flex-col gap-6 pb-8">

      {/* ── Page header ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-slate-600 font-semibold"
            onClick={() => navigate("/review/ceo")}
          >
            <FiArrowLeft size={16} />
            Job Postings
          </button>
          <span className="text-slate-400">›</span>
          <span className="text-slate-600 font-medium">{plan.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{plan.title}</h1>
          <StatusBadge status={plan.status} />
        </div>
        <p className="text-sm text-slate-600">
          {plan.department?.name} · {period} · {totalHc} position{totalHc !== 1 ? "s" : ""} · v{plan.version}
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Main column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1 — Basic Information */}
          <section className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <FiInfo size={17} className="text-green-600" />
              <h2 className="text-lg font-bold text-slate-900">Basic Information</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Department</span>
                <span className="block text-sm font-semibold text-slate-900">{plan.department?.name ?? "—"}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fiscal Year</span>
                <span className="block text-sm font-semibold text-slate-900">{plan.fiscal_year}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Planning Period</span>
                <span className="block text-sm font-semibold text-slate-900">{period}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Headcount</span>
                <span className="block text-sm font-bold text-green-700">{totalHc}</span>
              </div>
            </div>
          </section>

          {/* Section 2 — Requested Positions */}
          {plan.positions && plan.positions.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FiUsers size={17} className="text-green-600" />
                <h2 className="text-lg font-bold text-slate-900">Requested Positions</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-2.5 px-3 font-bold text-slate-700">Position Title</th>
                      <th className="text-left py-2.5 px-3 font-bold text-slate-700">Count</th>
                      <th className="text-left py-2.5 px-3 font-bold text-slate-700">Employment Type</th>
                      <th className="text-left py-2.5 px-3 font-bold text-slate-700">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.positions.map((pos, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{pos.title}</td>
                        <td className="py-2.5 px-3 text-slate-700">{pos.count}</td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {pos.employment_type.replace(/_/g, " ")}
                        </td>
                        <td className="py-2.5 px-3">
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
          <section className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <FiFileText size={17} className="text-green-600" />
              <h2 className="text-lg font-bold text-slate-900">Business Justification</h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {plan.justification || "No justification provided."}
            </p>
          </section>

          {/* Section 4 — Supporting Documents */}
          {plan.attachments && plan.attachments.length > 0 && (
            <section className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FiFileText size={17} className="text-green-600" />
                <h2 className="text-lg font-bold text-slate-900">Supporting Documents</h2>
              </div>
              <ul className="space-y-3">
                {plan.attachments.map((att) => (
                  <li key={att.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-gray-200">
                    <span className="text-2xl flex-shrink-0">
                      {att.mimetype?.includes("pdf")   ? "📄"
                       : att.mimetype?.includes("image") ? "🖼️"
                       : att.mimetype?.includes("sheet") ? "📊"
                       : "📎"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{att.filename}</p>
                      <p className="text-xs text-slate-500">
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
            <section className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FiClock size={17} className="text-green-600" />
                <h2 className="text-lg font-bold text-slate-900">Approval History</h2>
              </div>
              <ol className="space-y-4">
                {plan.approval_logs.map((log, i) => (
                  <li key={log.id} className="relative pl-6 pb-4 border-l-2 border-gray-200 last:border-l-0 last:pb-0">
                    <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full ${i === 0 ? "bg-green-600" : "bg-gray-300"} border-2 border-white`} />
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">{log.action.replace(/_/g, " ")}</span>
                        <span className="text-xs text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      {log.actor && (
                        <p className="text-sm text-slate-600 mb-1">
                          by <strong className="text-slate-900">{log.actor.full_name}</strong>
                          <span className="text-slate-500"> ({log.actor.role.replace(/_/g, " ")})</span>
                        </p>
                      )}
                      {log.from_status && (
                        <p className="flex items-center gap-2 mb-1">
                          <StatusBadge status={log.from_status} />
                          <span className="text-slate-400">→</span>
                          <StatusBadge status={log.to_status} />
                        </p>
                      )}
                      {log.comment && (
                        <p className="text-sm text-slate-600 italic mt-2 bg-slate-50 p-2 rounded-lg border-l-2 border-slate-300">"{log.comment}"</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">

          {/* Status card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Current Status</p>
            <StatusBadge status={plan.status} />
            <p className="text-sm text-slate-600 mt-2">Version v{plan.version}</p>
          </div>

          {/* Submitted by */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1">
              <FiUser size={13} />
              Submitted By
            </p>
            <p className="text-sm font-bold text-slate-900">{plan.created_by?.full_name ?? "—"}</p>
            <p className="text-xs text-slate-600 mt-1">{plan.created_by?.email ?? ""}</p>
            {submitLog && (
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <FiCalendar size={12} />
                {new Date(submitLog.created_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* HR approval info */}
          {hrLog && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3 flex items-center gap-1">
                <FiCheckCircle size={13} />
                HR Approved By
              </p>
              <p className="text-sm font-bold text-slate-900">{hrLog.actor?.full_name ?? "HR"}</p>
              <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                <FiCalendar size={12} />
                {new Date(hrLog.created_at).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Action card — only shown when the plan is still actionable */}
          {isActionable && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Your Decision</p>

              {showRejectBox ? (
                <div className="space-y-3">
                  <textarea
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Required: explain why this job posting is being rejected..."
                    rows={4}
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 text-slate-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => { setShowRejectBox(false); setRejectComment(""); }}
                      disabled={actionLoading}
                    >
                      Cancel
                    </button>
                    <button
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleReject}
                      disabled={actionLoading || !rejectComment.trim()}
                    >
                      {actionLoading ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FiXCircle size={15} />
                      )}
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    onClick={handleApprove}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiCheckCircle size={15} />
                    )}
                    Approve Job Posting
                  </button>
                  <button
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
