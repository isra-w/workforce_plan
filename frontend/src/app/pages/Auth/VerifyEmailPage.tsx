/**
 * pages/Auth/VerifyEmailPage.tsx
 *
 * Email verification page that the user lands on after registration.
 *
 * How it gets its data:
 *   The email and verificationToken are passed as React Router location.state
 *   by both SignupForm (after registration) and ProtectedRoute (when a logged-in
 *   but unverified user tries to access a protected page).
 *
 * Two UI states:
 *   1. Unverified (default):
 *      Shows a mail icon, the destination email address, a "Verify Email" button,
 *      a "Resend verification link" button, and a back-to-login link.
 *
 *   2. Verified (after handleVerify succeeds):
 *      Shows a green checkmark icon and a success message, then automatically
 *      redirects to /workforce after 1.5 seconds.
 *
 * handleVerify:
 *   Called when the user clicks "Verify Email".
 *   Uses the verificationToken from router state to call verifyEmail() from
 *   AuthContext (GET /auth/verify/:token). On success:
 *     - Sets verified = true to show the success screen.
 *     - Shows a success toast.
 *     - Navigates to /workforce after a 1.5 s delay.
 *   On failure shows the server error as an error toast.
 *
 * handleResend:
 *   Calls authService.resendVerification(email) to get a fresh token.
 *   On success navigates to /verify-email (replacing history) with the new
 *   token in state so the page is ready for the next verification attempt.
 *
 * State:
 *   loading   boolean — true while the verify API call is in flight.
 *   verified  boolean — true once verification succeeds (shows success screen).
 */
import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { FiMail, FiCheckCircle } from "react-icons/fi";
import toast from "react-hot-toast";
import AuthLayout from "../../components/auth/AuthLayout";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/workforceService";

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  // Pull email and token from router state (set by SignupForm or ProtectedRoute)
  const email = (location.state as { email?: string })?.email || "";
  const verificationToken =
    (location.state as { verificationToken?: string })?.verificationToken || "";

  /**
   * Confirms the email address using the token from router state.
   * Navigates to the dashboard automatically once verified.
   */
  const handleVerify = async () => {
    if (!verificationToken) {
      toast.error("No verification token found. Please check your email.");
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(verificationToken);
      setVerified(true);
      toast.success("Email verified successfully!");
      // Short delay before redirect so the user sees the success screen
      setTimeout(() => navigate("/workforce"), 1500);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Verification failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Requests a fresh verification token from the backend and refreshes the
   * page state so the new token is available for the next attempt.
   */
  const handleResend = async () => {
    if (!email) {
      toast.error("Email address not found");
      return;
    }
    try {
      const res = await authService.resendVerification(email);
      toast.success("Verification link resent!");
      // Replace current history entry with updated state containing the new token
      navigate("/verify-email", {
        state: {
          email,
          verificationToken: res.data.data.verificationToken,
        },
        replace: true,
      });
    } catch {
      toast.error("Failed to resend verification");
    }
  };

  return (
    <AuthLayout>
      <div className="verify-page">
        {verified ? (
          /* ── Success screen ── */
          <>
            <FiCheckCircle className="verify-icon verify-icon-success" size={48} />
            <h2 className="verify-title">Email Verified!</h2>
            <p className="verify-description">
              Redirecting to workforce planning...
            </p>
          </>
        ) : (
          /* ── Pending verification screen ── */
          <>
            <FiMail className="verify-icon verify-icon-mail" size={48} />
            <h2 className="verify-title">Verify your email</h2>
            <p className="verify-description verify-message">
              We sent a verification link to{" "}
              <strong>{email || "your email"}</strong>. Click below to confirm
              your identity and access workforce planning.
            </p>

            {/* Primary CTA — verifies the email using the token in state */}
            <button
              className="auth-submit-btn"
              disabled={loading}
              onClick={handleVerify}
            >
              {loading && <span className="auth-btn-spinner" />}
              Verify Email
            </button>

            {/* Resend link for users whose token has expired */}
            <button
              onClick={handleResend}
              className="verify-resend-link"
            >
              Resend verification link
            </button>

            <p className="verify-footer-text">
              <Link to="/login" className="verify-action-link">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
