// authRedirect.js
//
// Where the email sign-in link sends the person back to, and which returning links the app is willing to act on.
// Pure functions; no I/O, no logging. The authority is this file: nothing taken from a link except a one-time
// `code` is ever used, and only when the link points at exactly the address below.
//
// Flow (installed Android app): the app asks for the email with PKCE (a secret "verifier" stays in the app), the email
// link goes through Supabase and lands on https://arth-app.vercel.app/auth/callback?code=...; Android opens the app
// for that address (Android App Link; fallback page if it does not), and the app exchanges the code together with its
// verifier for a session. A code on its own is useless to anyone else, so an intercepted link cannot sign anyone in.

export const APP_PACKAGE_ID = "com.parixitpopat.arth";
export const AUTH_CALLBACK_ORIGIN = "https://arth-app.vercel.app";
export const AUTH_CALLBACK_PATH = "/auth/callback";
/** Test/debug builds only: lets `adb` exercise the handoff without a verified domain. Never accepted in a release build. */
export const DEV_CALLBACK_SCHEME = "com.parixitpopat.arth";

const CODE_RX = /^[A-Za-z0-9-]{10,200}$/;

export const authCallbackUrl = () => `${AUTH_CALLBACK_ORIGIN}${AUTH_CALLBACK_PATH}`;

/** True only inside the installed Capacitor app, never in a browser. window.androidBridge is injected by the Android WebView itself; Capacitor's own check is the second signal. */
export const isNativeApp = () => {
  try { const w = globalThis.window; return Boolean(w?.androidBridge || w?.Capacitor?.isNativePlatform?.()); } catch { return false; }
};

const FRIENDLY = {
  otp_expired: "That sign-in link has expired. Go back and ask for a new code.",
  access_denied: "That sign-in link is no longer valid. Go back and ask for a new code.",
  flow_state_expired: "That sign-in link has expired. Go back and ask for a new code.",
  flow_state_not_found: "That sign-in link was already used or is no longer valid. Go back and ask for a new code.",
  validation_failed: "That sign-in link is not valid. Go back and ask for a new code.",
};
const GENERIC_ERROR = "That sign-in link did not work. Go back and ask for a new code, or type the 6-digit code from the email.";

/** A short, safe message for an error code returned in a link or by the exchange. Never echoes server text. */
export const friendlyAuthMessage = errorCode => FRIENDLY[String(errorCode || "").toLowerCase()] || GENERIC_ERROR;

/**
 * @param {string} rawUrl
 * @param {{allowDevScheme?:boolean}} [opts]
 * @returns {{ok:true, code:string} | {ok:false, kind:"untrusted"|"error"|"missing-code", message?:string}}
 *   untrusted    not our callback address: ignore it silently (never show or act on arbitrary links)
 *   error        our callback address, carrying an error from the sign-in service (expired / denied)
 *   missing-code our callback address without a usable code
 */
export function parseAuthCallback(rawUrl, { allowDevScheme = false } = {}) {
  let url;
  try { url = new URL(String(rawUrl)); } catch { return { ok: false, kind: "untrusted" }; }
  if (url.username || url.password) return { ok: false, kind: "untrusted" };

  const isAppLink = url.protocol === "https:" && url.origin === AUTH_CALLBACK_ORIGIN
    && (url.pathname === AUTH_CALLBACK_PATH || url.pathname === `${AUTH_CALLBACK_PATH}/`);
  const isDevLink = allowDevScheme === true && url.protocol === `${DEV_CALLBACK_SCHEME}:` && url.hostname === "auth"
    && (url.pathname === "/callback" || url.pathname === "/callback/");
  if (!isAppLink && !isDevLink) return { ok: false, kind: "untrusted" };

  // Errors can arrive in the query or the fragment.
  const params = new URLSearchParams(url.search);
  const frag = new URLSearchParams(url.hash.replace(/^#/, ""));
  const get = k => params.get(k) ?? frag.get(k);
  const errorCode = get("error_code") || get("error");
  if (errorCode) return { ok: false, kind: "error", message: friendlyAuthMessage(get("error_code") || errorCode) };

  const code = params.get("code");
  if (!code || !CODE_RX.test(code)) return { ok: false, kind: "missing-code", message: GENERIC_ERROR };
  // Tokens in a link (the old implicit style) are deliberately not accepted: only a one-time code is exchanged.
  return { ok: true, code };
}
