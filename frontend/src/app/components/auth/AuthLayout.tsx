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

export default function AuthLayout({
  children,
  brand = "ADIU",
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_35%),linear-gradient(135deg,_#f8fff9_0%,_#f1f5f9_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-green-200/80 bg-white/85 px-4 py-2 shadow-sm backdrop-blur">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
            A
          </div>
          <div className="text-left">
            <p className="text-sm font-weight: 2rem; font-bold text-slate-800">
              {brand}
            </p>
          </div>
        </div>

        <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
