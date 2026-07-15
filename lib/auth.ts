import crypto from "crypto";

// Simple shared-password gate. Set DASHBOARD_PASSWORD in the environment
// (Vercel → Settings → Environment Variables) to override the default.
const DEFAULT_PASSWORD = "swellwave2026";

export const AUTH_COOKIE = "swm_auth";

export function dashboardPassword(): string {
  return process.env.DASHBOARD_PASSWORD || DEFAULT_PASSWORD;
}

// The cookie stores a hash of the password, never the password itself.
export function authToken(): string {
  return crypto.createHash("sha256").update(dashboardPassword()).digest("hex");
}
