import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseAuthCallback, authCallbackUrl } from "./authRedirect.js";
import { createAuthCallbackHandler } from "./authCallback.js";

const GOOD = "https://arth-app.vercel.app/auth/callback?code=abcdef1234567890";
const mk = ({ session = null, exchange } = {}) => {
  const calls = [];
  return { calls, client: { auth: {
    getSession: async () => ({ data: { session } }),
    exchangeCodeForSession: async c => { calls.push(c); return exchange ? exchange(c) : { data: { session: { x: 1 } }, error: null }; },
  } } };
};

test("parser accepts only the exact callback", () => {
  assert.equal(parseAuthCallback(GOOD).ok, true);
  for (const u of ["https://evil.example/auth/callback?code=abcdef1234567890", "https://arth-app.vercel.app.evil.com/auth/callback?code=abcdef1234567890",
    "http://arth-app.vercel.app/auth/callback?code=abcdef1234567890", "https://user:pw@arth-app.vercel.app/auth/callback?code=abcdef1234567890",
    "https://arth-app.vercel.app/other?code=abcdef1234567890", "com.parixitpopat.arth://auth/callback?code=abcdef1234567890", "not a url"])
    assert.equal(parseAuthCallback(u).kind, "untrusted", u);
  assert.equal(parseAuthCallback("com.parixitpopat.arth://auth/callback?code=abcdef1234567890", { allowDevScheme: true }).ok, true);
  assert.equal(parseAuthCallback("https://arth-app.vercel.app/auth/callback#access_token=a.b.c").kind, "missing-code");
  assert.equal(parseAuthCallback("https://arth-app.vercel.app/auth/callback?code=x%20y").kind, "missing-code");
  assert.equal(parseAuthCallback("https://arth-app.vercel.app/auth/callback?error_code=otp_expired").kind, "error");
  assert.equal(authCallbackUrl(), "https://arth-app.vercel.app/auth/callback");
});

test("good link is exchanged once; reuse is ignored", async () => {
  const { client, calls } = mk(); const h = createAuthCallbackHandler({ client });
  assert.equal((await h.handle(GOOD)).ok, true);
  assert.equal((await h.handle(GOOD)).reason, "duplicate");
  assert.deepEqual(calls, ["abcdef1234567890"]);
  assert.equal(h.getState().status, "done");
});

test("untrusted link does nothing", async () => {
  const { client, calls } = mk(); const h = createAuthCallbackHandler({ client });
  assert.equal((await h.handle("https://evil.example/auth/callback?code=abcdef1234567890")).handled, false);
  assert.equal(calls.length, 0); assert.equal(h.getState().status, "idle");
});

test("expired / used link gives a friendly message without the code", async () => {
  const { client } = mk({ exchange: async () => ({ data: {}, error: { name: "AuthApiError", code: "flow_state_expired", message: "secret abcdef1234567890" } }) });
  const h = createAuthCallbackHandler({ client }); await h.handle(GOOD);
  const s = h.getState(); assert.equal(s.status, "error"); assert.match(s.message, /expired/); assert.ok(!s.message.includes("abcdef"));
  const r = createAuthCallbackHandler({ client: mk({ exchange: async () => ({ data: {}, error: { name: "AuthApiError", code: "flow_state_not_found", message: "x" } }) }).client });
  await r.handle(GOOD); assert.match(r.getState().message, /already used/);
  const e = createAuthCallbackHandler({ client }); await e.handle("https://arth-app.vercel.app/auth/callback?error_code=otp_expired");
  assert.match(e.getState().message, /expired/);
});

test("already signed in: no exchange, no account switch", async () => {
  const { client, calls } = mk({ session: { user: 1 } }); const h = createAuthCallbackHandler({ client });
  assert.equal((await h.handle(GOOD)).reason, "signed-in"); assert.equal(calls.length, 0);
});

test("network failure can be retried by tapping the link again", async () => {
  let n = 0;
  const { client } = mk({ exchange: async () => (++n === 1 ? { data: {}, error: { name: "AuthRetryableFetchError", message: "x" } } : { data: { session: {} }, error: null }) });
  const h = createAuthCallbackHandler({ client });
  assert.equal((await h.handle(GOOD)).ok, false); assert.match(h.getState().message, /connection/);
  assert.equal((await h.handle(GOOD)).ok, true);
});

test("code and session are never logged", async () => {
  const seen = []; const orig = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a) => seen.push(a.join(" "));
  try { const { client } = mk({ exchange: async () => ({ data: {}, error: { name: "x", message: "abcdef1234567890" } }) }); await createAuthCallbackHandler({ client }).handle(GOOD); }
  finally { Object.assign(console, orig); }
  assert.deepEqual(seen, []);
  for (const f of ["src/authCallback.js", "src/nativeAuthLinks.js", "src/authRedirect.js"]) assert.ok(!/console\./.test(fs.readFileSync(f, "utf8")), f);
});

test("static: manifest, assetlinks, rewrite, native-only PKCE", () => {
  const m = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  assert.match(m, /autoVerify="true"[\s\S]*android:host="arth-app.vercel.app" android:path="\/auth\/callback"/);
  assert.ok(!/android:scheme="com\.parixitpopat\.arth"/.test(m), "custom scheme must be debug-only");
  assert.match(fs.readFileSync("android/app/src/debug/AndroidManifest.xml", "utf8"), /android:scheme="com\.parixitpopat\.arth"/);
  const a = JSON.parse(fs.readFileSync("public/.well-known/assetlinks.json", "utf8"));
  assert.equal(a[0].target.package_name, "com.parixitpopat.arth");
  assert.ok(JSON.parse(fs.readFileSync("vercel.json", "utf8")).rewrites.some(r => r.source === "/auth/callback"));
  const c = fs.readFileSync("src/cloudSync.js", "utf8");
  assert.match(c, /isNativeApp\(\) \? \{ auth: \{ flowType: "pkce", detectSessionInUrl: false \} \} : undefined/);
  assert.match(c, /isNativeApp\(\) \? \{ shouldCreateUser, emailRedirectTo: authCallbackUrl\(\) \} : \{ shouldCreateUser \}/);
});
