/**
 * components/auth/SignupForm.tsx
 *
 * Two-step registration form rendered inside AuthLayout.
 */
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdEmail, MdLock, MdPerson } from "react-icons/md";
import { FiEye, FiEyeOff } from "react-icons/fi";
import toast from "react-hot-toast";
import AuthLayout from "./AuthLayout";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
}

export default function SignupForm() {
  const [step, setStep] = useState(1);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
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
  const selectedRole =
    roles.find((role) => role.name === form.role) ?? roles[0];
  const navigate = useNavigate();

  // Fetch available roles on mount
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await axios.get("/api/auth/roles");
        console.log("Roles response:", response.data);
        const fetchedRoles =
          response.data?.data?.roles ||
          response.data?.roles ||
          response.data ||
          [];
        const rolesArray = Array.isArray(fetchedRoles) ? fetchedRoles : [];
        setRoles(rolesArray);
        if (rolesArray.length > 0) {
          const defaultRole =
            rolesArray.find((role: Role) => role.name === form.role) ??
            rolesArray[0];
          setForm((prev) => ({ ...prev, role: defaultRole.name }));
        }
      } catch (error) {
        console.error("Failed to fetch roles:", error);
        toast.error("Failed to load roles");
      } finally {
        setLoadingRoles(false);
      }
    };
    fetchRoles();
  }, []);

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
      <div className="mb-6 space-y-2">
        <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-green-700">
          Step {step} of 2
        </span>
        <h2 className="text-2xl font-bold text-slate-900">
          Create your account
        </h2>
        <p className="text-sm text-slate-500">
          Join the workforce planning workspace and get started quickly.
        </p>
      </div>

      {step === 1 ? (
        <form onSubmit={handleStep1} className="flex flex-col gap-4">
          {/* Full name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Full Name<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                <MdPerson size={18} />
              </span>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Abebe Kebede"
                className="w-full pl-10 pr-4 py-3 text-sm border border-slate-300 rounded-lg outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 text-slate-800 placeholder:text-slate-400 transition-all bg-white box-border"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Email Address<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                <MdEmail size={18} />
              </span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 text-sm border border-slate-300 rounded-lg outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 text-slate-800 placeholder:text-slate-400 transition-all bg-white box-border"
                required
              />
            </div>
          </div>

          {/* Role selector */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">Role</label>
            <div className="relative w-full">
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                disabled={loadingRoles}
                className="w-full px-4 py-3 text-sm border border-slate-300 rounded-xl outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 text-slate-800 bg-slate-50 transition-all appearance-none cursor-pointer box-border pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 1rem center",
                }}
              >
                {loadingRoles ? (
                  <option>Loading roles...</option>
                ) : (
                  roles.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.display_name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Password<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10">
                <MdLock size={18} />
              </span>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
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

          {/* Confirm password */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700">
              Confirm Password<span className="text-red-500 ml-0.5">*</span>
            </label>
            <div className="relative w-full">
              <input
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your password"
                className="w-full pl-4 pr-12 py-3 text-sm border border-slate-300 rounded-xl outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 text-slate-800 placeholder:text-slate-400 transition-all bg-slate-50 box-border"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors z-10"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
              >
                {showConfirm ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 px-4 text-sm font-semibold transition-all shadow-sm hover:shadow-md box-border"
          >
            Continue
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 mb-1.5">
              Almost done!
            </p>
            <p className="text-sm text-blue-700 leading-relaxed">
              After creating your account, you'll receive a verification link to
              confirm your identity before accessing workforce planning.
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              type="button"
              className="flex-1 inline-flex items-center justify-center bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-xl py-3 px-4 text-sm font-semibold transition-all box-border"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="submit"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 px-4 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md box-border"
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
      <p className="text-sm text-slate-600 text-center mt-6">
        Already have an account?{" "}
        <Link
          to="/login"
          className="text-green-600 font-semibold hover:text-green-700 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
