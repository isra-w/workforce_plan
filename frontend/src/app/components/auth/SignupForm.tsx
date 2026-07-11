/**
 * components/auth/SignupForm.tsx
 *
 * Two-step registration form rendered inside AuthLayout.
 *
 * Step 1 — Collect user details:
 *   Full name, email, role (from ROLES constant), password, confirm password.
 *   Client-side validation enforces a minimum password length of 8 characters
 *   and checks that both password fields match before advancing to step 2.
 *
 * Step 2 — Confirmation screen:
 *   Shows an informational note explaining that a verification email will be
 *   sent. The user can go back to step 1 or click "Create Account" to submit.
 *
 * Submission (handleSubmit):
 *   Calls register() from AuthContext (POST /auth/register).
 *   On success it navigates to /verify-email and passes the email address and
 *   the raw verificationToken in router state so the verify page can use them.
 *   On failure it shows the server error message as a toast.
 *
 * State:
 *   step            1 or 2 — controls which form screen is shown.
 *   form            Controlled object for all input values.
 *   showPassword    Toggle for the password field visibility.
 *   showConfirm     Toggle for the confirm-password field visibility.
 *   loading         True while the registration API call is in flight.
 *
 * Constants:
 *   ROLES           Dropdown options matching the UserRole enum on the backend.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdEmail, MdLock, MdPerson } from "react-icons/md";
import { FiEye, FiEyeOff } from "react-icons/fi";
import toast from "react-hot-toast";
import AuthLayout from "./AuthLayout";
import { useAuth } from "../../context/AuthContext";

/** Role options shown in the registration dropdown, matching the backend enum */
const ROLES = [
  { value: "WORKFORCE_PLANNER", label: "Workforce Planner" },
  { value: "HR", label: "Human Resource (HR)" },
  { value: "CEO", label: "CEO" },
  { value: "CANDIDATE", label: "Candidate" },
];

export default function SignupForm() {
  // Track which step of the two-step form is currently shown
  const [step, setStep] = useState(1);

  // Single controlled object for all form field values
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

  /** Generic change handler — updates the matching field in the form object */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /**
   * Step 1 submit — validates passwords and advances to the confirmation screen.
   * Does NOT call the API yet.
   */
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

  /**
   * Step 2 submit — calls the register API.
   * Navigates to /verify-email on success, passing the email and token in state.
   */
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
      {/* Step indicator pill at the top of the card */}
      <span className="auth-step-badge">Step {step} of 2</span>

      <div className="auth-header">
        <h2 className="auth-title">Create your account</h2>
        <p className="auth-description">Join Recruitment and start your application today.</p>
      </div>

      {step === 1 ? (
        /* ── Step 1: user details form ── */
        <form onSubmit={handleStep1} className="auth-form">
          {/* Full name */}
          <div className="auth-field-group">
            <label className="auth-field-label">
              Full Name<span className="auth-required">*</span>
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <MdPerson size={17} />
              </span>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                placeholder="Abebe Kebede"
                className="auth-input"
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="auth-field-group">
            <label className="auth-field-label">
              Email Address<span className="auth-required">*</span>
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <MdEmail size={17} />
              </span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="auth-input"
                required
              />
            </div>
          </div>

          {/* Role selector — value maps to UserRole enum on the backend */}
          <div className="auth-field-group">
            <label className="auth-field-label">Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="auth-select"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Password with show/hide toggle */}
          <div className="auth-field-group">
            <label className="auth-field-label">
              Password<span className="auth-required">*</span>
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <MdLock size={17} />
              </span>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                placeholder="At least 8 characters"
                className="auth-input auth-input-has-suffix"
                required
              />
              <button
                type="button"
                className="auth-input-suffix"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <FiEyeOff size={17} /> : <FiEye size={17} />}
              </button>
            </div>
          </div>

          {/* Confirm password — validated to match on submit */}
          <div className="auth-field-group">
            <label className="auth-field-label">
              Confirm Password<span className="auth-required">*</span>
            </label>
            <div className="auth-input-wrapper">
              <input
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Repeat your password"
                className="auth-input auth-input-has-suffix"
                required
              />
              <button
                type="button"
                className="auth-input-suffix"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
              >
                {showConfirm ? <FiEyeOff size={17} /> : <FiEye size={17} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn">
            Create Account
          </button>
        </form>
      ) : (
        /* ── Step 2: confirmation screen ── */
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Info box reminding the user about the verification email */}
          <div className="auth-note-box">
            <p className="auth-note-title">Almost done!</p>
            <p className="auth-note-text">
              After creating your account, you'll receive a verification link to
              confirm your identity before accessing workforce planning.
            </p>
          </div>

          <div className="auth-action-row">
            {/* Back button returns to step 1 without losing form data */}
            <button
              type="button"
              className="auth-back-btn"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            {/* Final submit — calls the register API */}
            <button
              type="submit"
              className="auth-submit-btn auth-submit-btn-flex"
              disabled={loading}
            >
              {loading && <span className="auth-btn-spinner" />}
              Create Account
            </button>
          </div>
        </form>
      )}

      {/* Link to sign-in for users who already have an account */}
      <p className="auth-footer-text">
        Already have an account?{" "}
        <Link to="/login" className="auth-action-link">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
