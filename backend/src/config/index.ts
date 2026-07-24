/**
 * config/index.ts
 *
 * Single source of truth for every environment variable the application reads.
 *
 * Rules:
 *   - dotenv is loaded here first so this module can be imported anywhere
 *     without requiring the caller to call dotenv.config() themselves.
 *   - Required variables cause an immediate, descriptive startup crash when
 *     missing so misconfigured deployments fail loudly at boot, not at runtime.
 *   - Optional variables are given safe, documented defaults.
 *   - Nothing outside this file should ever read process.env directly.
 *
 * Usage:
 *   import { config } from "src/config";
 *   config.jwtSecret   // string
 *   config.port        // number
 */

import dotenv from "dotenv";
import path from "path";

// Load .env before anything else reads process.env
const envPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads a required env var; throws a clear error if it is absent or empty. */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[config] Missing required environment variable: ${name}\n` +
        `  Add it to your .env file or deployment environment and restart.`,
    );
  }
  return value.trim();
}

/** Reads an optional env var, returning the given default when absent. */
function optional(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : defaultValue;
}

/** Reads an optional env var and coerces it to a positive integer. */
function optionalInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return defaultValue;
  const parsed = parseInt(raw.trim(), 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `[config] Environment variable ${name} must be a positive integer (got "${raw}").`,
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Config object — all fields are readonly so nothing mutates them at runtime
// ---------------------------------------------------------------------------

export const config = Object.freeze({
  // ── Server ──────────────────────────────────────────────────────────────
  /** HTTP port the Express server listens on. Default: 5000 */
  port: optionalInt("PORT", 5000),

  /** Runtime environment: "development" | "production" | "test" */
  nodeEnv: optional("NODE_ENV", "development"),

  /** True when running in production */
  get isProduction() {
    return this.nodeEnv === "production";
  },

  // ── CORS ────────────────────────────────────────────────────────────────
  /** Allowed frontend origin for CORS. Default: http://localhost:5173 */
  frontendUrl: optional("FRONTEND_URL", "http://localhost:5173"),

  // ── Database ────────────────────────────────────────────────────────────
  /** PostgreSQL connection string — required */
  databaseUrl: required("DATABASE_URL"),

  // ── JWT ─────────────────────────────────────────────────────────────────
  /** Secret key used to sign and verify JWTs — required */
  jwtSecret: required("JWT_SECRET"),

  /** JWT expiry duration string (e.g. "7d", "24h"). Default: "7d" */
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "7d"),

  // ── File uploads ────────────────────────────────────────────────────────
  /**
   * Absolute path to the directory : <project-root>/uploads
   */
  uploadDir: optional("UPLOAD_DIR", path.join(process.cwd(), "uploads")),

  /** Maximum allowed upload size in bytes (10 MB) */
  uploadMaxBytes: optionalInt("UPLOAD_MAX_BYTES", 10 * 1024 * 1024),

  /** Allowed MIME(file) types for plan attachments */
  allowedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
  ] as readonly string[],
});

// Export the inferred type so other modules can reference it without importing
// the value itself.
export type AppConfig = typeof config;
