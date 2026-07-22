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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── Page header ── */}
      <div className="flex justify-between items-start pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Job Postings — CEO Approval</h1>
          <p className="text-sm text-slate-500 mt-1">
            Workforce plans approved by HR and awaiting your final authorisation.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-gradient-to-br from-green-50 to-green-100 text-green-700 text-sm font-bold shadow-sm">
          {plans.length} pending
        </span>
      </div>

      {/* ── Empty state ── */}
      {plans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-white border border-gray-200 rounded-2xl">
          <FiCheckCircle size={40} className="text-green-600 mb-4" />
          <p className="text-lg font-bold text-slate-900">No pending approvals</p>
          <p className="text-sm text-slate-500 mt-1">There are no job postings waiting for your sign-off.</p>
        </div>
      )}

      {/* ── Plan cards ── */}
      <div className="flex flex-col gap-5">
        {plans.map((plan) => {
          const state = cardState[plan.id] ?? { comment: "", loading: false, showRejectBox: false, expanded: false };
          const totalHc = plan.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
          const period = plan.planning_period === "QUARTERLY" && plan.quarter
            ? `Q${plan.quarter} ${plan.fiscal_year}`
            : `Annual ${plan.fiscal_year}`;

          // Find the HR approval log entry for the approved-by line
          const hrLog = plan.approval_logs?.find((l) => l.action === "HR_APPROVED");

          return (
            <div key={plan.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* ── Card header ── */}
              <div className="flex justify-between items-start p-6 border-b border-gray-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-bold text-slate-900">{plan.title}</h2>
                    <StatusBadge status={plan.status} />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">{plan.department?.name}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">{period}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">{totalHc} positions</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">v{plan.version}</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Submitted by <strong>{plan.created_by?.full_name ?? "—"}</strong>
                    {hrLog && (
                      <> · HR approved by <strong>{hrLog.actor?.full_name ?? "HR"}</strong>
                        {" on "}{new Date(hrLog.created_at).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                <button
                  className="p-2 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
                  onClick={() => patch(plan.id, { expanded: !state.expanded })}
                  title={state.expanded ? "Collapse" : "Expand details"}
                >
                  {state.expanded ? <FiChevronUp size={18} className="text-slate-600" /> : <FiChevronDown size={18} className="text-slate-600" />}
                </button>
              </div>

              {/* ── Expanded details ── */}
              {state.expanded && (
                <div className="px-6 py-4 bg-slate-50 space-y-6">
                  {plan.justification && (
                    <div>
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Business Justification</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{plan.justification}</p>
                    </div>
                  )}

                  {plan.positions && plan.positions.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Positions Requested</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-300">
                              <th className="text-left py-2 px-3 font-bold text-slate-700">Title</th>
                              <th className="text-left py-2 px-3 font-bold text-slate-700">Count</th>
                              <th className="text-left py-2 px-3 font-bold text-slate-700">Type</th>
                              <th className="text-left py-2 px-3 font-bold text-slate-700">Priority</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.positions.map((pos, i) => (
                              <tr key={i} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-slate-900">{pos.title}</td>
                                <td className="py-2 px-3 text-slate-700">{pos.count}</td>
                                <td className="py-2 px-3 text-slate-700">{pos.employment_type.replace("_", " ")}</td>
                                <td className="py-2 px-3"><StatusBadge status={pos.priority} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {plan.attachments && plan.attachments.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FiFileText size={13} />
                        Supporting Documents
                      </p>
                      <ul className="space-y-2">
                        {plan.attachments.map((att) => (
                          <li key={att.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                            <span className="text-xl">📎</span>
                            <span className="flex-1 text-sm font-medium text-slate-900">{att.filename}</span>
                            <span className="text-xs text-slate-500">
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
              <div className="px-6 py-4 bg-white border-t border-gray-100">
                {state.showRejectBox ? (
                  <div className="space-y-3">
                    <textarea
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Required: explain why this job posting is being rejected..."
                      rows={3}
                      value={state.comment}
                      onChange={(e) => patch(plan.id, { comment: e.target.value })}
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        className="px-4 py-2 rounded-lg border border-gray-300 text-slate-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => patch(plan.id, { showRejectBox: false, comment: "" })}
                        disabled={state.loading}
                      >
                        Cancel
                      </button>
                      <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleReject(plan)}
                        disabled={state.loading || !state.comment.trim()}
                      >
                        {state.loading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FiXCircle size={15} />
                        )}
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-3">
                    {/* View — opens the full job posting detail page */}
                    <Link
                      to={`/review/ceo/${plan.id}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-slate-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                      <FiEye size={15} />
                      View
                    </Link>
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => patch(plan.id, { showRejectBox: true })}
                      disabled={state.loading}
                    >
                      <FiXCircle size={15} />
                      Reject
                    </button>
                    <button
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      onClick={() => handleApprove(plan)}
                      disabled={state.loading}
                    >
                      {state.loading ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FiCheckCircle size={15} />
                      )}
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
