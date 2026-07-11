/**
 * components/auth/LoginForm.tsx
 *
 * The sign-in page. Renders inside AuthLayout so the brand header and card
 * wrapper are handled externally.
 *
 * State:
 *   email          Controlled value for the email input.
 *   password       Controlled value for the password input.
 *   showPassword   Toggles the password input between type="text" and
 *                  type="password" when the eye icon is clicked.
 *   loading        True while the login API call is in flight; disables the
 *                  submit button and shows a spinner in its place.
 *
 * Behaviour:
 *   - handleSubmit calls login() from AuthContext (which hits POST /auth/login).
 *     On success it shows a welcome toast and navigates to /workforce.
 *     On failure it extracts the server's error message from the Axios error
 *     response and shows it as an error toast.
 *
 *   - If a user object already exists in context but their email is not yet
 *     verified, the component redirects them to /verify-email immediately so
 *     they are nudged to complete verification.
 *
 *   - A link at the bottom navigates to /signup for new users.
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

  /** Calls the auth login and navigates to the dashboard on success */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/workforce");
    } catch (err: unknown) {
      // Extract the backend error message or fall back to a generic string
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Login failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // If the user is already logged in but unverified, redirect them to verify
  if (user?.is_verified === false) {
    navigate("/verify-email", { state: { email: user.email } });
  }

  return (
    <AuthLayout>
      <div className="auth-header">
        <h2 className="auth-title">Welcome back</h2>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        {/* Email field with envelope icon */}
        <div className="auth-field-group">
          <label className="auth-field-label">
            Email Address<span className="auth-required">*</span>
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <MdEmail size={17} />
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="auth-input"
              required
            />
          </div>
        </div>

        {/* Password field with lock icon and show/hide toggle */}
        <div className="auth-field-group">
          <label className="auth-field-label">
            Password<span className="auth-required">*</span>
          </label>
          <div className="auth-input-wrapper">
            <span className="auth-input-icon">
              <MdLock size={17} />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="auth-input auth-input-has-suffix"
              required
            />
            {/* Eye icon button toggles password visibility */}
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

        {/* Submit button — shows spinner while loading */}
        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? (
            <span className="auth-btn-spinner" />
          ) : (
            <FiLogIn size={17} />
          )}
          Sign In
        </button>
      </form>

      {/* Visual divider between the form and footer link */}
      <div className="auth-divider">
        <span>or</span>
      </div>

      {/* Link to the sign-up page for new users */}
      <p className="auth-footer-text">
        Don't have an account?{" "}
        <Link to="/signup" className="auth-action-link">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
