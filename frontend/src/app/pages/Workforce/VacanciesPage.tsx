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

const EMPLOYMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
};

function periodLabel(v: Vacancy) {
  const base = v.planning_period === "ANNUAL" ? "Annual" : "Quarterly";
  return v.quarter ? `${base} · Q${v.quarter}` : base;
}

// Priority → left border color
const priorityBorder: Record<string, string> = {
  HIGH: "border-l-4 border-l-red-400",
  MEDIUM: "border-l-4 border-l-yellow-400",
  LOW: "border-l-4 border-l-slate-300",
};

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
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

  const deptOptions = Array.from(
    new Map(
      vacancies
        .filter((v) => v.department)
        .map((v) => [v.department!.id, v.department!.name]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

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

  const totalOpenings = vacancies.reduce((s, v) => s + v.count, 0);
  const criticalCount = vacancies.filter((v) => v.priority === "HIGH").reduce((s, v) => s + v.count, 0);
  const deptCount = new Set(vacancies.map((v) => v.department?.id)).size;

  const selectCls = "px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 bg-white text-slate-700 transition-colors";

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Open Vacancies</h1>
          <p className="text-sm text-slate-500 mt-1">
            All positions authorised by CEO approval and open for recruitment.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-green-600" />
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
              <span className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                <FiBriefcase size={18} />
              </span>
              <div>
                <p className="text-2xl font-bold text-slate-800">{totalOpenings}</p>
                <p className="text-xs text-slate-500">Total Openings</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
              <span className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500 flex-shrink-0">
                <FiAlertCircle size={18} />
              </span>
              <div>
                <p className="text-2xl font-bold text-slate-800">{criticalCount}</p>
                <p className="text-xs text-slate-500">Critical Roles</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
              <span className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
                <FiUsers size={18} />
              </span>
              <div>
                <p className="text-2xl font-bold text-slate-800">{deptCount}</p>
                <p className="text-xs text-slate-500">Departments Hiring</p>
              </div>
            </div>
          </div>

          {/* Filters toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
              <input type="text" placeholder="Search by position, plan, or department…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 bg-white text-slate-700 placeholder:text-slate-400 transition-colors" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FiFilter size={14} className="text-slate-400" />
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className={selectCls}>
                <option value="ALL">All Departments</option>
                {deptOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className={selectCls}>
                <option value="ALL">All Priorities</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectCls}>
                <option value="ALL">All Types</option>
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </div>
          </div>

          {/* Results count */}
          {filtered.length > 0 && (
            <p className="text-sm text-slate-500">
              Showing{" "}
              <strong className="text-slate-700">{filtered.reduce((s, v) => s + v.count, 0)} openings</strong>
              {" "}across{" "}
              <strong className="text-slate-700">{filtered.length} roles</strong>
            </p>
          )}

          {/* Vacancy cards grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <FiBriefcase size={40} className="text-slate-300" />
              <p className="text-base font-semibold text-slate-600">
                {vacancies.length === 0 ? "No approved vacancies yet" : "No results match your filters"}
              </p>
              <p className="text-sm text-slate-400 max-w-sm">
                {vacancies.length === 0
                  ? "Positions will appear here once a workforce plan has been approved by the CEO."
                  : "Try adjusting your search or filter criteria."}
              </p>
              {(search || filterDept !== "ALL" || filterPriority !== "ALL" || filterType !== "ALL") && (
                <button
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
                  onClick={() => { setSearch(""); setFilterDept("ALL"); setFilterPriority("ALL"); setFilterType("ALL"); }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((v, idx) => (
                <div key={v.id ?? `${v.plan_id}-${idx}`}
                  className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${priorityBorder[v.priority] ?? ""}`}>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={v.priority} />
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                        {EMPLOYMENT_LABELS[v.employment_type] ?? v.employment_type}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-800 leading-tight">{v.title}</h3>
                      {v.count > 1 && (
                        <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex-shrink-0">×{v.count}</span>
                      )}
                    </div>
                    {v.department && (
                      <p className="text-sm text-slate-500">{v.department.name}</p>
                    )}
                    <hr className="border-slate-100" />
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-600 truncate">{v.plan_title}</p>
                      <span className="text-xs text-slate-400 flex-shrink-0 ml-2">FY{v.fiscal_year} · {periodLabel(v)}</span>
                    </div>
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
