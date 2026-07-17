import { useEffect, useState } from "react";
import {
  FiBriefcase,
  FiUsers,
  FiAlertCircle,
  FiSearch,
  FiFilter,
} from "react-icons/fi";
import StatusBadge from "../../components/common/StatusBadge";
import { workforceService } from "../../services/workforceService";
import { Vacancy } from "../../../utils/types";

// Human-readable labels for the employment type enum
const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
};

// Planning period label helper
function periodLabel(v: Vacancy) {
  const base = v.planning_period === "ANNUAL" ? "Annual" : "Quarterly";
  return v.quarter ? `${base} · Q${v.quarter}` : base;
}

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");

  useEffect(() => {
    workforceService
      .getVacancies()
      .then((res) => setVacancies(res.data.data.vacancies))
      .catch(() => setVacancies([]))
      .finally(() => setLoading(false));
  }, []);

  // Unique department options derived from the data
  const deptOptions = Array.from(
    new Map(
      vacancies
        .filter((v) => v.department)
        .map((v) => [v.department!.id, v.department!.name]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

  // Apply all filters
  const filtered = vacancies.filter((v) => {
    if (
      search &&
      !v.title.toLowerCase().includes(search.toLowerCase()) &&
      !v.plan_title.toLowerCase().includes(search.toLowerCase()) &&
      !(v.department?.name ?? "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (filterDept !== "ALL" && v.department?.id !== filterDept) return false;
    if (filterPriority !== "ALL" && v.priority !== filterPriority) return false;
    if (filterType !== "ALL" && v.employment_type !== filterType) return false;
    return true;
  });

  // KPI counts
  const totalOpenings = vacancies.reduce((s, v) => s + v.count, 0);
  const criticalCount = vacancies
    .filter((v) => v.priority === "HIGH")
    .reduce((s, v) => s + v.count, 0);
  const deptCount = new Set(vacancies.map((v) => v.department?.id)).size;

  return (
    <div className="vacancies-page">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Open Vacancies</h1>
          <p className="page-description">
            All positions authorised by CEO approval and open for recruitment.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="loader-icon" />
        </div>
      ) : (
        <>
          {/* ── KPI strip ── */}
          <div className="vacancy-kpi-strip">
            <div className="vacancy-kpi-item">
              <span className="vacancy-kpi-icon vacancy-kpi-icon-blue">
                <FiBriefcase size={18} />
              </span>
              <div>
                <p className="vacancy-kpi-value">{totalOpenings}</p>
                <p className="vacancy-kpi-label">Total Openings</p>
              </div>
            </div>
            <div className="vacancy-kpi-item">
              <span className="vacancy-kpi-icon vacancy-kpi-icon-red">
                <FiAlertCircle size={18} />
              </span>
              <div>
                <p className="vacancy-kpi-value">{criticalCount}</p>
                <p className="vacancy-kpi-label">Critical Roles</p>
              </div>
            </div>
            <div className="vacancy-kpi-item">
              <span className="vacancy-kpi-icon vacancy-kpi-icon-green">
                <FiUsers size={18} />
              </span>
              <div>
                <p className="vacancy-kpi-value">{deptCount}</p>
                <p className="vacancy-kpi-label">Departments Hiring</p>
              </div>
            </div>
          </div>

          {/* ── Filters toolbar ── */}
          <div className="vacancy-toolbar">
            {/* Search */}
            <div className="vacancy-search-wrapper">
              <FiSearch className="vacancy-search-icon" size={15} />
              <input
                type="text"
                placeholder="Search by position, plan, or department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="vacancy-search-input"
              />
            </div>

            <div className="vacancy-filter-group">
              <FiFilter size={14} className="vacancy-filter-icon" />

              {/* Department filter */}
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="vacancy-filter-select"
              >
                <option value="ALL">All Departments</option>
                {deptOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Priority filter */}
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="vacancy-filter-select"
              >
                <option value="ALL">All Priorities</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              {/* Employment type filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="vacancy-filter-select"
              >
                <option value="ALL">All Types</option>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </div>
          </div>

          {/* ── Results count ── */}
          {filtered.length > 0 && (
            <p className="vacancy-result-count">
              Showing{" "}
              <strong>
                {filtered.reduce((s, v) => s + v.count, 0)} openings
              </strong>{" "}
              across <strong>{filtered.length} roles</strong>
            </p>
          )}

          {/* ── Vacancy cards grid ── */}
          {filtered.length === 0 ? (
            <div className="vacancy-empty">
              <FiBriefcase size={40} className="vacancy-empty-icon" />
              <p className="vacancy-empty-title">
                {vacancies.length === 0
                  ? "No approved vacancies yet"
                  : "No results match your filters"}
              </p>
              <p className="vacancy-empty-sub">
                {vacancies.length === 0
                  ? "Positions will appear here once a workforce plan has been approved by the CEO."
                  : "Try adjusting your search or filter criteria."}
              </p>
              {(search ||
                filterDept !== "ALL" ||
                filterPriority !== "ALL" ||
                filterType !== "ALL") && (
                <button
                  className="vacancy-clear-btn"
                  onClick={() => {
                    setSearch("");
                    setFilterDept("ALL");
                    setFilterPriority("ALL");
                    setFilterType("ALL");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="vacancy-grid">
              {filtered.map((v, idx) => (
                <div
                  key={v.id ?? `${v.plan_id}-${idx}`}
                  className={`vacancy-card vacancy-card-priority-${v.priority.toLowerCase()}`}
                >
                  {/* Card header: priority badge + employment type */}
                  <div className="vacancy-card-header">
                    <StatusBadge status={v.priority} />
                    <span className="vacancy-card-type">
                      {EMPLOYMENT_LABELS[v.employment_type] ?? v.employment_type}
                    </span>
                  </div>

                  {/* Position title + headcount */}
                  <div className="vacancy-card-title-row">
                    <h3 className="vacancy-card-title">{v.title}</h3>
                    {v.count > 1 && (
                      <span className="vacancy-card-count">×{v.count}</span>
                    )}
                  </div>

                  {/* Department */}
                  {v.department && (
                    <p className="vacancy-card-dept">{v.department.name}</p>
                  )}

                  {/* Divider */}
                  <hr className="vacancy-card-divider" />

                  {/* Footer meta: plan title + period */}
                  <div className="vacancy-card-footer">
                    <p className="vacancy-card-plan">{v.plan_title}</p>
                    <span className="vacancy-card-period">
                      FY{v.fiscal_year} · {periodLabel(v)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
