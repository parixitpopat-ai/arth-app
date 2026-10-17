// src/cloudConfig.js
//
// Which Supabase project this build may talk to (SYNC-SAFETY-005). Until now every build fell back to the PRODUCTION project when
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY were unset, which on Vercel means a PREVIEW deployment of any branch would use real
// accounts. Rule: a Vercel preview/development build never falls back to production, and refuses the production project even if it is
// configured explicitly; it then runs local-only (no cloud sync) unless a different backend is configured. Production builds, local
// development and the Android build behave exactly as before. `vercelEnv` is Vercel's VERCEL_ENV, injected at build time by vite.config.js.

export const PRODUCTION_SUPABASE_URL = "https://iggsdctjjkdknmcnibwi.supabase.co";
export const PRODUCTION_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZ3NkY3Rqamtka25tY25pYndpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjU0MDAsImV4cCI6MjA5MDU0MTQwMH0.oU1u7t6f6ygGzUmSEIgtaBCoHogywauu9R6NmmNLQN0";

const hostOf = u => { try { return new URL(u).hostname; } catch { return ""; } };

/** @returns { url: string, key: string, configured: boolean, reason: string } */
export function resolveCloudConfig({ url, key, vercelEnv = "", dev = false, forceBypass } = {}) {
  const previewLike = vercelEnv === "preview" || vercelEnv === "development";
  let u = url || "", k = key || "";
  if (!u || !k) {
    if (previewLike) return { url: "", key: "", configured: false, reason: "preview-build-without-an-explicit-backend" };
    u = u || PRODUCTION_SUPABASE_URL; k = k || PRODUCTION_SUPABASE_ANON_KEY;       // unchanged behaviour for production / local / Android builds
  }
  if (previewLike && hostOf(u) === hostOf(PRODUCTION_SUPABASE_URL)) return { url: "", key: "", configured: false, reason: "preview-build-may-not-use-the-production-backend" };
  const bypass = Boolean(dev) && forceBypass !== "false";
  return { url: u, key: k, configured: !bypass && Boolean(u && k), reason: bypass ? "dev-auth-bypass" : "ok" };
}
