// domain/identity/sessionRecheck.js
//
// "Signed out" must mean the session is really gone. Logs showed Arth sending people to the sign-in screen right after the server had
// successfully renewed their session (a token refresh, then one account check answered 403). So when the first check says "signed-out",
// the session is renewed once and the account is asked again; only a second "signed-out" counts. An unreachable server is never a sign-out
// (offline resume stays as it was). Pure: the two network calls are passed in.

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
 * @param {{checkOnce:()=>Promise<{status:string,user:object|null,error?:object|null}>, refreshOnce:()=>Promise<any>}} io
 * @returns {Promise<{result:object, note:null|{at:string, first:object, second:object, recovered:boolean}}>}
 *   note is set only when the first check said "signed-out": what the first and second answers were, and whether renewing the session fixed it.
 */
export async function checkWithRecovery({ checkOnce, refreshOnce, now = () => new Date().toISOString() }) {
  const first = await checkOnce();
  if (first.status !== "signed-out") return { result: first, note: null };
  try { await refreshOnce(); } catch { /* a failed renewal is simply followed by the second check */ }
  const second = await checkOnce();
  return { result: second, note: { at: now(), first: describeAuthCheck(first), second: describeAuthCheck(second), recovered: second.status === "verified" } };
}

/** Keep the last few notes (newest last). */
export const appendAuthNote = (notes, note, keep = 8) => [...(Array.isArray(notes) ? notes : []), note].slice(-keep);
