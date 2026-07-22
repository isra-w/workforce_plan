/**
 * components/auth/LoginForm.tsx
 *
 * The sign-in page. Renders inside AuthLayout.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdEmail, MdLock } from "react-icons/md";
import { FiEye, FiEyeOff, FiLogIn } from "react-icons/fi";
import toast from "react-hot-toast";
import AuthLayout from "./AuthLayout";
import { useAuth } from "../../context/AuthContext";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/workforce");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Login failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (user?.is_verified === false) {
    navigate("/verify-email", { state: { email: user.email } });
  }

  return (
    <AuthLayout>
      <div className="mb-6 space-y-2">
        <div className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-green-700"></div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
        <p className="text-sm text-slate-500">
          Sign in to continue managing workforce plans and approvals.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email field */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700">
            Email Address<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
              <MdEmail size={18} />
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-3 text-sm border border-slate-300 rounded-xl outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 text-slate-800 placeholder:text-slate-400 transition-all bg-slate-50 box-border"
              required
            />
          </div>
        </div>

        {/* Password field */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700">
            Password<span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
              <MdLock size={18} />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full pl-10 pr-12 py-3 text-sm border border-slate-300 rounded-xl outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 text-slate-800 placeholder:text-slate-400 transition-all bg-slate-50 box-border"
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors z-10"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 px-4 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md box-border"
          disabled={loading}
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <FiLogIn size={18} />
          )}
          Sign In
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">or</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Footer link */}
      <p className="text-sm text-slate-600 text-center">
        Don't have an account?{" "}
        <Link
          to="/signup"
          className="text-green-600 font-semibold hover:text-green-700 hover:underline"
        >
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
