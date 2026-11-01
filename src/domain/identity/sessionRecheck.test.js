import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkWithRecovery, describeAuthCheck, appendAuthNote, isDefinitiveSessionLoss, accessTokenSecondsLeft, shouldRenewFirst, DEFINITIVE_CODES } from "./sessionRecheck.js";

const verified = { status: "verified", user: { id: "u1" }, error: null };
const out403 = { status: "signed-out", user: null, error: { name: "AuthApiError", status: 403, code: "bad_jwt", message: "invalid JWT for person@example.test" } };
const gone = { status: "signed-out", user: null, error: { name: "AuthSessionMissingError", status: 400, code: "", message: "Auth session missing!" } };
const unreachable = { status: "unreachable", user: null, error: { name: "AuthRetryableFetchError", status: 0 } };
const run = (answers, { refresh = async () => ({ error: null }), prepare } = {}) => { let i = 0, refreshes = 0, prepared = 0; return checkWithRecovery({ checkOnce: async () => answers[Math.min(i++, answers.length - 1)], refreshOnce: async () => { refreshes++; return refresh(); }, prepare: prepare ? async () => { prepared++; return prepare(); } : null, now: () => "2026-10-31T01:00:00.000Z" }).then(r => ({ ...r, refreshes, checks: i, prepared })); };

// a stored session like supabase-js keeps it: a JWT access token (only its expiry claim matters here) and a stored expiry
const b64 = o => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const stored = ({ exp, expires_at } = {}) => JSON.stringify({ access_token: `${b64({ alg: "HS256" })}.${b64({ exp })}.sig`, refresh_token: "r", ...(expires_at !== undefined ? { expires_at } : {}) });
const NOW = 1_800_000_000_000;                                     // ms; "now" in seconds is 1_800_000_000

// ---------- 1. renew BEFORE the check ----------
test("a stored access token that is expired, or about to be, is renewed before it is sent", () => {
  const n = NOW / 1000;
  assert.equal(shouldRenewFirst(stored({ exp: n - 3600, expires_at: n - 3600 }), NOW), true);      // expired an hour ago
  assert.equal(shouldRenewFirst(stored({ exp: n + 30, expires_at: n + 30 }), NOW), true);          // within the last minute
  assert.equal(shouldRenewFirst(stored({ exp: n + 3000, expires_at: n + 3000 }), NOW), false);     // plenty left
});

test("THE LOG CASE: the stored expiry is missing or wrong, the token's own expiry says it is expired - it is still renewed first", () => {
  const n = NOW / 1000;
  assert.equal(shouldRenewFirst(stored({ exp: n - 3600 }), NOW), true);                            // no stored expiry at all
  assert.equal(shouldRenewFirst(stored({ exp: n - 3600, expires_at: n + 99999 }), NOW), true);     // stored expiry far in the future (wrong)
  assert.equal(accessTokenSecondsLeft(stored({ exp: n + 500, expires_at: n + 100 }), NOW), 100);   // the EARLIER of the two decides
});

test("unreadable or missing storage is left alone: nothing is renewed on a guess", () => {
  for (const raw of [null, "", "not json", "{}", JSON.stringify({ access_token: "garbage" }), JSON.stringify({ access_token: "a.b.c" }), JSON.stringify([])]) assert.equal(shouldRenewFirst(raw, NOW), false, String(raw));
  assert.equal(accessTokenSecondsLeft(null, NOW), null);
});

test("prepare runs before the first check, and a failing prepare does not stop the check", async () => {
  const order = []; let i = 0;
  const r = await checkWithRecovery({ checkOnce: async () => { order.push("check"); return verified; }, refreshOnce: async () => ({}), prepare: async () => { order.push("prepare"); throw new Error("boom"); } });
  assert.deepEqual(order, ["prepare", "check"]); assert.equal(r.result.status, "verified"); void i;
});

// ---------- 2. double-check, 3. sign-in only when the server rejects the session ----------
test("a verified answer is returned as it is: no renewal, no note", async () => {
  const r = await run([verified]);
  assert.equal(r.result.status, "verified"); assert.equal(r.refreshes, 0); assert.equal(r.checks, 1); assert.equal(r.note, null);
});

test("an unreachable server is never a sign-out: no renewal, no second check, no note", async () => {
  const r = await run([unreachable]);
  assert.equal(r.result.status, "unreachable"); assert.equal(r.refreshes, 0); assert.equal(r.checks, 1); assert.equal(r.note, null);
});

test("a 403 followed by a successful renewal is verified", async () => {
  const r = await run([out403, verified]);
  assert.equal(r.result.status, "verified"); assert.equal(r.refreshes, 1); assert.equal(r.checks, 2);
  assert.equal(r.note.recovered, true); assert.equal(r.note.inconclusive, false);
  assert.deepEqual(r.note.first, { status: "signed-out", name: "AuthApiError", http: 403, code: "bad_jwt" });
});

test("no session at all is a definite sign-out", async () => {
  const r = await run([gone, gone], { refresh: async () => ({ error: gone.error }) });
  assert.equal(r.result.status, "signed-out"); assert.equal(r.refreshes, 1); assert.equal(r.note.inconclusive, false);
});

test("a refresh token the server says is gone or already used is a definite sign-out", async () => {
  for (const code of ["refresh_token_not_found", "refresh_token_already_used", "session_not_found"]) {
    const r = await run([out403, out403], { refresh: async () => ({ error: { name: "AuthApiError", status: 400, code } }) });
    assert.equal(r.result.status, "signed-out", code); assert.equal(r.note.inconclusive, false);
  }
  const old = await run([out403, out403], { refresh: async () => ({ error: { name: "AuthApiError", status: 400, message: "Invalid Refresh Token: Refresh Token Not Found" } }) });
  assert.equal(old.result.status, "signed-out");
});

test("THE POINT: a failed check that does NOT say the session is gone is never a sign-out - it is 'unreachable', so the app opens from the device", async () => {
  const stillBad = await run([out403, out403]);                                   // renewal worked, the account check still said 403
  assert.equal(stillBad.result.status, "unreachable"); assert.equal(stillBad.note.inconclusive, true); assert.equal(stillBad.note.recovered, false);
  const server5xx = await run([out403, out403], { refresh: async () => ({ error: { name: "AuthRetryableFetchError", status: 503 } }) });
  assert.equal(server5xx.result.status, "unreachable");
  const threw = await run([out403, out403], { refresh: async () => { throw new TypeError("Failed to fetch"); } });
  assert.equal(threw.result.status, "unreachable");
  const second = await run([out403, unreachable]);
  assert.equal(second.result.status, "unreachable"); assert.equal(second.note.inconclusive, false);
});

test("exactly one renewal attempt and at most two account checks, whatever the answers", async () => {
  for (const answers of [[out403, out403], [gone, gone], [out403, verified], [out403, unreachable]]) {
    const r = await run(answers); assert.equal(r.refreshes, 1); assert.ok(r.checks <= 2);
  }
});

test("isDefinitiveSessionLoss recognises only the codes and wording that mean the session is gone", () => {
  for (const c of DEFINITIVE_CODES) assert.equal(isDefinitiveSessionLoss({ code: c }), true, c);
  for (const e of [null, undefined, {}, { name: "AuthRetryableFetchError", status: 503 }, { code: "bad_jwt", status: 403 }, { code: "over_request_rate_limit", status: 429 }, { name: "AuthUnknownError" }]) assert.equal(isDefinitiveSessionLoss(e), false, JSON.stringify(e));
  assert.equal(isDefinitiveSessionLoss({ name: "AuthSessionMissingError" }), true);
});

// ---------- privacy, wiring ----------
test("PRIVACY: a note holds names and numbers only - never a message, e-mail, token or id", async () => {
  const r = await run([out403, gone]);
  const text = JSON.stringify(r.note);
  for (const secret of ["person@example", "invalid JWT", "Auth session missing", "u1"]) assert.equal(text.includes(secret), false, secret);
  assert.deepEqual(Object.keys(r.note.first).sort(), ["code", "http", "name", "status"]);
  assert.deepEqual(describeAuthCheck({ status: "signed-out", error: { name: "x".repeat(100), status: "abc", code: 5 } }), { status: "signed-out", name: "x".repeat(40), http: null, code: "5" });
  assert.deepEqual(describeAuthCheck(null), { status: "", name: "", http: null, code: "" });
});

test("only the last eight notes are kept, newest last", () => {
  let notes = []; for (let i = 0; i < 12; i++) notes = appendAuthNote(notes, { at: String(i) });
  assert.deepEqual(notes.map(n => n.at), ["4", "5", "6", "7", "8", "9", "10", "11"]);
  assert.deepEqual(appendAuthNote("junk", { at: "a" }), [{ at: "a" }]);
});

test("the app renews first, asks through the double check, keeps the note, shows it on sign-in, and says 'can't confirm' (not 'offline') when it opens from the device", () => {
  const cs = readFileSync(fileURLToPath(new URL("../../cloudSync.js", import.meta.url)), "utf8");
  assert.match(cs, /checkWithRecovery\(\{[\s\S]*checkOnce: checkCloudUserOnce,[\s\S]*refreshOnce: \(\) => supabase\.auth\.refreshSession\(\),[\s\S]*prepare:/);
  assert.match(cs, /if \(shouldRenewFirst\(localStorage\.getItem\(authStorageKey\(\)\), Date\.now\(\)\)\) await supabase\.auth\.refreshSession\(\)/);
  assert.match(cs, /if \(note\) saveAuthNote\(note\)/);
  const gate = readFileSync(fileURLToPath(new URL("../../screens/AuthGateScreen.jsx", import.meta.url)), "utf8");
  assert.match(gate, /data-testid="auth-last-note"/);
  assert.equal(/lastNote\.(message|email|token)/.test(gate), false);
  const app = readFileSync(fileURLToPath(new URL("../../App.jsx", import.meta.url)), "utf8");
  assert.match(app, /Can't confirm your account right now\. Changes are saved on this device and will sync as soon as Arth can\./);
});
