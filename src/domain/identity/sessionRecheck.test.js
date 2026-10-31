import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkWithRecovery, describeAuthCheck, appendAuthNote } from "./sessionRecheck.js";

const verified = { status: "verified", user: { id: "u1" }, error: null };
const out403 = { status: "signed-out", user: null, error: { name: "AuthApiError", status: 403, code: "bad_jwt", message: "invalid JWT for person@example.test" } };
const gone = { status: "signed-out", user: null, error: { name: "AuthSessionMissingError", status: 400, code: "", message: "Auth session missing!" } };
const unreachable = { status: "unreachable", user: null, error: { name: "AuthRetryableFetchError", status: 0 } };
const run = (answers, refresh = async () => ({})) => { let i = 0, refreshes = 0; return checkWithRecovery({ checkOnce: async () => answers[Math.min(i++, answers.length - 1)], refreshOnce: async () => { refreshes++; return refresh(); }, now: () => "2026-10-31T01:00:00.000Z" }).then(r => ({ ...r, refreshes, checks: i })); };

test("a verified answer is returned as it is: no renewal, no note", async () => {
  const r = await run([verified]);
  assert.equal(r.result.status, "verified"); assert.equal(r.refreshes, 0); assert.equal(r.checks, 1); assert.equal(r.note, null);
});

test("an unreachable server is never a sign-out: no renewal, no second check, no note (offline resume stays as it was)", async () => {
  const r = await run([unreachable]);
  assert.equal(r.result.status, "unreachable"); assert.equal(r.refreshes, 0); assert.equal(r.checks, 1); assert.equal(r.note, null);
});

test("THE FIX: a 403 right after a renewal is double-checked - the session is renewed once and the second answer decides", async () => {
  const r = await run([out403, verified]);
  assert.equal(r.result.status, "verified");
  assert.equal(r.refreshes, 1); assert.equal(r.checks, 2);
  assert.equal(r.note.recovered, true);
  assert.deepEqual(r.note.first, { status: "signed-out", name: "AuthApiError", http: 403, code: "bad_jwt" });
});

test("a session that really is gone still signs the person out - after exactly one renewal attempt and one more check", async () => {
  const r = await run([gone, gone]);
  assert.equal(r.result.status, "signed-out"); assert.equal(r.refreshes, 1); assert.equal(r.checks, 2);
  assert.equal(r.note.recovered, false);
});

test("a renewal that throws, or a second check that cannot reach the server, is handled", async () => {
  const t = await run([out403, verified], async () => { throw new Error("boom"); });
  assert.equal(t.result.status, "verified"); assert.equal(t.refreshes, 1);
  const u = await run([out403, unreachable]);
  assert.equal(u.result.status, "unreachable"); assert.equal(u.note.recovered, false);       // not a sign-out: the app may resume offline
});

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

test("the app asks through the double check, keeps the note, and shows it on the sign-in screen", () => {
  const cs = readFileSync(fileURLToPath(new URL("../../cloudSync.js", import.meta.url)), "utf8");
  assert.match(cs, /checkWithRecovery\(\{ checkOnce: checkCloudUserOnce, refreshOnce: \(\) => supabase\.auth\.refreshSession\(\) \}\)/);
  assert.match(cs, /if \(note\) saveAuthNote\(note\)/);
  const gate = readFileSync(fileURLToPath(new URL("../../screens/AuthGateScreen.jsx", import.meta.url)), "utf8");
  assert.match(gate, /data-testid="auth-last-note"/);
  assert.equal(/lastNote\.(message|email|token)/.test(gate), false);
});
