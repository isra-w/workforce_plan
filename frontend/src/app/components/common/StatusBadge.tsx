/**
 * components/common/StatusBadge.tsx
 *
 * A small pill badge that displays a plan or priority status string in a
 * colour-coded style. Used throughout the tables and plan detail views.
 *
 * How it works:
 *   1. Builds a CSS class name from the lowercased status value
 *     (e.g. status="APPROVED" → class "status-approved").
 *   2. Renders a <span> with both the base "status-badge" class and the
 *      dynamic status-specific class. The colour mapping is defined in
 *      globals.css (e.g. .status-approved, .status-rejected, .status-draft).
 *
 * Props:
 *   status  string — the raw status string from the backend, e.g. "DRAFT",
 *                    "HR_REVIEW", "APPROVED", "REJECTED", "HIGH", "MEDIUM".
 *
 * Example:
 *   <StatusBadge status="CEO_REVIEW" />
 *   Renders: <span class="status-badge status-ceo_review">CEO REVIEW</span>
 */
interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  // Convert "HR_REVIEW" → "HR REVIEW" for display
  const label = status.replace(/_/g, " ");

  // Convert "HR_REVIEW" → "status-hr_review" to match the CSS class name
  const statusClass = `status-${status.toLowerCase()}`;

  return (
    <span className={`status-badge ${statusClass}`}>
      {label}
    </span>
  );
}
