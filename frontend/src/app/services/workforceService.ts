/**
 * services/workforceService.ts
 *
 * All API calls made by the frontend are grouped here into two service objects
 * and three session-management helpers. Every method returns an Axios promise
 * so callers can await the result and access the response via res.data.
 *
 * authService — methods that talk to /api/auth/*:
 *   login              POST /auth/login              — returns JWT + user
 *   register           POST /auth/register           — returns verificationToken
 *   verifyEmail        GET  /auth/verify/:token      — confirms email, returns JWT
 *   resendVerification POST /auth/resend-verification — sends a new token
 *   getMe              GET  /auth/me                 — returns current user profile
 *   completeProfile    PATCH /auth/complete-profile  — updates optional job title
 *
 * workforceService — methods that talk to /api/workforce/*:
 *   getDashboard       GET    /workforce/dashboard         — KPIs + dept stats
 *   getDepartments     GET    /workforce/departments       — all departments list
 *   getPlans           GET    /workforce/plans             — filterable plan list
 *   getPlan            GET    /workforce/plans/:id         — single plan detail
 *   createPlan         POST   /workforce/plans             — create a new draft
 *   updatePlan         PUT    /workforce/plans/:id         — save edits to a plan
 *   submitPlan         POST   /workforce/plans/:id/submit  — submit for approval
 *   reviewPlan         POST   /workforce/plans/:id/review  — approve or reject
 *   deletePlan         DELETE /workforce/plans/:id         — hard delete
 *   getVersions        GET    /workforce/plans/:id/versions            — version history
 *   uploadAttachment   POST   /workforce/plans/:id/attachments         — multipart upload with progress
 *   deleteAttachment   DELETE /workforce/plans/:id/attachments/:aid    — remove file + DB record
 *
 * Session helpers (used by AuthContext):
 *   saveSession   — writes token + user JSON to localStorage.
 *   clearSession  — removes both keys from localStorage.
 *   getStoredUser — parses and returns the stored User object, or null.
 */
import api from "./api";
import { User } from "../../utils/types";

/** Auth-related API calls — no auth token required for most of these */
export const authService = {
  /** Authenticates with email + password, returns a JWT and user profile */
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),

  /** Creates a new user account, returns a verificationToken for email confirmation */
  register: (data: {
    full_name: string;
    email: string;
    password: string;
    role?: string;
  }) => api.post("/auth/register", data),

  /** Confirms an email address using the token from the registration response */
  verifyEmail: (token: string) => api.get(`/auth/verify/${token}`),

  /** Requests a new verification email to be sent to the given address */
  resendVerification: (email: string) =>
    api.post("/auth/resend-verification", { email }),

  /** Returns the current authenticated user's profile (requires valid JWT) */
  getMe: () => api.get("/auth/me"),

  /** Updates the authenticated user's optional job title */
  completeProfile: (title: string) =>
    api.patch("/auth/complete-profile", { title }),
};

/** Workforce-planning API calls — all require a valid, verified JWT */
export const workforceService = {
  /** Fetches aggregated KPIs and department headcount stats for the dashboard */
  getDashboard: () => api.get("/workforce/dashboard"),

  /** Returns all departments sorted by name, used to populate dropdown menus */
  getDepartments: () => api.get("/workforce/departments"),

  /**
   * Returns a list of all workforce plans.
   * Accepts optional query params: { status, department_id } for server-side filtering.
   */
  getPlans: (params?: Record<string, string>) =>
    api.get("/workforce/plans", { params }),

  /** Returns a single plan with all its relations (positions, approval logs, versions) */
  getPlan: (id: string) => api.get(`/workforce/plans/${id}`),

  /** Creates a new DRAFT plan with positions; returns the created plan */
  createPlan: (data: Record<string, unknown>) =>
    api.post("/workforce/plans", data),

  /** Updates an existing DRAFT/SUBMITTED/REJECTED plan; supports save_as_new_version flag */
  updatePlan: (id: string, data: Record<string, unknown>) =>
    api.put(`/workforce/plans/${id}`, data),

  /** Transitions a DRAFT plan to SUBMITTED status and links it to the active planning cycle */
  submitPlan: (id: string) => api.post(`/workforce/plans/${id}/submit`),

  /** CEO/HR approval action — action is "approve" or "reject", comment required for rejections */
  reviewPlan: (id: string, action: string, comment?: string) =>
    api.post(`/workforce/plans/${id}/review`, { action, comment }),

  /** Hard-deletes a DRAFT or SUBMITTED plan (cascades to positions, versions, logs) */
  deletePlan: (id: string) => api.delete(`/workforce/plans/${id}`),

  /** Returns the version history snapshots for a plan, newest first */
  getVersions: (id: string) => api.get(`/workforce/plans/${id}/versions`),

  /**
   * Uploads a file attachment for a plan using multipart/form-data.
   * The file is stored on disk under /uploads and its metadata is saved to the DB.
   * Allowed types: PDF, Word, Excel, and images (validated on the backend too).
   * @param onProgress optional callback receiving upload percentage (0-100)
   */
  uploadAttachment: (id: string, file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post(`/workforce/plans/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress
        ? (evt) => {
            if (evt.total) {
              onProgress(Math.round((evt.loaded * 100) / evt.total));
            }
          }
        : undefined,
    });
  },

  /**
   * Deletes a single attachment by ID.
   * Removes both the DB record and the physical file from disk.
   * Only allowed while the plan is in DRAFT, SUBMITTED, or REJECTED status.
   */
  deleteAttachment: (planId: string, attachmentId: string) =>
    api.delete(`/workforce/plans/${planId}/attachments/${attachmentId}`),
};

/**
 * saveSession
 * Persists the JWT and serialised user object to localStorage so they
 * survive page refreshes. AuthContext reads these on mount.
 */
export function saveSession(token: string, user: User) {
  localStorage.setItem("workforce_token", token);
  localStorage.setItem("workforce_user", JSON.stringify(user));
}

/**
 * clearSession
 * Removes the token and user from localStorage — called on logout and
 * whenever a 401 is received from the API.
 */
export function clearSession() {
  localStorage.removeItem("workforce_token");
  localStorage.removeItem("workforce_user");
}

/**
 * getStoredUser
 * Parses the JSON user object from localStorage and returns it, or null
 * if nothing is stored. Used to seed AuthContext's initial state synchronously
 * before the /auth/me validation completes.
 */
export function getStoredUser(): User | null {
  const raw = localStorage.getItem("workforce_user");
  return raw ? JSON.parse(raw) : null;
}
