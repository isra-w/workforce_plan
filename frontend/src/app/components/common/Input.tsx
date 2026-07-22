/**
 * components/common/Input.tsx
 *
 * A reusable controlled input field with an optional label, leading icon,
 * trailing suffix element, and inline error message.
 */
import { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
  suffix?: ReactNode;
}

export default function Input({
  label,
  error,
  icon,
  suffix,
  required,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {/* Label row */}
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* Wrapper provides relative positioning for icon and suffix */}
      <div className="relative">
        {/* Leading icon */}
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}

        {/* Input element */}
        <input
          className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-800 bg-white outline-none transition-colors placeholder:text-slate-400
            ${error ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-300" : "border-slate-200 focus:border-green-500 focus:ring-1 focus:ring-green-200"}
            ${icon ? "pl-9" : ""}
            ${suffix ? "pr-9" : ""}
            ${className}`}
          required={required}
          {...props}
        />

        {/* Trailing suffix */}
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {suffix}
          </span>
        )}
      </div>

      {/* Inline error message */}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
