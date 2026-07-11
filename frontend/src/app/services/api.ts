/**
 * services/api.ts
 *
 * Configures and exports a single shared Axios instance used by all service
 * modules (authService, workforceService) to communicate with the backend.
 *
 * Request interceptor:
 *   Before every outgoing request, reads the JWT from localStorage
 *   (key: "workforce_token") and attaches it as an Authorization: Bearer
 *   header. This means callers never need to pass the token manually.
 *
 * Response interceptor:
 *   On a successful response the data is passed through unchanged.
 *   On a 401 Unauthorized response:
 *     - Removes the stale token and user from localStorage.
 *     - Redirects the browser to /login — but only if the user is not already
 *       on the login or signup page, preventing an infinite redirect loop.
 *   All other errors are re-rejected so the calling code can handle them
 *   (e.g. show a toast notification with the error message).
 */
import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

/**
 * Request interceptor — attaches the JWT to every outgoing request.
 * The token is read fresh from localStorage on each call so it picks up
 * changes made by login / verifyEmail without needing a re-render.
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("workforce_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Response interceptor — handles global 401 errors.
 * When the backend rejects a request as unauthorised (expired token,
 * deactivated account, etc.) the session is cleared and the user is
 * sent to /login automatically.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Wipe the invalid session from localStorage
      localStorage.removeItem("workforce_token");
      localStorage.removeItem("workforce_user");
      // Only redirect if not already on an auth page (prevents redirect loops)
      if (
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/signup")
      ) {
        window.location.href = "/login";
      }
    }
    // Re-reject all errors so individual callers can handle them
    return Promise.reject(error);
  }
);

export default api;
