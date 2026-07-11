/**
 * components/Core/ui/Button.tsx
 *
 * A reusable button component that extends the native <button> element with
 * variant styling, a loading spinner, optional full-width layout, and a
 * leading icon slot.
 *
 * Props (extends all standard <button> HTML attributes):
 *   variant    "primary" | "secondary" | "ghost" | "danger"
 *              Controls the colour scheme. Defaults to "primary" (green).
 *              Mapped to CSS classes: btn-primary, btn-secondary, btn-ghost, btn-danger.
 *
 *   loading    boolean — when true, replaces the icon with a spinning animation
 *              (.btn-spinner) and disables the button to prevent double-submits.
 *
 *   fullWidth  boolean — when true, adds the .btn-full-width class so the
 *              button stretches to fill its container.
 *
 *   icon       ReactNode — an element (usually a Feather icon) displayed to the
 *              left of the children text. Hidden when loading is true.
 *
 *   children   ReactNode — the button label text.
 *
 *   className  string — extra CSS classes merged onto the button element.
 *
 *   disabled   boolean — native disabled attribute; also auto-set when loading.
 *
 *   ...props   All other standard button attributes (onClick, type, etc.) are
 *              spread directly onto the <button>.
 *
 * Usage examples:
 *   <Button>Save Draft</Button>
 *   <Button variant="danger" icon={<FiTrash2 />}>Delete</Button>
 *   <Button loading={saving} variant="primary">Submit for Approval</Button>
 *   <Button variant="secondary" fullWidth>Cancel</Button>
 */
import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
}

export default function Button({
  variant = "primary",
  loading,
  fullWidth,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  // Maps the variant prop to its corresponding CSS modifier class
  const variantClass = `btn-${variant}`;

  return (
    <button
      className={`btn ${variantClass} ${fullWidth ? "btn-full-width" : ""} ${className}`}
      // Disabled when explicitly disabled OR while a loading operation is in progress
      disabled={disabled || loading}
      {...props}
    >
      {/* Show spinner during loading; otherwise show the icon (if provided) */}
      {loading ? (
        <span className="btn-spinner" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
