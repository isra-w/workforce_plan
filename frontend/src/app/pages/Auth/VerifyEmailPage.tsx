/**
 * pages/Auth/VerifyEmailPage.tsx
 *
 * Email verification page that the user lands on after registration.
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

  const email = (location.state as { email?: string })?.email || "";
  const verificationToken =
    (location.state as { verificationToken?: string })?.verificationToken || "";

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

  const handleResend = async () => {
    if (!email) {
      toast.error("Email address not found");
      return;
    }
    try {
      const res = await authService.resendVerification(email);
      toast.success("Verification link resent!");
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
      <div className="flex flex-col items-center text-center gap-4 py-2">
        {verified ? (
          <>
            <div className="rounded-full bg-green-100 p-3">
              <FiCheckCircle className="text-green-600" size={48} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              Email Verified!
            </h2>
            <p className="text-sm text-slate-500">
              Redirecting to workforce planning...
            </p>
          </>
        ) : (
          <>
            <div className="rounded-full bg-green-100 p-3">
              <FiMail className="text-green-600" size={48} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              Verify your email
            </h2>
            <p className="text-sm text-slate-500 max-w-xs">
              We sent a verification link to{" "}
              <strong className="text-slate-700">
                {email || "your email"}
              </strong>
              . Click below to confirm your identity and access workforce
              planning.
            </p>

            <button
              className="w-full inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 px-4 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              onClick={handleVerify}
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              Verify Email
            </button>

            <button
              onClick={handleResend}
              className="text-sm text-slate-500 hover:text-green-600 hover:underline transition-colors"
            >
              Resend verification link
            </button>

            <p className="text-sm text-slate-500">
              <Link
                to="/login"
                className="text-green-600 font-semibold hover:text-green-700 hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
