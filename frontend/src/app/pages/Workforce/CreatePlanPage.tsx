import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  FiInfo,
  FiUserPlus,
  FiFileText,
  FiTrash2,
  FiSend,
  FiSave,
  FiCheckCircle,
  FiCircle,
  FiPaperclip,
  FiUpload,
  FiX,
} from "react-icons/fi";
import toast from "react-hot-toast";
import Button from "../../components/Core/ui/Button";
import StatusBadge from "../../components/common/StatusBadge";
import { workforceService } from "../../services/workforceService";
import { Department, PlanAttachment, PlanPosition, WorkforcePlan } from "../../../utils/types";
import { useAuth } from "../../context/AuthContext";

const emptyPosition = (): PlanPosition => ({
  title: "",
  count: 1,
  employment_type: "FULL_TIME",
  priority: "MEDIUM",
});

export default function CreatePlanPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [plan, setPlan] = useState<WorkforcePlan | null>(null);
  const [form, setForm] = useState({
    title: "",
    department_id: "",
    fiscal_year: 2025,
    planning_period: "ANNUAL" as "ANNUAL" | "QUARTERLY",
    quarter: 1,
    justification: "",
  });
  const [positions, setPositions] = useState<PlanPosition[]>([emptyPosition()]);
  const [attachments, setAttachments] = useState<PlanAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);

  useEffect(() => {
    setDeptLoading(true);
    workforceService
      .getDepartments()
      .then((res) => {
        const depts = res.data.data.departments as Department[];
        setDepartments(depts);
        if (!id && depts.length) {
          setForm((f) => ({ ...f, department_id: f.department_id || depts[0].id }));
        }
      })
      .catch(() => toast.error("Failed to load departments"))
      .finally(() => setDeptLoading(false));

    if (id) {
      setLoading(true);
      workforceService
        .getPlan(id)
        .then((res) => {
          const p = res.data.data.plan;
          setPlan(p);
          setForm({
            title: p.title,
            department_id: p.department_id,
            fiscal_year: p.fiscal_year,
            planning_period: p.planning_period,
            quarter: p.quarter || 1,
            justification: p.justification || "",
          });
          setPositions(p.positions?.length ? p.positions : [emptyPosition()]);
          setAttachments(p.attachments ?? []);
        })
        .catch(() => toast.error("Failed to load plan"))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const totalHeadcount = positions.reduce((s, p) => s + (Number(p.count) || 0), 0);
  const isEditable = !plan || ["DRAFT", "SUBMITTED", "REJECTED"].includes(plan.status);

  const handleSaveDraft = async (newVersion = false) => {
    if (!form.title) { toast.error("Plan title is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, positions, save_as_new_version: newVersion };
      if (isEdit && id) {
        await workforceService.updatePlan(id, payload);
        toast.success(newVersion ? "New version saved" : "Draft saved");
      } else {
        const res = await workforceService.createPlan(payload);
        toast.success("Draft created");
        navigate(`/workforce/plans/${res.data.data.plan.id}`, { replace: true });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to save";
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!form.justification || positions.every((p) => !p.title)) {
      toast.error("Justification and at least one position are required");
      return;
    }
    setSaving(true);
    try {
      let planId = id;
      if (!planId) {
        const res = await workforceService.createPlan({ ...form, positions });
        planId = res.data.data.plan.id;
      } else {
        await workforceService.updatePlan(planId, { ...form, positions });
      }
      await workforceService.submitPlan(planId!);
      toast.success("Plan submitted for approval!");
      navigate("/workforce/planning");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Submission failed";
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!plan) return;
    if (!window.confirm(`Delete "${plan.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await workforceService.deletePlan(plan.id);
      toast.success("Plan deleted");
      navigate("/workforce/planning");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to delete";
      toast.error(msg);
    } finally { setDeleting(false); }
  };

  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const allowed = [
      "application/pdf","application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg","image/png","image/gif",
    ];
    const maxBytes = 10 * 1024 * 1024;
    const valid: File[] = [];
    for (const file of picked) {
      if (!allowed.includes(file.type)) { toast.error(`"${file.name}" — unsupported type.`); continue; }
      if (file.size > maxBytes) { toast.error(`"${file.name}" exceeds 10 MB limit.`); continue; }
      if (!pendingFiles.some((f) => f.name === file.name && f.size === file.size)) valid.push(file);
    }
    if (valid.length) setPendingFiles((prev) => [...prev, ...valid]);
  };

  const handleUploadPending = async () => {
    if (pendingFiles.length === 0) return;
    let planId = id;
    if (!planId) {
      if (!form.title) { toast.error("Add a plan title before uploading files."); return; }
      setSaving(true);
      try {
        const res = await workforceService.createPlan({ ...form, positions });
        planId = res.data.data.plan.id;
        navigate(`/workforce/plans/${planId}`, { replace: true });
      } catch { toast.error("Failed to save draft before uploading."); setSaving(false); return; }
      setSaving(false);
    }
    for (const file of pendingFiles) {
      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 1 }));
        const res = await workforceService.uploadAttachment(planId!, file, (pct) =>
          setUploadProgress((prev) => ({ ...prev, [file.name]: pct }))
        );
        setAttachments((prev) => [...prev, res.data.data.attachment]);
        setUploadProgress((prev) => { const n = { ...prev }; delete n[file.name]; return n; });
        toast.success(`"${file.name}" uploaded`);
      } catch {
        toast.error(`Failed to upload "${file.name}"`);
        setUploadProgress((prev) => { const n = { ...prev }; delete n[file.name]; return n; });
      }
    }
    setPendingFiles([]);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!id) return;
    setDeletingAttachmentId(attachmentId);
    try {
      await workforceService.deleteAttachment(id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("Attachment removed");
    } catch { toast.error("Failed to remove attachment"); }
    finally { setDeletingAttachmentId(null); }
  };

  const addPosition = () => setPositions([...positions, emptyPosition()]);
  const removePosition = (idx: number) => {
    if (positions.length === 1) return;
    setPositions(positions.filter((_, i) => i !== idx));
  };
  const updatePosition = (idx: number, field: keyof PlanPosition, value: string | number) => {
    setPositions(positions.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-green-600" />
      </div>
    );
  }

  const currentStatus = plan?.status ?? "DRAFT";
  const workflowSteps = [
    {
      label: "Draft",
      desc: currentStatus === "DRAFT" ? "Currently editing" : "Completed",
      active: currentStatus === "DRAFT",
      done: !["DRAFT"].includes(currentStatus),
    },
    {
      label: "Submitted to HR",
      desc: currentStatus === "SUBMITTED" ? "Awaiting HR review" : currentStatus === "DRAFT" ? "Pending submission" : "Completed",
      active: currentStatus === "SUBMITTED",
      done: !["DRAFT", "SUBMITTED"].includes(currentStatus),
    },
    {
      label: "HR Approval",
      desc: currentStatus === "HR_APPROVED" ? "Forwarded to CEO" : currentStatus === "REJECTED" ? "Rejected — revision needed" : "Pending",
      active: currentStatus === "HR_APPROVED" || currentStatus === "REJECTED",
      done: currentStatus === "APPROVED",
    },
    {
      label: "CEO Approval",
      desc: currentStatus === "APPROVED" ? "Approved — headcount authorised" : "Pending",
      active: currentStatus === "APPROVED",
      done: false,
    },
  ];

  // Shared input/select classes
  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 text-slate-800 bg-white placeholder:text-slate-400 transition-colors disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mb-1">
            <Link to="/workforce/planning" className="text-green-600 hover:underline font-medium">
              Workforce Planning
            </Link>
            {" › "}
            {isEdit ? "Edit Plan" : "Create Plan"}
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEdit ? "Edit Workforce Plan" : "New Workforce Plan"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Define strategic staffing requirements for the upcoming planning cycle.
          </p>
        </div>

        {isEditable && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              icon={<FiSave size={16} />}
              loading={saving}
              onClick={() => handleSaveDraft(false)}
            >
              {plan?.status === "SUBMITTED" ? "Withdraw & Save" : plan?.status === "REJECTED" ? "Save Revision" : "Save Draft"}
            </Button>
            <Button icon={<FiSend size={16} />} loading={saving} onClick={handleSubmit}>
              {plan?.status === "REJECTED" ? `Resubmit (v${plan?.version})` : "Submit for Approval"}
            </Button>
            {(plan?.status === "DRAFT" || plan?.status === "SUBMITTED") && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <FiTrash2 size={16} />
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Warning banner */}
      {plan?.status === "SUBMITTED" && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <span className="text-lg leading-none">⚠️</span>
          <p>
            This plan is currently <strong>awaiting approval</strong>. Saving
            changes will withdraw it from review and reset it to Draft.
          </p>
        </div>
      )}

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
        {/* Main column */}
        <div className="flex flex-col gap-5">

          {/* Section 1: Basic Information */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <FiInfo className="text-green-600" size={18} />
              <h2 className="text-base font-semibold text-slate-800">Basic Information</h2>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Plan Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g Department Expansion" disabled={!isEditable} className={inputCls} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Department</label>
                  <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                    disabled={!isEditable || deptLoading} className={inputCls}>
                    {deptLoading && <option value="">Loading departments…</option>}
                    {!deptLoading && departments.length === 0 && <option value="">No departments found</option>}
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Planning Year</label>
                  <select value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: Number(e.target.value) })}
                    disabled={!isEditable} className={inputCls}>
                    {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Planning Period</label>
                  <div className="flex items-center gap-4 pt-1">
                    {(["ANNUAL", "QUARTERLY"] as const).map((p) => (
                      <label key={p} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input type="radio" name="planning_period" checked={form.planning_period === p}
                          onChange={() => setForm({ ...form, planning_period: p })} disabled={!isEditable} />
                        {p.charAt(0) + p.slice(1).toLowerCase()}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {form.planning_period === "QUARTERLY" && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Quarter</label>
                  <select value={form.quarter} onChange={(e) => setForm({ ...form, quarter: Number(e.target.value) })}
                    disabled={!isEditable} className={inputCls}>
                    {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Headcount Definition */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FiUserPlus className="text-green-600" size={18} />
                <h2 className="text-base font-semibold text-slate-800">Headcount Definition</h2>
              </div>
              {isEditable && <Button variant="secondary" onClick={addPosition}>Add Position</Button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Position Title</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 w-20">Count</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Employment Type</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Priority</th>
                    {isEditable && <th className="px-4 py-3 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, idx) => (
                    <tr key={idx} className="border-b border-slate-50">
                      <td className="px-4 py-2.5">
                        <input value={pos.title} onChange={(e) => updatePosition(idx, "title", e.target.value)}
                          placeholder="Position title" disabled={!isEditable} className={inputCls} />
                      </td>
                      <td className="px-4 py-2.5">
                        <input type="number" min={1} value={pos.count} onChange={(e) => updatePosition(idx, "count", Number(e.target.value))}
                          disabled={!isEditable} className={inputCls} />
                      </td>
                      <td className="px-4 py-2.5">
                        <select value={pos.employment_type} onChange={(e) => updatePosition(idx, "employment_type", e.target.value)}
                          disabled={!isEditable} className={inputCls}>
                          <option value="FULL_TIME">Full-time</option>
                          <option value="PART_TIME">Part-time</option>
                          <option value="CONTRACT">Contract</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <select value={pos.priority} onChange={(e) => updatePosition(idx, "priority", e.target.value)}
                          disabled={!isEditable} className={inputCls}>
                          <option value="HIGH">High</option>
                          <option value="MEDIUM">Med</option>
                          <option value="LOW">Low</option>
                        </select>
                      </td>
                      {isEditable && (
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => removePosition(idx)}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove">
                            <FiTrash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Justification */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <FiFileText className="text-green-600" size={18} />
              <h2 className="text-base font-semibold text-slate-800">Justification</h2>
            </div>
            <div className="p-5">
              <textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })}
                placeholder="Provide the operational reason and business case for this headcount request..."
                rows={5} disabled={!isEditable}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 text-slate-800 placeholder:text-slate-400 resize-none transition-colors disabled:bg-slate-50 disabled:text-slate-400" />
            </div>
          </section>

          {/* Section 4: Supporting Documents */}
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FiPaperclip className="text-green-600" size={18} />
                <h2 className="text-base font-semibold text-slate-800">Supporting Documents</h2>
              </div>
              {(attachments.length > 0 || pendingFiles.length > 0) && (
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                  {attachments.length + pendingFiles.length} file{attachments.length + pendingFiles.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="p-5 flex flex-col gap-3">
              {attachments.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {attachments.map((att) => (
                    <li key={att.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                      <span className="text-lg">
                        {att.mimetype?.includes("pdf") ? "📄" : att.mimetype?.includes("image") ? "🖼️" : att.mimetype?.includes("sheet") || att.mimetype?.includes("excel") ? "📊" : "📎"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{att.filename}</p>
                        <p className="text-xs text-slate-500">
                          {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ""}
                          {att.created_at ? ` · ${new Date(att.created_at).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      {isEditable && (
                        <button className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          onClick={() => handleDeleteAttachment(att.id)} disabled={deletingAttachmentId === att.id} title="Remove attachment">
                          <FiX size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {pendingFiles.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {pendingFiles.map((file) => {
                    const pct = uploadProgress[file.name];
                    const isUploading = pct !== undefined;
                    return (
                      <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                        <span className="text-lg">📎</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                          {isUploading ? (
                            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600">{(file.size / 1024).toFixed(1)} KB · Pending upload</p>
                          )}
                        </div>
                        {!isUploading && (
                          <button className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => setPendingFiles((prev) => prev.filter((f) => !(f.name === file.name && f.size === file.size)))}
                            title="Remove from queue">
                            <FiX size={14} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {attachments.length === 0 && pendingFiles.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No supporting documents attached yet.</p>
              )}
              {isEditable && (
                <div className="flex items-center gap-3 mt-1">
                  <input id="attachment-file-input" type="file" multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                    className="sr-only" onChange={handleFilesPicked} />
                  <label htmlFor="attachment-file-input"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                    <FiPaperclip size={15} />
                    Choose files
                  </label>
                  {pendingFiles.length > 0 && (
                    <Button variant="primary" icon={<FiUpload size={15} />} onClick={handleUploadPending} loading={saving}>
                      Upload {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-4">
          {plan && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Current Status</p>
              <StatusBadge status={plan.status} />
            </div>
          )}

          {/* Approval workflow */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Approval Workflow</h3>
            <div className="flex flex-col gap-3">
              {workflowSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {step.active || step.done ? (
                    <FiCheckCircle className={step.done ? "text-slate-300" : "text-green-500"} size={18} />
                  ) : (
                    <FiCircle className="text-slate-300" size={18} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 leading-tight">{step.label}</p>
                    <p className="text-xs text-slate-500 leading-tight mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Plan Summary</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total Headcount</span>
                <span className="font-semibold text-slate-800">{totalHeadcount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Positions Defined</span>
                <span className="font-semibold text-slate-800">{positions.filter((p) => p.title).length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Attachments</span>
                <span className="font-semibold text-slate-800">{attachments.length}</span>
              </div>
              {plan && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Current Version</span>
                  <span className="font-semibold text-slate-800">v{plan.version}</span>
                </div>
              )}
              {plan && (plan.status === "REJECTED" || plan.status === "SUBMITTED") && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Next Save Will Be</span>
                  <span className="font-semibold text-green-600">v{plan.version + 1}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Last saved by {user?.full_name || "You"}
            </p>
            {isEdit && isEditable && plan?.status === "DRAFT" && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <Button variant="ghost" onClick={() => handleSaveDraft(true)} fullWidth>
                  Save as New Version (v{(plan?.version || 0) + 1})
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
