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

/** Returns a blank position row — used when adding a new row to the table */
const emptyPosition = (): PlanPosition => ({
  title: "",
  count: 1,
  employment_type: "FULL_TIME",
  priority: "MEDIUM",
});

export default function CreatePlanPage() {
  // If :id param is present we're in edit mode; otherwise we're creating
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  // Department list for the dropdown — fetched once on mount
  const [departments, setDepartments] = useState<Department[]>([]);

  // Loading state for the initial plan fetch (edit mode only)
  const [loading, setLoading] = useState(false);

  // Saving covers both "Save Draft" and "Submit for Approval" calls
  const [saving, setSaving] = useState(false);

  // Separate state for the delete operation so its button can be disabled
  const [deleting, setDeleting] = useState(false);

  // The loaded plan object (null in create mode)
  const [plan, setPlan] = useState<WorkforcePlan | null>(null);

  // All scalar form fields in one controlled object
  const [form, setForm] = useState({
    title: "",
    department_id: "",
    fiscal_year: 2025,
    planning_period: "ANNUAL" as "ANNUAL" | "QUARTERLY",
    quarter: 1,
    start_date: "",
    end_date: "",
    justification: "",
  });

  // Array of position rows shown in the headcount table
  const [positions, setPositions] = useState<PlanPosition[]>([emptyPosition()]);

  // Attachments already saved on the server (loaded with the plan in edit mode)
  const [attachments, setAttachments] = useState<PlanAttachment[]>([]);

  // Files the user has picked locally but not yet uploaded (pending queue)
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Upload progress per filename — key: file.name, value: 0-100
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // ID of the attachment currently being deleted (disables its remove button)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);

  /**
   * On mount:
   *   1. Fetch the department list to populate the dropdown.
   *      Pre-selects the first department if none is already set.
   *   2. If in edit mode, fetch the existing plan and hydrate the form.
   */

  useEffect(() => {
    workforceService.getDepartments().then((res) => {
      setDepartments(res.data.data.departments);
      if (!form.department_id && res.data.data.departments.length) {
        setForm((f) => ({
          ...f,
          department_id: res.data.data.departments[0].id,
        }));
      }
    });

    if (id) {
      setLoading(true);
      workforceService
        .getPlan(id)
        .then((res) => {
          const p = res.data.data.plan;
          setPlan(p);
          // Populate form with existing plan data
          setForm({
            title: p.title,
            department_id: p.department_id,
            fiscal_year: p.fiscal_year,
            planning_period: p.planning_period,
            quarter: p.quarter || 1,
            // Strip the time portion from ISO date strings for the date inputs
            start_date: p.start_date?.split("T")[0] || "",
            end_date: p.end_date?.split("T")[0] || "",
            justification: p.justification || "",
          });
          setPositions(p.positions?.length ? p.positions : [emptyPosition()]);
          setAttachments(p.attachments ?? []);
        })
        .catch(() => toast.error("Failed to load plan"))
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Live-computed headcount total shown in the Plan Summary card
  const totalHeadcount = positions.reduce(
    (s, p) => s + (Number(p.count) || 0),
    0,
  );

  /**
   * isEditable — determines whether form fields and action buttons are active.
   * Plans in HR_REVIEW, CEO_REVIEW, APPROVED, etc. are read-only.
   */
  const isEditable =
    !plan || ["DRAFT", "SUBMITTED", "REJECTED"].includes(plan.status);

  /**
   * handleSaveDraft
   * Saves the plan as DRAFT without submitting it for approval.
   * @param newVersion — when true, increments the version number and creates
   *                     a PlanVersion snapshot for the history log.
   */
  const handleSaveDraft = async (newVersion = false) => {
    if (!form.title) {
      toast.error("Plan title is required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, positions, save_as_new_version: newVersion };
      if (isEdit && id) {
        // Update existing plan
        await workforceService.updatePlan(id, payload);
        toast.success(newVersion ? "New version saved" : "Draft saved");
      } else {
        // Create a new plan and navigate to its edit URL
        const res = await workforceService.createPlan(payload);
        toast.success("Draft created");
        navigate(`/workforce/plans/${res.data.data.plan.id}`, {
          replace: true,
        });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /**
   * handleSubmit
   * Validates required fields, then creates/updates the plan and submits it
   * for approval in a single flow. Navigates to /workforce/planning on success.
   */
  const handleSubmit = async () => {
    if (!form.justification || positions.every((p) => !p.title)) {
      toast.error("Justification and at least one position are required");
      return;
    }
    setSaving(true);
    try {
      let planId = id;
      if (!planId) {
        // Create the plan first if we're in create mode
        const res = await workforceService.createPlan({ ...form, positions });
        planId = res.data.data.plan.id;
      } else {
        // Save latest edits before submitting
        await workforceService.updatePlan(planId, { ...form, positions });
      }
      // Transition from DRAFT → SUBMITTED
      await workforceService.submitPlan(planId!);
      toast.success("Plan submitted for approval!");
      navigate("/workforce/planning");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Submission failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /**
   * handleDelete
   * Confirms with the user, then permanently deletes the plan.
   * Only available for DRAFT and SUBMITTED plans.
   */
  const handleDelete = async () => {
    if (!plan) return;
    if (!window.confirm(`Delete "${plan.title}"? This cannot be undone.`))
      return;
    setDeleting(true);
    try {
      await workforceService.deletePlan(plan.id);
      toast.success("Plan deleted");
      navigate("/workforce/planning");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to delete";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ── Attachment handlers ────────────────────────────────────────────────

  /**
   * handleFilesPicked — validates each file (type + 10 MB) then adds to
   * the pendingFiles queue. Invalid files are rejected with a toast.
   */
  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // reset so the same file can be re-picked
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "image/gif",
    ];
    const maxBytes = 10 * 1024 * 1024;
    const valid: File[] = [];
    for (const file of picked) {
      if (!allowed.includes(file.type)) {
        toast.error(`"${file.name}" — unsupported type. Use PDF, Word, Excel, or image.`);
        continue;
      }
      if (file.size > maxBytes) {
        toast.error(`"${file.name}" exceeds 10 MB limit.`);
        continue;
      }
      if (!pendingFiles.some((f) => f.name === file.name && f.size === file.size)) {
        valid.push(file);
      }
    }
    if (valid.length) setPendingFiles((prev) => [...prev, ...valid]);
  };

  /**
   * handleUploadPending — uploads every file in pendingFiles one by one,
   * tracking per-file progress. Requires the plan to already be saved.
   */
  const handleUploadPending = async () => {
    if (!id) {
      toast.error("Save the plan as a draft first, then attach documents.");
      return;
    }
    if (pendingFiles.length === 0) return;
    for (const file of pendingFiles) {
      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 1 }));
        const res = await workforceService.uploadAttachment(id, file, (pct) =>
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

  /**
   * handleDeleteAttachment — removes a saved attachment from the server
   * and from the local attachments list.
   */
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!id) return;
    setDeletingAttachmentId(attachmentId);
    try {
      await workforceService.deleteAttachment(id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("Attachment removed");
    } catch {
      toast.error("Failed to remove attachment");
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  // ── Position helpers ───────────────────────────────────────────────────

  /** Adds a blank position row to the end of the positions array */
  const addPosition = () => setPositions([...positions, emptyPosition()]);

  /** Removes the position row at the given index (minimum 1 row enforced) */
  const removePosition = (idx: number) => {
    if (positions.length === 1) return; // always keep at least one row
    setPositions(positions.filter((_, i) => i !== idx));
  };

  /** Updates a single field value in the position at the given index */
  const updatePosition = (
    idx: number,
    field: keyof PlanPosition,
    value: string | number,
  ) => {
    setPositions(
      positions.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    );
  };

  // Show full-page spinner while the existing plan is loading
  if (loading) {
    return (
      <div className="page-loading">
        <div className="loader-icon" />
      </div>
    );
  }

  /**
   * workflowSteps — visual pipeline that reflects the plan's actual current status.
   * The active step is derived from plan.status so the sidebar always shows
   * exactly where in the pipeline the plan currently sits.
   */
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

  return (
    <div className="plan-page">
      {/* ── Page Header ── */}
      <div className="plan-header">
        <div>
          {/* Breadcrumb navigation */}
          <p className="plan-breadcrumb">
            <Link to="/workforce/planning" className="plan-link">
              Workforce Planning
            </Link>
            {" › "}
            {isEdit ? "Edit Plan" : "Create Plan"}
          </p>
          <h1 className="plan-title">
            {isEdit ? "Edit Workforce Plan" : "New Workforce Plan"}
          </h1>
          <p className="plan-description">
            Define strategic staffing requirements for the upcoming planning
            cycle.
          </p>
        </div>

        {/* Action buttons — only shown when the plan is in an editable state */}
        {isEditable && (
          <div className="plan-actions">
            {/* Save Draft:
                - SUBMITTED plan → "Withdraw & Save" (bumps version automatically)
                - REJECTED plan  → "Save Revision"   (bumps version automatically)
                - DRAFT plan     → "Save Draft"       (no auto-bump) */}
            <Button
              variant="secondary"
              icon={<FiSave size={16} />}
              loading={saving}
              onClick={() => handleSaveDraft(false)}
            >
              {plan?.status === "SUBMITTED"
                ? "Withdraw & Save"
                : plan?.status === "REJECTED"
                ? "Save Revision"
                : "Save Draft"}
            </Button>

            {/* Submit / Resubmit — version does NOT change on submission */}
            <Button
              icon={<FiSend size={16} />}
              loading={saving}
              onClick={handleSubmit}
            >
              {plan?.status === "REJECTED"
                ? `Resubmit (v${plan?.version})`
                : "Submit for Approval"}
            </Button>

            {/* Delete button — only for DRAFT and SUBMITTED plans */}
            {(plan?.status === "DRAFT" || plan?.status === "SUBMITTED") && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="plan-delete-button"
              >
                <FiTrash2 size={16} />
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Warning banner when the plan has been submitted and edits will withdraw it */}
      {plan?.status === "SUBMITTED" && (
        <div className="plan-withdraw-banner">
          <span className="plan-withdraw-banner-icon">⚠️</span>
          <p>
            This plan is currently <strong>awaiting approval</strong>. Saving
            changes will withdraw it from review and reset it to Draft.
          </p>
        </div>
      )}

      {/* ── Two-column content grid ── */}
      <div className="plan-grid">
        {/* ── Main column ── */}
        <div className="plan-main-column">
          {/* Section 1: Basic plan information */}
          <section className="section-card">
            <div className="section-header">
              <FiInfo className="section-icon" size={18} />
              <h2 className="section-title">Basic Information</h2>
            </div>
            <div className="section-body">
              {/* Plan title text input */}
              <div className="field-row">
                <label className="field-label">Plan Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g Department Expansion"
                  disabled={!isEditable}
                  className="field-input"
                />
              </div>

              {/* Department dropdown — populated from the API */}
              <div className="field-grid">
                <div className="field-row">
                  <label className="field-label">Department</label>
                  <select
                    value={form.department_id}
                    onChange={(e) =>
                      setForm({ ...form, department_id: e.target.value })
                    }
                    disabled={!isEditable}
                    className="field-select"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Planning year and period */}
              <div className="field-grid">
                <div className="field-row">
                  <label className="field-label">Planning Year</label>
                  <select
                    value={form.fiscal_year}
                    onChange={(e) =>
                      setForm({ ...form, fiscal_year: Number(e.target.value) })
                    }
                    disabled={!isEditable}
                    className="field-select"
                  >
                    {[2024, 2025, 2026].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-row">
                  <label className="field-label">Planning Period</label>
                  {/* Radio buttons for ANNUAL / QUARTERLY */}
                  <div className="radio-group">
                    {(["ANNUAL", "QUARTERLY"] as const).map((p) => (
                      <label key={p} className="radio-option">
                        <input
                          type="radio"
                          name="planning_period"
                          checked={form.planning_period === p}
                          onChange={() =>
                            setForm({ ...form, planning_period: p })
                          }
                          disabled={!isEditable}
                        />
                        {p.charAt(0) + p.slice(1).toLowerCase()}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quarter selector — only shown when QUARTERLY is selected */}
              {form.planning_period === "QUARTERLY" && (
                <div className="field-row">
                  <label className="field-label">Quarter</label>
                  <select
                    value={form.quarter}
                    onChange={(e) =>
                      setForm({ ...form, quarter: Number(e.target.value) })
                    }
                    disabled={!isEditable}
                    className="field-select"
                  >
                    {[1, 2, 3, 4].map((q) => (
                      <option key={q} value={q}>
                        Q{q}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Headcount Definition — editable table of position rows */}
          <section className="section-card">
            <div className="section-header space-between">
              <div className="section-header-left">
                <FiUserPlus className="section-icon" size={18} />
                <h2 className="section-title">Headcount Definition</h2>
              </div>
              {/* "Add Position" button only shown when the plan is editable */}
              {isEditable && (
                <Button variant="secondary" onClick={addPosition}>
                  Add Position
                </Button>
              )}
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr className="table-header-row">
                    <th className="table-heading">Position Title</th>
                    <th className="table-heading table-heading-narrow">
                      Count
                    </th>
                    <th className="table-heading">Employment Type</th>
                    <th className="table-heading">Priority</th>
                    {/* Delete column header — only shown in edit mode */}
                    {isEditable && (
                      <th className="table-heading table-heading-narrow" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, idx) => (
                    <tr key={idx} className="table-row">
                      {/* Position title — free text */}
                      <td className="table-cell">
                        <input
                          value={pos.title}
                          onChange={(e) =>
                            updatePosition(idx, "title", e.target.value)
                          }
                          placeholder="Position title"
                          disabled={!isEditable}
                          className="table-input"
                        />
                      </td>
                      {/* Count — numeric, minimum 1 */}
                      <td className="table-cell">
                        <input
                          type="number"
                          min={1}
                          value={pos.count}
                          onChange={(e) =>
                            updatePosition(idx, "count", Number(e.target.value))
                          }
                          disabled={!isEditable}
                          className="table-input"
                        />
                      </td>
                      {/* Employment type dropdown */}
                      <td className="table-cell">
                        <select
                          value={pos.employment_type}
                          onChange={(e) =>
                            updatePosition(
                              idx,
                              "employment_type",
                              e.target.value,
                            )
                          }
                          disabled={!isEditable}
                          className="table-input"
                        >
                          <option value="FULL_TIME">Full-time</option>
                          <option value="PART_TIME">Part-time</option>
                          <option value="CONTRACT">Contract</option>
                        </select>
                      </td>
                      {/* Priority dropdown */}
                      <td className="table-cell">
                        <select
                          value={pos.priority}
                          onChange={(e) =>
                            updatePosition(idx, "priority", e.target.value)
                          }
                          disabled={!isEditable}
                          className="table-input"
                        >
                          <option value="HIGH">High</option>
                          <option value="MEDIUM">Med</option>
                          <option value="LOW">Low</option>
                        </select>
                      </td>
                      {/* Remove row button — hidden in read-only mode */}
                      {isEditable && (
                        <td className="table-cell table-cell-action">
                          <button
                            onClick={() => removePosition(idx)}
                            className="icon-button"
                            title="Remove"
                          >
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

          {/* Section 3: Business justification textarea */}
          <section className="section-card">
            <div className="section-header">
              <FiFileText className="section-icon" size={18} />
              <h2 className="section-title">Justification</h2>
            </div>
            <textarea
              value={form.justification}
              onChange={(e) =>
                setForm({ ...form, justification: e.target.value })
              }
              placeholder="Provide the operational reason and business case for this headcount request..."
              rows={5}
              disabled={!isEditable}
              className="field-textarea"
            />
          </section>

          {/* ── Section 4: Supporting Documents ── */}
          {/* Shown to all users; upload controls only available in edit mode */}
          <section className="section-card">
            <div className="section-header space-between">
              <div className="section-header-left">
                <FiPaperclip className="section-icon" size={18} />
                <h2 className="section-title">Supporting Documents</h2>
              </div>
              {/* Total attachment count badge */}
              {(attachments.length > 0 || pendingFiles.length > 0) && (
                <span className="attachment-count-badge">
                  {attachments.length + pendingFiles.length} file{attachments.length + pendingFiles.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="attachment-body">
              {/* ── Already-uploaded attachments ── */}
              {attachments.length > 0 && (
                <ul className="attachment-list">
                  {attachments.map((att) => (
                    <li key={att.id} className="attachment-item">
                      <span className="attachment-icon">
                        {att.mimetype?.includes("pdf") ? "📄" :
                         att.mimetype?.includes("image") ? "🖼️" :
                         att.mimetype?.includes("sheet") || att.mimetype?.includes("excel") ? "📊" : "📎"}
                      </span>
                      <div className="attachment-info">
                        <p className="attachment-name">{att.filename}</p>
                        <p className="attachment-meta">
                          {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ""}
                          {att.created_at ? ` · ${new Date(att.created_at).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      {/* Remove button — only in editable state */}
                      {isEditable && (
                        <button
                          className="attachment-remove-btn"
                          onClick={() => handleDeleteAttachment(att.id)}
                          disabled={deletingAttachmentId === att.id}
                          title="Remove attachment"
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* ── Pending files (picked but not yet uploaded) ── */}
              {pendingFiles.length > 0 && (
                <ul className="attachment-list attachment-list-pending">
                  {pendingFiles.map((file) => {
                    const pct = uploadProgress[file.name];
                    const isUploading = pct !== undefined;
                    return (
                      <li key={`${file.name}-${file.size}`} className="attachment-item attachment-item-pending">
                        <span className="attachment-icon">📎</span>
                        <div className="attachment-info">
                          <p className="attachment-name">{file.name}</p>
                          {isUploading ? (
                            /* Progress bar shown while uploading */
                            <div className="attachment-progress-bar">
                              <div
                                className="attachment-progress-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          ) : (
                            <p className="attachment-meta pending-label">
                              {(file.size / 1024).toFixed(1)} KB · Pending upload
                            </p>
                          )}
                        </div>
                        {/* Only allow removal if not actively uploading */}
                        {!isUploading && (
                          <button
                            className="attachment-remove-btn"
                            onClick={() =>
                              setPendingFiles((prev) =>
                                prev.filter((f) => !(f.name === file.name && f.size === file.size))
                              )
                            }
                            title="Remove from queue"
                          >
                            <FiX size={14} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* ── Empty state ── */}
              {attachments.length === 0 && pendingFiles.length === 0 && (
                <p className="attachment-empty">
                  No supporting documents attached yet.
                </p>
              )}

              {/* ── File picker + upload button (edit mode only) ── */}
              {isEditable && (
                <div className="attachment-actions">
                  {/* Hidden file input — triggered by the label button */}
                  <input
                    id="attachment-file-input"
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                    className="file-input-hidden"
                    onChange={handleFilesPicked}
                  />
                  <label htmlFor="attachment-file-input" className="file-upload-card">
                    <FiPaperclip size={15} />
                    Choose files
                  </label>

                  {/* Upload button — only shown when there are pending files */}
                  {pendingFiles.length > 0 && (
                    <Button
                      variant="primary"
                      icon={<FiUpload size={15} />}
                      onClick={handleUploadPending}
                      disabled={!id}
                      title={!id ? "Save draft first to enable uploads" : undefined}
                    >
                      Upload {pendingFiles.length} file{pendingFiles.length !== 1 ? "s" : ""}
                    </Button>
                  )}

                  {/* Nudge shown in create mode before the plan has an ID */}
                  {!id && pendingFiles.length > 0 && (
                    <p className="attachment-nudge">
                      Save the plan as a draft first to upload your files.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

        </div>

        {/* ── Right sidebar ── */}
        <div className="plan-sidebar">
          {/* Current status card — only rendered when a plan exists (edit mode) */}
          {plan && (
            <div className="info-card">
              <p className="info-label">Current Status</p>
              <StatusBadge status={plan.status} />
            </div>
          )}

          {/* Approval workflow visualisation — static steps */}
          <div className="workflow-card">
            <h3 className="section-title-sm">Approval Workflow</h3>
            <div className="workflow-list">
              {workflowSteps.map((step, i) => (
                <div key={i} className="workflow-step">
                  {/* Green checkmark for the active/done step, grey circle for pending */}
                  {step.active || step.done ? (
                    <FiCheckCircle
                      className={`workflow-step-icon ${step.done ? "workflow-step-icon-done" : "workflow-step-icon-active"}`}
                      size={18}
                    />
                  ) : (
                    <FiCircle
                      className="workflow-step-icon workflow-step-icon-inactive"
                      size={18}
                    />
                  )}
                  <div>
                    <p className="workflow-step-title">{step.label}</p>
                    <p className="workflow-step-description">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Plan summary card — live totals */}
          <div className="summary-card">
            <h3 className="section-title-sm">Plan Summary</h3>
            <div className="summary-list">
              {/* Total headcount: sum of all position counts */}
              <div className="summary-row">
                <span className="summary-label">Total Headcount</span>
                <span className="summary-value">{totalHeadcount}</span>
              </div>
              {/* Positions defined: count of rows with a non-empty title */}
              <div className="summary-row">
                <span className="summary-label">Positions Defined</span>
                <span className="summary-value">
                  {positions.filter((p) => p.title).length}
                </span>
              </div>
              {/* Attachments count */}
              <div className="summary-row">
                <span className="summary-label">Attachments</span>
                <span className="summary-value">{attachments.length}</span>
              </div>
              {/* Current version */}
              {plan && (
                <div className="summary-row">
                  <span className="summary-label">Current Version</span>
                  <span className="summary-value">v{plan.version}</span>
                </div>
              )}
              {/* Next version hint — shown when the next save will auto-bump */}
              {plan && (plan.status === "REJECTED" || plan.status === "SUBMITTED") && (
                <div className="summary-row">
                  <span className="summary-label">Next Save Will Be</span>
                  <span className="summary-value summary-emphasis">v{plan.version + 1}</span>
                </div>
              )}
            </div>
            <p className="summary-note">
              Last saved by {user?.full_name || "You"}
            </p>
            {/* "Save as New Version" — only for plain DRAFT plans.
                REJECTED and SUBMITTED edits bump version automatically,
                so showing this button for those states would be misleading. */}
            {isEdit && isEditable && plan?.status === "DRAFT" && (
              <div className="section-footer">
                <Button variant="ghost" onClick={() => handleSaveDraft(true)}>
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
