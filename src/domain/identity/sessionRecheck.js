// domain/identity/sessionRecheck.js
//
// Bank-style sessions: the person proves who they are once per device, and after that the app renews its access silently. "Signed out" must
// mean the server has really rejected the saved session, never "a check failed". Logs showed Arth sending people to the sign-in screen when
// the access token had simply expired (the server answered 403 "token is expired" to a request that was sent without renewing it first).
//   1. BEFORE asking, a stored access token that is expired or about to expire is renewed (its own expiry claim decides, not the stored one).
//   2. A first "signed-out" answer is double-checked: the session is renewed once and the account is asked again.
//   3. The person is sent to sign-in only when the server definitively rejects the session (no session, or the refresh token is gone or used).
//      Any other failure is "unreachable": the app opens from the data on the device and tries again, exactly like offline resume.
// Pure: the network calls are passed in.

/** Refresh-token failures that mean the saved session is really gone (the person must sign in again). */
export const DEFINITIVE_CODES = Object.freeze(["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired", "invalid_grant", "user_not_found", "user_banned"]);

export function isDefinitiveSessionLoss(error) {
  if (!error) return false;
  if (error.name === "AuthSessionMissingError") return true;
  if (DEFINITIVE_CODES.includes(String(error.code || ""))) return true;
  return /invalid refresh token|refresh token (not found|already used)/i.test(String(error.message || ""));     // older servers send only the text
}

const b64urlJson = part => { try { const s = part.replace(/-/g, "+").replace(/_/g, "/"); const pad = s + "=".repeat((4 - (s.length % 4)) % 4); return JSON.parse(atob(pad)); } catch { return null; } };

/** Seconds until the saved access token stops being accepted (the earlier of its own expiry claim and the stored expiry), or null when unreadable. */
export function accessTokenSecondsLeft(rawStoredSession, nowMs = Date.now()) {
  let s; try { s = typeof rawStoredSession === "string" ? JSON.parse(rawStoredSession) : rawStoredSession; } catch { return null; }
  if (!s || typeof s !== "object") return null;
  const ends = [];
  const claims = typeof s.access_token === "string" ? b64urlJson(s.access_token.split(".")[1] || "") : null;
  if (claims && Number.isFinite(Number(claims.exp))) ends.push(Number(claims.exp));
  if (Number.isFinite(Number(s.expires_at)) && Number(s.expires_at) > 0) ends.push(Number(s.expires_at));
  return ends.length ? Math.min(...ends) - nowMs / 1000 : null;
}

/** True when the saved access token is expired or about to be, so it must be renewed before it is sent anywhere. */
export const shouldRenewFirst = (raw, nowMs = Date.now(), marginSeconds = 60) => { const left = accessTokenSecondsLeft(raw, nowMs); return left !== null && left < marginSeconds; };

/** What may be remembered about a failed check: names and numbers only, never a message, e-mail, token or id. */
export function describeAuthCheck(result) {
  const e = (result && result.error) || null;
  return {
    status: String((result && result.status) || ""),
    name: e && e.name ? String(e.name).slice(0, 40) : "",
    http: e && Number.isFinite(Number(e.status)) ? Number(e.status) : null,
    code: e && e.code ? String(e.code).slice(0, 40) : "",
  };
}

/**
 * @param {{checkOnce:()=>Promise<{status:string,user:object|null,error?:object|null}>, refreshOnce:()=>Promise<{error?:object|null}|void>, prepare?:()=>Promise<void>, now?:()=>string}} io
 * @returns {Promise<{result:object, note:null|{at:string, first:object, second:object, recovered:boolean, inconclusive:boolean}}>}
 *   note is set only when the first check said "signed-out". `inconclusive` = the server did not say the session is gone, so the result is "unreachable", not "signed-out".
 */
export async function checkWithRecovery({ checkOnce, refreshOnce, prepare = null, now = () => new Date().toISOString() }) {
  if (prepare) { try { await prepare(); } catch { /* a failed early renewal is followed by the normal check */ } }
  const first = await checkOnce();
  if (first.status !== "signed-out") return { result: first, note: null };
  let refreshError = null;
  try { const r = await refreshOnce(); refreshError = (r && r.error) || null; } catch (e) { refreshError = e; }
  const second = await checkOnce();
  const gone = isDefinitiveSessionLoss(first.error) || isDefinitiveSessionLoss(refreshError) || isDefinitiveSessionLoss(second.error);
  const inconclusive = second.status === "signed-out" && !gone;
  const result = inconclusive ? { ...second, status: "unreachable" } : second;
  return { result, note: { at: now(), first: describeAuthCheck(first), second: describeAuthCheck(second), recovered: second.status === "verified", inconclusive } };
}

/** Keep the last few notes (newest last). */
export const appendAuthNote = (notes, note, keep = 8) => [...(Array.isArray(notes) ? notes : []), note].slice(-keep);
