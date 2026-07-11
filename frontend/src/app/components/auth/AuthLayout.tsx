/**
 * components/auth/AuthLayout.tsx
 *
 * Shared wrapper layout rendered by every authentication page
 * (LoginForm, SignupForm, VerifyEmailPage).
 *
 * What it renders:
 *   - A full-viewport centred column (.auth-page) with a gradient background.
 *   - A large brand heading (.auth-brand) showing the application name —
 *     defaults to "ADIU" but accepts an optional `brand` prop so it can be
 *     overridden without editing this file.
 *   - A white card panel (.auth-panel) that contains whatever `children`
 *     are passed in (the actual form).
 *
 * Props:
 *   children  ReactNode  — the form or content to display inside the card.
 *   brand     string     — optional application name shown above the card.
 *                          Defaults to "ADIU".
 */
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  brand?: string;
}

export default function AuthLayout({ children, brand = "ADIU" }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      {/* Brand name displayed above the auth card */}
      <h1 className="auth-brand">{brand}</h1>

      {/* White card that wraps the form content */}
      <div className="auth-panel">{children}</div>
    </div>
  );
}
