/**
 * components/common/Input.tsx
 *
 * A reusable controlled input field with an optional label, leading icon,
 * trailing suffix element, and inline error message.
 *
 * Props (extends all standard <input> HTML attributes):
 *   label     string     — visible label text rendered above the input.
 *   error     string     — when provided, adds a red error message below the
 *                          input and applies an error border style.
 *   icon      ReactNode  — optional element (usually an icon) displayed inside
 *                          the left side of the input via absolute positioning.
 *                          Adds padding-left to the input via the "with-icon" class.
 *   suffix    ReactNode  — optional element displayed on the right side of the
 *                          input (e.g. a show/hide password button).
 *                          Adds padding-right via the "with-suffix" class.
 *   required  boolean    — when true, appends a red asterisk to the label and
 *                          passes the required attribute to the native input.
 *   className string     — extra CSS classes merged onto the <input> element.
 *   ...props             — all other standard input attributes (type, value,
 *                          onChange, placeholder, disabled, etc.) are spread
 *                          directly onto the <input>.
 *
 * CSS classes used (defined in globals.css):
 *   .input-group         — column flex wrapper
 *   .input-label         — label text style
 *   .input-label-required — red asterisk colour
 *   .input-wrapper       — relative container for icon/suffix positioning
 *   .input-field         — the actual <input> element base style
 *   .input-icon          — absolute-left icon wrapper
 *   .input-suffix        — absolute-right suffix wrapper
 *   .input-error         — red error text below the input
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
    <div className="input-group">
      {/* Label row — red asterisk appended when required */}
      <label className="input-label">
        {label}
        {required && <span className="input-label-required">*</span>}
      </label>

      {/* Wrapper provides relative positioning for the icon and suffix */}
      <div className="input-wrapper">
        {/* Leading icon — positioned absolutely on the left */}
        {icon && (
          <span className="input-icon">
            {icon}
          </span>
        )}

        {/* The actual input element — class names adjust padding for icon/suffix */}
        <input
          className={`input-field ${error ? "error" : ""} ${
            icon ? "with-icon" : ""
          } ${suffix ? "with-suffix" : ""} ${className}`}
          required={required}
          {...props}
        />

        {/* Trailing suffix — positioned absolutely on the right */}
        {suffix && (
          <span className="input-suffix">
            {suffix}
          </span>
        )}
      </div>

      {/* Inline error message shown below the input */}
      {error && <p className="input-error">{error}</p>}
    </div>
  );
}
