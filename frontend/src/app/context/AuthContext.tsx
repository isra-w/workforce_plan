/**
 * context/AuthContext.tsx
 *
 * Provides application-wide authentication state and helpers via React Context.
 * Any component inside <AuthProvider> can call useAuth() to read or mutate
 * auth state without prop-drilling.
 *
 * AuthContextType — shape of the context value:
 *   user          Current authenticated User object, or null if logged out.
 *   token         Raw JWT string stored in localStorage, or null.
 *   loading       True while the initial /auth/me request is in flight, so
 *                 ProtectedRoute can show a spinner rather than redirecting
 *                 prematurely.
 *   login         Calls POST /auth/login, saves the token + user to
 *                 localStorage via saveSession(), and updates React state.
 *   register      Calls POST /auth/register and returns the raw
 *                 verificationToken so the caller can navigate to /verify-email.
 *   verifyEmail   Calls GET /auth/verify/:token, saves the new session, and
 *                 updates state — the user is immediately logged in after
 *                 verifying their email.
 *   logout        Wipes localStorage (clearSession) and resets state to null.
 *   refreshUser   Re-fetches the user profile from /auth/me and updates both
 *                 React state and localStorage (useful after profile edits).
 *   setUser       Direct setter — lets other components update the user object
 *                 without a full round-trip (e.g. after completeProfile).
 *
 * Initialisation (useEffect on mount):
 *   If a token exists in localStorage the provider immediately calls /auth/me
 *   to validate it and refresh the user object. If the call fails (expired /
 *   revoked token) it clears the session so the user is sent to login.
 *
 * useAuth() — convenience hook that throws a helpful error when called outside
 *   of AuthProvider, preventing silent bugs.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "../../utils/types";
import { authService, getStoredUser, clearSession, saveSession } from "../services/workforceService";

/** Shape of all values exposed via AuthContext */
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    full_name: string;
    email: string;
    password: string;
    role?: string;
  }) => Promise<string>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
}

/** The context object — null until AuthProvider mounts */
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * AuthProvider
 *
 * Wrap the component tree with this provider (done in App.tsx) so any
 * descendant can call useAuth().
 *
 * On first render it reads a cached user + token from localStorage for an
 * instant non-loading state, then validates the token against the backend.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // Seed initial state from localStorage for a synchronous first render
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("workforce_token")
  );
  // Start as true so ProtectedRoute shows a spinner until validation finishes
  const [loading, setLoading] = useState(true);

  /**
   * On mount (and whenever the token changes) validate the JWT against
   * the backend. This catches expired or revoked tokens early.
   */
  useEffect(() => {
    const init = async () => {
      if (token) {
        try {
          const res = await authService.getMe();
          setUser(res.data.data.user);
        } catch {
          // Token is invalid — wipe the session so the user goes to /login
          clearSession();
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };
    init();
  }, [token]);

  /** POST /auth/login — authenticates the user and persists the session */
  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    const { token: newToken, data } = res.data;
    saveSession(newToken, data.user); // write to localStorage
    setToken(newToken);
    setUser(data.user);
  };

  /**
   * POST /auth/register — creates a new account.
   * Returns the raw verificationToken so the caller can pass it to the
   * verify-email page without a second API call.
   */
  const register = async (data: {
    full_name: string;
    email: string;
    password: string;
    role?: string;
  }) => {
    const res = await authService.register(data);
    return res.data.data.verificationToken as string;
  };

  /**
   * GET /auth/verify/:token — confirms the email address.
   * The backend returns a fresh JWT so the user is instantly logged in.
   */
  const verifyEmail = async (verifyToken: string) => {
    const res = await authService.verifyEmail(verifyToken);
    const { token: newToken, data } = res.data;
    saveSession(newToken, data.user);
    setToken(newToken);
    setUser(data.user);
  };

  /** Clears the session from localStorage and resets React state to null */
  const logout = () => {
    clearSession();
    setUser(null);
    setToken(null);
  };

  /**
   * Re-fetches the latest user profile from the backend.
   * Useful after the user updates their title via completeProfile.
   */
  const refreshUser = async () => {
    const res = await authService.getMe();
    setUser(res.data.data.user);
    localStorage.setItem("workforce_user", JSON.stringify(res.data.data.user));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        verifyEmail,
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth
 *
 * Custom hook to consume AuthContext. Must be called inside <AuthProvider>.
 * Throws a descriptive error if used outside the provider tree.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
