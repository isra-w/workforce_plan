/**
 * components/common/StatusBadge.tsx
 *
 * A small pill badge that displays a plan or priority status string in a
 * colour-coded style.
 */
interface StatusBadgeProps {
  status: string;
}

const statusClasses: Record<string, string> = {
  DRAFT: "bg-slate-100 text-green-700",
  SUBMITTED: "bg-yellow-100 text-yellow-800",
  HR_APPROVED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  LOW: "bg-slate-100 text-green-700",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = status.replace(/_/g, " ");
  const colorClass = statusClasses[status] ?? "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}
