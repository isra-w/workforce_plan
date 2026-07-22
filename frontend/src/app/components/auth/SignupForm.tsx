/**
 * components/auth/SignupForm.tsx
 *
 * Two-step registration form rendered inside AuthLayout.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdEmail, MdLock, MdPerson } from "react-icons/md";
import { FiEye, FiEyeOff } from "react-icons/fi";
import toast from "react-hot-toast";
import AuthLayout from "./AuthLayout";
import { useAuth } from "../../context/AuthContext";

const ROLES = [
  { value: "WORKFORCE_PLANNER", label: "Workforce Planner" },
  { value: "HR", label: "Human Resource (HR)" },
  { value: "HR_ADMIN", label: "HR Admin" },
  { value: "CEO", label: "CEO" },
  { value: "CANDIDATE", label: "Candidate" },
];

export default function SignupForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "WORKFORCE_PLANNER",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await register({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      toast.success("Account created! Please verify your email.");
      navigate("/verify-email", {
        state: { email: form.email, verificationToken: token },
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Registration failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {/* Step badge */}
      <span className="inline-block text-xs font-semibold bg-green-50 text-green-700 px-2.5 py-1 rounded-full mb-4">
        Step {step} of 2
      </span>

      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-800">Create your account</h2>
        <p className="text-sm text-slate-500 mt-1">
          Join Recruitment and start your application today.
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={handleStep1} className="flex flex-col gap-4">
          {/* Full name */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Full Name<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <MdPerson size={17} />
              </span>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Abebe Kebede"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 text-slate-800 placeholder:text-slate-400 transition-colors"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Email Address<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <MdEmail size={17} />
              </span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 text-slate-800 placeholder:text-slate-400 transition-colors"
                required
              />
            </div>
          </div>

          {/* Role selector */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 text-slate-800 bg-white transition-colors"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Password<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <MdLock size={17} />
              </span>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 text-slate-800 placeholder:text-slate-400 transition-colors"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Confirm Password<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative">
              <input
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your password"
                className="w-full pl-3 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200 text-slate-800 placeholder:text-slate-400 transition-colors"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
              >
                {showConfirm ? <FiEyeOff size={17} /> : <FiEye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2.5 px-4 text-sm font-semibold transition-colors"
          >
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Info box */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">Almost done!</p>
            <p className="text-sm text-blue-700">
              After creating your account, you'll receive a verification link to
              confirm your identity before accessing workforce planning.
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              className="flex-1 inline-flex items-center justify-center bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg py-2.5 px-4 text-sm font-semibold transition-colors"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-lg py-2.5 px-4 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              Create Account
            </button>
          </div>
        </form>
      )}

      {/* Footer link */}
      <p className="text-sm text-slate-500 text-center mt-5">
        Already have an account?{" "}
        <Link to="/login" className="text-green-600 font-semibold hover:text-green-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
