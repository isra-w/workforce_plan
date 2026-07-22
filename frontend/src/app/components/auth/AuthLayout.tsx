/**
 * components/auth/AuthLayout.tsx
 *
 * Shared wrapper layout rendered by every authentication page.
 */
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  brand?: string;
}

export default function AuthLayout({ children, brand = "ADIU" }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
      {/* Brand name above the auth card */}
      <h1 className="text-5xl font-extrabold text-green-600 tracking-tight text-center mb-6">
        {brand}
      </h1>

      {/* White card that wraps the form content */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {children}
      </div>
    </div>
  );
}
