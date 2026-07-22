/**
 * pages/Review/HRReviewPage.tsx
 *
 * Exclusive to the HR role. Shows every SUBMITTED workforce plan for review.
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
  const [reviewState, setReviewState] = useState<Record<string, CardReviewState>>({});

  useEffect(() => {
    workforceService
      .getPlans()
      .then((res) => {
        const fetched: WorkforcePlan[] = res.data.data.plans;
        setPlans(fetched);
        const init: Record<string, CardReviewState> = {};
        fetched.forEach((p) => {
          init[p.id] = { comment: "", loading: false, showRejectBox: false, expanded: false };
        });
        setReviewState(init);
      })
      .catch(() => toast.error("Failed to load plans"))
      .finally(() => setLoading(false));
  }, []);

  const patch = (planId: string, update: Partial<CardReviewState>) =>
    setReviewState((prev) => ({ ...prev, [planId]: { ...prev[planId], ...update } }));

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

  const handleReject = async (plan: WorkforcePlan) => {
    const state = reviewState[plan.id];
    if (!state?.comment.trim()) { toast.error("Please enter a rejection reason before rejecting."); return; }
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-green-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">HR Review Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Workforce plans submitted by planners and awaiting your decision.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 px-3 py-1 text-sm font-semibold">
          {plans.length} pending
        </span>
      </div>

      {/* Empty state */}
      {plans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center bg-white rounded-xl border border-slate-200">
          <FiCheckCircle size={40} className="text-green-400" />
          <p className="text-base font-semibold text-slate-700">All caught up!</p>
          <p className="text-sm text-slate-400">No workforce plans are waiting for your review.</p>
        </div>
      )}

      {/* Plan cards */}
      <div className="flex flex-col gap-4">
        {plans.map((plan) => {
          const state = reviewState[plan.id] ?? { comment: "", loading: false, showRejectBox: false, expanded: false };
          const totalHc = plan.positions?.reduce((s, p) => s + p.count, 0) ?? 0;
          const period = plan.planning_period === "QUARTERLY" && plan.quarter
            ? `Q${plan.quarter} ${plan.fiscal_year}` : `Annual ${plan.fiscal_year}`;

          return (
            <div key={plan.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Card header */}
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-base font-semibold text-slate-800">{plan.title}</h2>
                    <StatusBadge status={plan.status} />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {[plan.department?.name, period, `${totalHc} positions`, `v${plan.version}`].filter(Boolean).map((tag, i) => (
                      <span key={i} className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">
                    Submitted by <strong className="text-slate-700">{plan.created_by?.full_name ?? "—"}</strong>
                    {plan.approval_logs?.find((l) => l.action === "SUBMITTED")?.created_at
                      ? ` on ${new Date(plan.approval_logs.find((l) => l.action === "SUBMITTED")!.created_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <button
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors flex-shrink-0"
                  onClick={() => patch(plan.id, { expanded: !state.expanded })}
                  title={state.expanded ? "Collapse details" : "Expand details"}
                >
                  {state.expanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                </button>
              </div>
              {/* Expanded details */}
              {state.expanded && (
                <div className="bg-slate-50 p-5 border-t border-slate-100 space-y-4">
                  {plan.justification && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Business Justification</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{plan.justification}</p>
                    </div>
                  )}

                  {plan.positions && plan.positions.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Positions</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-300">
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Title</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Count</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Type</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Priority</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.positions.map((pos, i) => (
                              <tr key={i} className="border-b border-slate-100">
                                <td className="py-2 px-2 text-slate-800">{pos.title}</td>
                                <td className="py-2 px-2 text-slate-600">{pos.count}</td>
                                <td className="py-2 px-2 text-slate-600">{pos.employment_type.replace("_", " ")}</td>
                                <td className="py-2 px-2"><StatusBadge status={pos.priority} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {plan.attachments && plan.attachments.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FiFileText size={13} />
                        Attachments
                      </p>
                      <ul className="space-y-2">
                        {plan.attachments.map((att) => (
                          <li key={att.id} className="flex items-center gap-2 text-sm">
                            <span>📎</span>
                            <span className="flex-1 text-slate-700">{att.filename}</span>
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

              {/* Action bar */}
              <div className="p-5 bg-white border-t border-slate-100">
                {state.showRejectBox ? (
                  <div className="space-y-3">
                    <textarea
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Required: explain why this plan is being rejected..."
                      rows={3}
                      value={state.comment}
                      onChange={(e) => patch(plan.id, { comment: e.target.value })}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                        onClick={() => patch(plan.id, { showRejectBox: false, comment: "" })}
                        disabled={state.loading}
                      >
                        Cancel
                      </button>
                      <button
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
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
                  <div className="flex justify-end gap-2">
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                      onClick={() => patch(plan.id, { showRejectBox: true })}
                      disabled={state.loading}
                    >
                      <FiXCircle size={15} />
                      Reject
                    </button>
                    <button
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
                      onClick={() => handleApprove(plan)}
                      disabled={state.loading}
                    >
                      {state.loading ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FiCheckCircle size={15} />
                      )}
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
