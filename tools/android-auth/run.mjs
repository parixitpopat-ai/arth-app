// Android sign-in handoff harness: the real production build, run in Chromium with an emulated Capacitor Android bridge
// (appUrlOpen / getLaunchUrl) against the SYNTHETIC fake backend with PKCE. SYNTHETIC DATA ONLY; nothing leaves localhost.
// Not a phone: it proves the app's behaviour, NOT that Android routes the emailed link to the app (that needs a device).
//   Build: VITE_SUPABASE_URL=http://localhost:54399 VITE_SUPABASE_ANON_KEY=synthetic-anon-key VITE_AUTH_ALLOW_DEV_SCHEME=1 npx vite build --outDir /tmp/dist-android-auth --emptyOutDir
//   Run:   OFFLINE_DIST=/tmp/dist-android-auth node tools/android-auth/run.mjs     (prints one JSON line + hash)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
import { startFakeSupabase } from "../offline-startup/fakeSupabase.mjs";
import * as L from "../offline-startup/lib.mjs";
const DIST = process.env.OFFLINE_DIST; if (!DIST) { console.error("set OFFLINE_DIST"); process.exit(2); }
const web = http.createServer((req, res) => { const p = new URL(req.url, "http://x").pathname; let f = path.join(DIST, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  const t = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".svg": "image/svg+xml" }[path.extname(f)] || "application/octet-stream"; res.writeHead(200, { "content-type": t }); fs.createReadStream(f).pipe(res); });
await new Promise(r => web.listen(5241, r)); const APP = "http://localhost:5241/";
const fake = await startFakeSupabase({ users: {} });
const CB = "https://arth-app.vercel.app/auth/callback";
const { browser, device, blocked } = await L.launch();
const issue = async (email, expired) => (await (await fetch(`${L.FAKE}/__ctl/issueCode?email=${encodeURIComponent(email)}${expired ? "&expired=1" : ""}`)).json()).code;
const authLog = async () => (await fetch(`${L.FAKE}/__ctl/authlog`)).json();
const session = page => page.evaluate(() => { try { return Boolean(JSON.parse(localStorage.getItem("sb-localhost-auth-token") || "null")?.access_token); } catch { return false; } });
const body = async page => (await L.bodyText(page)).replace(/\s+/g, " ");

// Emulated Android bridge: records nothing sensitive; delivers appUrlOpen on demand; getLaunchUrl returns window.__launchUrl.
const bridge = () => {
  let seq = 0; const cbs = {}; window.__listeners = {};
  const send = (pluginId, methodName, options, callbackId) => window.androidBridge.postMessage(JSON.stringify({ callbackId, pluginId, methodName, options }));
  window.androidBridge = { postMessage(str) {
    const m = JSON.parse(str); const done = data => setTimeout(() => cbs[m.callbackId]?.(data), 0);
    if (m.methodName === "addListener") { window.__listeners[m.options.eventName] = m.callbackId; return done(undefined); }
    if (m.methodName === "getLaunchUrl") return done(window.__launchUrl ? { url: window.__launchUrl } : {});
    done({});
  } };
  window.Capacitor = {
    PluginHeaders: [{ name: "App", methods: [{ name: "addListener", rtype: "callback" }, { name: "removeListener", rtype: "promise" }, { name: "getLaunchUrl", rtype: "promise" }] }],
    nativePromise: (p, mth, o) => new Promise(res => { const id = "c" + ++seq; cbs[id] = res; send(p, mth, o, id); }),
    nativeCallback: (p, mth, o, cb) => { const id = "c" + ++seq; cbs[id] = cb; send(p, mth, o, id); return Promise.resolve(id); },
  };
  window.__openUrl = url => cbs[window.__listeners.appUrlOpen]?.({ url });
};
async function phone(name, { native = true, launchUrl = null, seed } = {}) {
  const d = await device(name, { signedIn: false, seedLocal: seed });
  if (native) await d.ctx.addInitScript(bridge);
  if (launchUrl) await d.ctx.addInitScript(u => { window.__launchUrl = u; }, launchUrl);
  return d;
}
async function requestCode(page, email, mode) {
  await page.goto(APP, { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  await page.getByText(mode === "signup" ? "Sign Up" : "Sign In", { exact: true }).click(); await page.waitForTimeout(300);
  await page.getByPlaceholder("Email address").fill(email); await page.getByRole("button", { name: "Send OTP" }).click(); await page.waitForTimeout(900);
}
const out = {};
const MARK = { arth_marker_local: "local-data-kept" };
const kept = page => page.evaluate(() => localStorage.getItem("arth_marker_local"));

// 1. Fresh sign-up, app running: link opens the app, no second login.
{ const d = await phone("signup", { seed: MARK }); const p = d.page; await requestCode(p, "new-user@example.invalid", "signup");
  const code = await issue("new-user@example.invalid"); await p.evaluate(u => window.__openUrl(u), `${CB}?code=${code}`); await p.waitForTimeout(2500);
  const t = await body(p);
  out.signup = { pkceRequest: (await authLog()).some(e => e.op === "otp" && e.pkce), sessionStored: await session(p), nextIsProfile: /Priya Sharma|Continue into Arth|Your name|name/i.test(t), backAtSignIn: /Verify & continue|Send OTP/.test(t), localKept: await kept(p) }; await d.ctx.close(); }

// 2. Existing user, app running (account created above): sign in; plus request carried the redirect URL.
{ const d = await phone("signin", { seed: MARK }); const p = d.page; await requestCode(p, "new-user@example.invalid", "signin");
  const code = await issue("new-user@example.invalid"); await p.evaluate(u => window.__openUrl(u), `${CB}?code=${code}`); await p.waitForTimeout(2500);
  const t = await body(p); const log = await authLog();
  out.signin = { sessionStored: await session(p), backAtSignIn: /Verify & continue|Send OTP/.test(t), redirectToSent: log.filter(e => e.op === "otp").every(e => e.redirectTo === CB), localKept: await kept(p) }; await d.ctx.close(); }

// 3. Expired link.
{ const d = await phone("expired"); const p = d.page; await requestCode(p, "new-user@example.invalid", "signin");
  const code = await issue("new-user@example.invalid", true); await p.evaluate(u => window.__openUrl(u), `${CB}?code=${code}`); await p.waitForTimeout(1500);
  out.expired = { session: await session(p), banner: await p.getByTestId("auth-callback-error").innerText().catch(() => null), stillTypedCodePath: (await p.getByPlaceholder("······").count()) > 0 };
  // typed code still works afterwards
  await p.getByTestId("auth-callback-error").getByRole("button").click().catch(() => {}); await p.getByPlaceholder("······").fill("123456"); await p.getByRole("button", { name: /Verify/ }).click(); await p.waitForTimeout(2500);
  out.expired.typedCodeAfter = await session(p); await d.ctx.close(); }

// 4. Reused link: same link a second time (same app run, then after losing the session).
{ const d = await phone("reused"); const p = d.page; await requestCode(p, "new-user@example.invalid", "signin");
  const exchBase = (await authLog()).filter(e => e.op === "pkce").length + 1;   // the one legitimate exchange
  const code = await issue("new-user@example.invalid"); const url = `${CB}?code=${code}`;
  await p.evaluate(u => window.__openUrl(u), url); await p.waitForTimeout(2000); const first = await session(p);
  await p.evaluate(u => window.__openUrl(u), url); await p.waitForTimeout(800);
  const exch0 = (await authLog()).filter(e => e.op === "pkce").length;
  await p.evaluate(() => { localStorage.removeItem("sb-localhost-auth-token"); }); await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(800);
  await p.evaluate(u => window.__openUrl(u), url); await p.waitForTimeout(1500);
  out.reused = { firstOk: first, sessionAfterReplay: await session(p), banner: await p.getByTestId("auth-callback-error").innerText().catch(() => null), exchangesAfterDuplicateTap: exch0 - exchBase }; await d.ctx.close(); }

// 5. App closed: the link is the launch URL.
{ const d = await phone("closed"); const p = d.page; await requestCode(p, "new-user@example.invalid", "signin");
  const code = await issue("new-user@example.invalid"); await p.close();
  await d.ctx.addInitScript(u => { window.__launchUrl = u; }, `${CB}?code=${code}`);
  const p2 = await d.ctx.newPage(); await p2.goto(APP, { waitUntil: "networkidle" }); await p2.waitForTimeout(2500);
  out.closed = { sessionStored: await session(p2), backAtSignIn: /Verify & continue|Send OTP/.test(await body(p2)) }; await d.ctx.close(); }

// 6. Untrusted links are ignored; a link for a different request (no verifier) fails safely; signed-in user is never switched.
{ const d = await phone("untrusted"); const p = d.page; await requestCode(p, "new-user@example.invalid", "signin");
  const before = (await authLog()).filter(e => e.op === "pkce").length;
  for (const u of ["https://evil.example/auth/callback?code=authcode-zzzzzzzzzzzz", "http://arth-app.vercel.app/auth/callback?code=authcode-zzzzzzzzzzzz"]) await p.evaluate(x => window.__openUrl(x), u);
  await p.waitForTimeout(800);
  out.untrusted = { exchanged: (await authLog()).filter(e => e.op === "pkce").length - before, session: await session(p), banner: await p.getByTestId("auth-callback-error").count() };
  // dev scheme link accepted only because this test build sets VITE_AUTH_ALLOW_DEV_SCHEME=1
  await requestCode(p, "new-user@example.invalid", "signin");
  const code = await issue("new-user@example.invalid"); await p.evaluate(u => window.__openUrl(u), `com.parixitpopat.arth://auth/callback?code=${code}`); await p.waitForTimeout(2000);
  out.untrusted.devSchemeSignsIn = await session(p);
  const t0 = await p.evaluate(() => localStorage.getItem("sb-localhost-auth-token"));
  await fake.addAccount?.("other@example.invalid");
  await p.evaluate(u => window.__openUrl(u), `${CB}?code=authcode-qqqqqqqqqqqq`); await p.waitForTimeout(800);
  out.untrusted.signedInUnchanged = (await p.evaluate(() => localStorage.getItem("sb-localhost-auth-token"))) === t0; await d.ctx.close(); }

// 7. Web (not the installed app): unchanged request, no redirect, no pkce.
{ const before = (await authLog()).length; const d = await phone("web", { native: false }); const p = d.page; await requestCode(p, "new-user@example.invalid", "signin");
  const e = (await authLog()).slice(before).find(x => x.op === "otp"); out.web = { pkce: e?.pkce, redirectTo: e?.redirectTo }; await p.getByPlaceholder("······").fill("123456"); await p.getByRole("button", { name: /Verify/ }).click(); await p.waitForTimeout(2200);
  out.web.typedCodeSignsIn = await session(p); await d.ctx.close(); }

// 8. Real local data + a different cloud copy: signing in through the LINK must behave exactly like the typed code (conflict choice, nothing lost).
{
  const snap = txns => ({ ...L.syntheticSnapshot(txns, new Date().toISOString()), masterUserSetupComplete: true });
  const LOCAL = L.syntheticTxns("L", 6), CLOUD = L.syntheticTxns("C", 9);
  const accts = snap([]).accounts;
  const run = async (via, email) => {
    const u = fake.addAccount(email); fake.rows.set(u.id, { snapshot: JSON.parse(JSON.stringify(snap(CLOUD))), micros: BigInt(Date.now()) * 1000n });
    const d = await phone("data-" + via, { seed: { arth_txns: LOCAL, arth_accounts: accts, arth_master_user_setup_complete: true } }); const p = d.page;
    await requestCode(p, email, "signin");
    if (via === "link") { const code = await issue(email); await p.evaluate(x => window.__openUrl(x), `${CB}?code=${code}`); }
    else { await p.getByPlaceholder("······").fill("123456"); await p.getByRole("button", { name: /Verify/ }).click(); }
    await p.waitForTimeout(3500);
    const o = { choiceScreen: /Two versions of your data found/.test(await body(p)), localIds: (await L.localTxnIds(p)).sort().join(","), cloudIds: L.cloudTxnIds(fake, u.id).join(","), session: await session(p) };
    await d.ctx.close(); return o;
  };
  const viaLink = await run("link", "data-link@example.invalid"), viaCode = await run("code", "data-code@example.invalid");
  out.localData = { viaLink, sameAsTypedCode: JSON.stringify(viaLink) === JSON.stringify(viaCode), localUntouched: viaLink.localIds === L.syntheticTxns("L", 6).map(t => t.id).sort().join(",") };
}

out.productionRequests = blocked.length;
const json = JSON.stringify(out, null, 1);
console.log("ANDROID_AUTH " + JSON.stringify(out)); console.log("HASH " + crypto.createHash("md5").update(JSON.stringify(out)).digest("hex"));
await browser.close(); web.close(); process.exit(0);
