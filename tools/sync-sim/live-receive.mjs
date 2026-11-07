// Live receiving + open-from-the-phone, in the REAL app (Chromium) against the local synthetic Supabase stand-in. SYNTHETIC DATA ONLY.
// A CHROMIUM check with a model backend. It says nothing about real Supabase, a real phone, or Android.
// Setup:  VITE_SUPABASE_URL=http://localhost:54399 VITE_SUPABASE_ANON_KEY=synthetic VITE_FORCE_DEV_AUTH_BYPASS=false node node_modules/vite/bin/vite.js --port 5196 &
// Run:    node tools/sync-sim/live-receive.mjs
import { startFakeSupabase } from "./fakeSupabase.mjs";
import * as L from "./lib.mjs";

const envProbe = await fetch(L.APP + "src/cloudSync.js").then(r => r.text()).catch(() => "");
if (!/VITE_SUPABASE_URL"\s*:\s*"http:\/\/localhost:54399"/.test(envProbe)) { console.error("REFUSING TO RUN: the dev server is not configured with VITE_SUPABASE_URL=http://localhost:54399"); process.exit(2); }

const results = []; const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const fake = await startFakeSupabase({ users: { [L.TOKEN]: L.USER } });
const { browser, device, blocked } = await L.launch();
const uid = L.USER.id;
const accounts = L.syntheticSnapshot([], "x").accounts;
const BASE = L.syntheticTxns("B", 12);
const HOME = /LEFT IN BUDGET|Good (Morning|Afternoon|Evening)/i;
const T = (p, id) => p.getByTestId(id);
const snapReqs = from => fake.requestLog.slice(from).filter(r => r.path.startsWith("/rest/v1/arth_snapshots") && r.method === "GET");

try {
  const A = await device("A", { seedLocal: { arth_txns: BASE, arth_accounts: accounts, arth_master_user_setup_complete: true, arth_data_owner: { userId: uid, email: L.USER.email, at: "2026-11-01T00:00:00Z", source: "session" } } });
  await A.page.goto(L.APP, { waitUntil: "networkidle" }); await L.pin(A.page, true);
  rec("V0 device A uploaded its data and has agreed with the cloud", await L.waitFor(async () => { const s = await L.syncState(A.page); return fake.cloudIds(uid).length === BASE.length && s && s.baseToken && !s.pendingWrite; }, { timeout: 30000 }), { cloud: fake.cloudIds(uid).length });

  // L1: idle, nothing changed: only tiny version-stamp looks, no full downloads, no writes
  const from = fake.requestLog.length, writes0 = fake.writeLog.length;
  await A.page.waitForTimeout(46000);
  const reqs = snapReqs(from);
  rec("L1 while idle Arth looks at the cloud's version stamp only (>= 2 looks in 46 s, every one asking for updated_at alone), and writes nothing", reqs.length >= 2 && reqs.every(r => /select=updated_at(&|$)/.test(r.path)) && fake.writeLog.length === writes0, { looks: reqs.length, paths: [...new Set(reqs.map(r => r.path.split("?")[1]))], writes: fake.writeLog.length - writes0 });

  // L2: another device saves; this one receives it without being touched
  const row = fake.rows.get(uid); const snap = JSON.parse(JSON.stringify(row.snapshot));
  snap.txns.push({ ...L.syntheticTxns("LIVE", 1)[0], desc: "Saved on the other device" }); snap.savedAt = new Date().toISOString();
  const t0 = Date.now(); fake.seed(uid, snap, new Date(Date.now() + 1000).toISOString());
  const got = await L.waitFor(async () => (await L.localTxnIds(A.page)).includes("LIVE001"), { timeout: 50000, step: 500 });
  const secs = Math.round((Date.now() - t0) / 1000);
  rec("L2 a change saved by another device reaches this open device within 45 s, with no reopening or tapping", got && secs <= 45, { seconds: secs });
  const bks = await L.safetyBackups(A.page);
  rec("L3 this device's previous data was backed up (verified) before the newer copy was taken", bks.some(b => b.reason === "before-fast-forward"), bks);
  const st = await L.syncState(A.page);
  rec("L4 afterwards it is in agreement with the cloud again and nothing was written back", Boolean(st.baseToken) && !st.pendingWrite && !st.conflict && fake.writeLog.filter(w => w.kind === "swap" && w.outcome === "applied").length === 0, { conflict: st.conflict, pending: st.pendingWrite });

  // L5: open at once from the phone's data while the data calls are slow
  fake.faults.restLatencyMs = 25000;
  await A.page.goto(L.APP, { waitUntil: "domcontentloaded" }); await L.pin(A.page, false);
  const tOpen = Date.now();
  const opened = await L.waitFor(async () => HOME.test(await L.bodyText(A.page)), { timeout: 8000, step: 250 });
  const body = await L.bodyText(A.page);
  rec("L5 with slow data calls the app is open from this phone's data within 8 s (no 'Loading your data…' wait)", opened && !/Loading your data/.test(body), { ms: Date.now() - tOpen, loadingText: /Loading your data/.test(body) });
  rec("L6 a small 'Syncing with your account…' line shows while it works in the background", (await T(A.page, "first-sync-banner").count()) === 1, {});
  fake.faults.restLatencyMs = 0;
  rec("L7 the line goes away once the first sync finishes", await L.waitFor(async () => (await T(A.page, "first-sync-banner").count()) === 0, { timeout: 60000, step: 500 }), {});

  // L8 (control): nothing on the phone -> it must still wait for the cloud copy, as before
  const B = await device("B", { seedLocal: {} });
  fake.faults.restLatencyMs = 25000;
  await B.page.goto(L.APP, { waitUntil: "domcontentloaded" }); await L.pin(B.page, true); await B.page.waitForTimeout(3000);
  const bBody = await L.bodyText(B.page);
  rec("L8 (control) a device with NOTHING saved still waits for the cloud copy and does not open an empty app", /Loading your data|Checking your account/.test(bBody) && !HOME.test(bBody), bBody.slice(0, 80).replace(/\n/g, " | "));
  fake.faults.restLatencyMs = 0;

  rec("L9 nothing left the machine (the page's Google Fonts request is blocked by the harness) and no unconditional cloud write happened", blocked.filter(u => !/fonts\.(googleapis|gstatic)\.com/.test(u)).length === 0 && fake.stats.unconditionalWrites === 0, { blocked: blocked.filter(u => !/fonts\.(googleapis|gstatic)\.com/.test(u)).slice(0, 2), unconditional: fake.stats.unconditionalWrites });
  rec("L10 no page errors", A.errors.length === 0 && B.errors.length === 0, [...A.errors, ...B.errors].slice(0, 2));
} catch (e) { rec("RUN", false, String(e).slice(0, 300)); }
finally { await browser.close(); await fake.close(); }
const bad = results.filter(r => !r.pass).length; console.log(`\n${results.length - bad}/${results.length} passed`); process.exit(bad ? 1 : 0);
