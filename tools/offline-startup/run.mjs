// Offline-startup scenarios on a PRODUCTION BUILD of this branch, served with vercel.json's cache headers and pointed at a
// local fake backend. SYNTHETIC DATA ONLY. Every non-local request is aborted and recorded; any request to a supabase.co
// host fails the run.
//   Build:  VITE_SUPABASE_URL=http://localhost:54399 VITE_SUPABASE_ANON_KEY=synthetic-anon-key npx vite build --outDir /tmp/dist-offline-startup --emptyOutDir
//   Run:    OFFLINE_DIST=/tmp/dist-offline-startup node tools/offline-startup/run.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import crypto from "node:crypto";
import { startFakeSupabase } from "./fakeSupabase.mjs";
import * as L from "./lib.mjs";

const DIST = process.env.OFFLINE_DIST; if (!DIST) { console.error("set OFFLINE_DIST to a build made against the fake backend"); process.exit(2); }
const results = []; const rec = (id, pass, ev) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}\n      ${JSON.stringify(ev)}`); };
const note = (id, ev) => console.log(`NOTE  ${id}\n      ${JSON.stringify(ev)}`);   // observation only, not a pass/fail

// static server with vercel.json's cache headers
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
const web = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname); let f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  const h = { "content-type": types[path.extname(f)] || "application/octet-stream" };
  if (f.endsWith("index.html")) h["cache-control"] = "no-cache, no-store, must-revalidate"; else if (p.startsWith("/assets/")) h["cache-control"] = "public, max-age=31536000, immutable";
  res.writeHead(200, h); fs.createReadStream(f).pipe(res);
});
await new Promise(r => web.listen(5230, r)); const URL_ = "http://localhost:5230/";

const fake = await startFakeSupabase({ users: { [L.TOKEN]: L.USER } });
const uid = L.USER.id;
const BASE = L.syntheticTxns("B", 12); const baseIds = BASE.map(t => t.id).sort();
let ACCTS = null;   // accounts for the current scenario (default: the one synthetic bank)
const CARDS = [{ id: "syn_bank", name: "SYN Bank", type: "bank", balance: 100000, color: "#3b82f6" },
  { id: "syn_cc_a", name: "Test Card A", type: "cc", last4: "3445", statementDate: 15, dueDate: 5, limit: 100000 },
  { id: "syn_cc_b", name: "Test Card B", type: "cc", last4: "7777", statementDate: 15, dueDate: 5, limit: 100000 }];
const snapshot = extra => { const sn = { ...L.syntheticSnapshot([...BASE, ...(extra || [])], new Date().toISOString()), masterUserSetupComplete: true }; if (ACCTS) sn.accounts = ACCTS; return sn; };
const { browser, device, blocked } = await L.launch();
const ctxs = [];

async function world(cloudExtra) {
  fake.rows.clear(); fake.writeLog.length = 0; fake.stats.unconditionalWrites = 0;
  fake.rows.set(uid, { snapshot: JSON.parse(JSON.stringify(snapshot(cloudExtra))), micros: BigInt(Date.now()) * 1000n });
}
const tokenIn = (page, mutate) => page.evaluate(m => { const k = Object.keys(localStorage).find(x => /^sb-.*-auth-token$/.test(x)); if (!k) return false; const v = JSON.parse(localStorage.getItem(k)); (new Function("v", m))(v); localStorage.setItem(k, JSON.stringify(v)); return true; }, mutate);
const body = async page => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
const hasHome = async page => /Good (Morning|Afternoon|Evening|Night)/.test(await body(page));
const banner = page => page.getByTestId("offline-resume-banner").count();
const mine = page => L.localTxns(page).then(a => a.filter(t => t.merchant === "OFFLINETEST 11"));
const cloudMine = () => ((fake.rows.get(uid)?.snapshot?.txns) || []).filter(t => t.merchant === "OFFLINETEST 11").length;
async function enterPin(page, first) { await L.pin(page, first).catch(() => {}); await page.waitForTimeout(600); }
async function waitFor(fn, ms = 20000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn().catch(() => false)) return true; await new Promise(r => setTimeout(r, 250)); } return false; }
const KEEP = /Keep this device/, USE_CLOUD = /Use the cloud version/;
const conflictShown = page => body(page).then(t => /Keep this device|Use the cloud version/.test(t));
async function addTest(page) {
  await page.getByText("+", { exact: true }).first().click(); await page.waitForTimeout(500);
  await page.getByPlaceholder("0", { exact: true }).fill("11");
  await page.getByPlaceholder("e.g. Petrol, Swiggy, Netflix", { exact: true }).fill("OFFLINETEST 11");
  await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(900);
}
/** An established phone: signed in, PIN set, synthetic data, app visited online once so the offline cache is installed. */
async function phone({ signedIn = true, withData = true, setup = true, cloudExtra, cards = false } = {}) {
  ACCTS = cards ? CARDS : null;
  await world(cloudExtra);
  const d = await device("phone", { signedIn, seedLocal: withData ? { arth_txns: BASE, arth_accounts: snapshot().accounts, arth_master_user_setup_complete: setup } : { arth_master_user_setup_complete: setup } });
  ctxs.push(d.ctx);
  await d.page.goto(URL_, { waitUntil: "networkidle" });
  if (signedIn && withData) await L.pin(d.page, true); else await d.page.waitForTimeout(800);
  await d.page.waitForTimeout(800);
  await d.page.evaluate(() => navigator.serviceWorker.ready.then(() => true)).catch(() => {});
  await d.page.waitForTimeout(800);
  return d;
}
async function reopenOffline(d, { expire = false, query = "?x=1" } = {}) {
  if (expire) await tokenIn(d.page, "v.expires_at = Math.floor(Date.now()/1000) - 7200");
  await d.ctx.setOffline(true); await d.page.close();
  const page = await d.ctx.newPage(); d.page = page;
  const t0 = Date.now(); await page.goto(URL_ + query).catch(e => { d.openErr = String(e).split("\n")[0]; });
  await enterPin(page, false);
  return { page, openMs: Date.now() - t0 };
}

// ── OS1 valid saved session, offline reopen ───────────────────────────────────────────────────────────────────────
{
  const d = await phone(); const writesBefore = fake.writeLog.length;
  const { page } = await reopenOffline(d);
  const ok = await waitFor(() => hasHome(page), 15000);
  const ids = await L.localTxnIds(page);
  await addTest(page);
  const t = await mine(page);
  rec("OS1 valid session: reopens offline, shows saved data, banner shown, entry saved locally", ok && !d.openErr && JSON.stringify(ids) === JSON.stringify(baseIds) && (await banner(page)) === 1 && t.length === 1 && fake.writeLog.length === writesBefore, { opened: ok, openErr: d.openErr || null, idsIntact: JSON.stringify(ids) === JSON.stringify(baseIds), banner: await banner(page), localTest: t.length, cloudWritesWhileOffline: fake.writeLog.length - writesBefore });
  // a second cold start offline: the entry survives
  await page.close(); const p2 = await d.ctx.newPage(); d.page = p2; await p2.goto(URL_); await enterPin(p2, false); await waitFor(() => hasHome(p2), 15000);
  rec("OS1b second offline cold start: entry still there, still no cloud writes", (await mine(p2)).length === 1 && fake.writeLog.length === writesBefore, { local: (await mine(p2)).length, writes: fake.writeLog.length - writesBefore });
  // ── OS2 reconnect: nothing is sent or replaced until the person chooses
  await d.ctx.setOffline(false);
  const asked = await waitFor(() => conflictShown(p2), 30000); await p2.waitForTimeout(2500);
  const untouched = fake.writeLog.length === writesBefore && cloudMine() === 0 && fake.cloudIds(uid).length === 12;
  rec("OS2 reconnect: account confirmed, then the person is asked which copy to keep; nothing sent or replaced meanwhile", asked && untouched && (await mine(p2)).length === 1, { asked, cloudWritesBeforeChoice: fake.writeLog.length - writesBefore, cloudTest: cloudMine(), cloud: fake.cloudIds(uid).length });
  await p2.getByRole("button", { name: KEEP }).click();
  const synced = await waitFor(async () => cloudMine() === 1, 25000); await p2.waitForTimeout(2500);
  const cl = fake.cloudIds(uid); const loc = await L.localTxnIds(p2);
  rec("OS2c keep this device: entry reaches the cloud exactly once, nothing else changes, banner gone", synced && cloudMine() === 1 && baseIds.every(i => cl.includes(i)) && cl.length === 13 && JSON.stringify(cl) === JSON.stringify(loc) && (await banner(p2)) === 0, { cloudTest: cloudMine(), cloud: cl.length, local: loc.length, equal: JSON.stringify(cl) === JSON.stringify(loc) });
  await p2.reload(); await enterPin(p2, false); await p2.waitForTimeout(2500);
  rec("OS2b after reload online: still exactly one copy locally and in the cloud", (await mine(p2)).length === 1 && cloudMine() === 1 && fake.cloudIds(uid).length === 13, { local: (await mine(p2)).length, cloud: cloudMine() });
  await d.ctx.close();
}
// ── OS3/OS4 expired access token ───────────────────────────────────────────────────────────────────────────────────
{
  const d = await phone(); const writesBefore = fake.writeLog.length;
  const { page, openMs } = await reopenOffline(d, { expire: true });
  const ok = await waitFor(() => hasHome(page), 20000);
  await addTest(page);
  rec("OS3 expired token: still reopens offline within the startup limit, saved data usable, entry saved locally, banner shown", ok && (await mine(page)).length === 1 && (await banner(page)) === 1 && fake.writeLog.length === writesBefore, { opened: ok, openMs, localTest: (await mine(page)).length, banner: await banner(page), cloudWrites: fake.writeLog.length - writesBefore });
  await d.ctx.setOffline(false);
  const asked = await waitFor(() => conflictShown(page), 40000);
  const untouched = fake.writeLog.length === writesBefore && cloudMine() === 0;
  if (asked) await page.getByRole("button", { name: KEEP }).click();
  const synced = await waitFor(async () => cloudMine() === 1, 30000); await page.waitForTimeout(2500);
  const cl = fake.cloudIds(uid);
  rec("OS4 expired token, reconnect: server refreshes the session, person asked, nothing sent before choosing, entry then synced exactly once", asked && untouched && synced && cloudMine() === 1 && cl.length === 13 && baseIds.every(i => cl.includes(i)), { asked, untouchedBeforeChoice: untouched, cloudTest: cloudMine(), cloud: cl.length });
  await d.ctx.close();
}
// ── OS5 first-time device, offline: still blocked (no session, no data) ───────────────────────────────────────────
{
  await world(); const dv = await device("fresh", { signedIn: false }); ctxs.push(dv.ctx);
  await dv.page.goto(URL_, { waitUntil: "networkidle" }); await dv.page.waitForTimeout(1500);
  await dv.page.evaluate(() => navigator.serviceWorker.ready.then(() => true)).catch(() => {}); await dv.page.waitForTimeout(800);
  await dv.ctx.setOffline(true); await dv.page.close(); const page = await dv.ctx.newPage(); await page.goto(URL_); await page.waitForTimeout(6500);
  const txt = await body(page);
  rec("OS5 first-time device offline: not let in (welcome / sign-in shown, no app, no banner)", !(await hasHome(page)) && (await banner(page)) === 0 && /Welcome to Arth|Sign In|Sign Up/.test(txt), { text: txt.slice(0, 90) });
  await dv.ctx.close();
}
// ── OS6 signed in but nothing saved / setup unfinished: still blocked ─────────────────────────────────────────────
for (const [label, opts] of [["no saved data", { withData: false, setup: true }], ["setup not finished", { withData: true, setup: false }]]) {
  await world(); fake.rows.clear();   // an account with nothing in the cloud either
  const d = await device("half", { signedIn: true, seedLocal: opts.withData ? { arth_txns: BASE, arth_accounts: snapshot().accounts, arth_master_user_setup_complete: opts.setup } : { arth_master_user_setup_complete: opts.setup } }); ctxs.push(d.ctx);
  await d.page.goto(URL_, { waitUntil: "networkidle" }); await enterPin(d.page, true); await d.page.waitForTimeout(1500);
  await d.page.evaluate(() => navigator.serviceWorker.ready.then(() => true)).catch(() => {}); await d.page.waitForTimeout(800);
  await d.ctx.setOffline(true); await d.page.close(); const page = await d.ctx.newPage(); await page.goto(URL_); await enterPin(page, false); await page.waitForTimeout(7500);
  const txt = await body(page);
  rec(`OS6 signed in, ${label}, offline: not offered the offline resume (no banner)`, (await banner(page)) === 0, { text: txt.slice(0, 110), homeShown: await hasHome(page) });
  await d.ctx.close();
}
// ── OS7 session revoked while offline ─────────────────────────────────────────────────────────────────────────────
{
  const d = await phone(); const writesBefore = fake.writeLog.length;
  const { page } = await reopenOffline(d, { expire: true }); await waitFor(() => hasHome(page), 20000); await addTest(page);
  fake.revokeRefresh();                       // the server no longer honours this device's saved session
  await d.ctx.setOffline(false);
  const out = await waitFor(async () => /Welcome to Arth|Sign In|Sign Up/.test(await body(page)), 40000);
  const loc = await L.localTxns(page).catch(() => null);
  rec("OS7 session revoked meanwhile: reconnect sends the person to sign-in; saved data kept; nothing uploaded", out && fake.writeLog.length === writesBefore && JSON.stringify((await L.localTxnIds(page)).filter(i => baseIds.includes(i))) === JSON.stringify(baseIds), { signInShown: out, serverWrites: fake.writeLog.length - writesBefore, localCount: loc ? loc.length : null, hasTest: loc ? loc.filter(t => t.merchant === "OFFLINETEST 11").length : null });
  await d.ctx.close();
}
// ── OS8 normal online start is unchanged ──────────────────────────────────────────────────────────────────────────
{
  const d = await phone(); await d.ctx.setOffline(false);
  const page = d.page; await page.reload({ waitUntil: "networkidle" }); await enterPin(page, false); const ok = await waitFor(() => hasHome(page), 15000);
  await addTest(page); const synced = await waitFor(async () => cloudMine() === 1, 20000);
  rec("OS8 online start: no offline banner, entry syncs exactly once", ok && (await banner(page)) === 0 && synced && cloudMine() === 1, { home: ok, banner: await banner(page), cloudTest: cloudMine() });
  await d.ctx.close();
}
// ── OS9 another device changed the cloud while this one was offline (observation; this engine is the existing one) ──
{
  const other = [{ id: "C001", type: "expense", desc: "Other device expense", merchant: "OTHER", date: "2026-10-05", amount: 77, catId: "food", catIds: ["food"], accId: "syn_bank", people: {} }];
  const d = await phone(); const { page } = await reopenOffline(d); await waitFor(() => hasHome(page), 15000); await addTest(page);
  const writes9 = fake.writeLog.length;
  fake.rows.set(uid, { snapshot: JSON.parse(JSON.stringify(snapshot(other))), micros: BigInt(Date.now()) * 1000n });   // the other device's upload
  await d.ctx.setOffline(false); const asked = await waitFor(() => conflictShown(page), 30000); await page.waitForTimeout(3000);
  const before = { asked, cloud: fake.cloudIds(uid), cloudHasOther: fake.cloudIds(uid).includes("C001"), cloudHasTest: cloudMine(), localHasTest: (await mine(page)).length };
  rec("OS9 both devices changed: the person is asked; the other device's record and this device's entry both still exist; nothing sent", asked && before.cloudHasOther && before.localHasTest === 1 && fake.writeLog.length === writes9, before);
  if (asked) { await page.getByRole("button", { name: USE_CLOUD }).click(); await page.waitForTimeout(3500); }
  const locAfter = await L.localTxnIds(page);
  const inBackup = await page.evaluate(() => Object.keys(localStorage).some(k => /backup/i.test(k) && (localStorage.getItem(k) || "").includes("OFFLINETEST 11")));
  rec("OS9b choosing the cloud copy first backs up this device's version (the offline entry is recoverable)", inBackup, { entryFoundInLocalBackup: inBackup });
  note("OS9 after choosing 'use the cloud version' (explicit choice)", { localHasOther: locAfter.includes("C001"), localHasOfflineEntry: (await mine(page)).length, localCount: locAfter.length, cloudCount: fake.cloudIds(uid).length });
  await d.ctx.close();
}
// ── OS10 connection drops again between confirming the account and finishing the check ───────────────────────────────
{
  const d = await phone(); const { page } = await reopenOffline(d); await waitFor(() => hasHome(page), 15000); await addTest(page);
  const writes10 = fake.writeLog.length;
  await d.ctx.route("**/rest/v1/**", r => r.abort());           // the data service is unreachable, the account service is not
  await d.ctx.setOffline(false);
  await page.waitForTimeout(9000);
  const txt = await body(page);
  rec("OS10 data service drops mid-check: stays usable in offline mode (no 'Can't reach' wall), nothing sent", /Good (Morning|Afternoon|Evening|Night)/.test(txt) && (await banner(page)) === 1 && fake.writeLog.length === writes10, { home: /Good /.test(txt), banner: await banner(page), writes: fake.writeLog.length - writes10 });
  await d.ctx.unroute("**/rest/v1/**");
  await page.getByTestId("offline-resume-retry").click();
  const asked = await waitFor(() => conflictShown(page), 20000);
  rec("OS10b 'Try again' after it recovers: the person is asked which copy to keep", asked && fake.writeLog.length === writes10, { asked });
  await d.ctx.close();
}
// ═══ Combined scenarios: typed entry + offline start + reconnect + conflict choice ═══════════════════════════════════
const SENTENCE = "I paid ₹3,000 to Domino's via credit card ending 3445.";
const nlRows = () => ((fake.rows.get(uid)?.snapshot?.txns) || []).filter(t => t.merchant === "Domino's");
const nlLocal = page => L.localTxns(page).then(a => a.filter(t => t.merchant === "Domino's"));
async function openQuickAdd(page) { await page.getByText("+", { exact: true }).first().click(); await page.waitForTimeout(500); }
async function typeSentence(page, text) { await page.getByTestId("qa-nl-input").fill(text); await page.getByTestId("qa-nl-fill").click(); await page.waitForTimeout(300); }
{
  const d = await phone({ cards: true }); const writes0 = fake.writeLog.length;
  const { page } = await reopenOffline(d, {}); await waitFor(() => hasHome(page), 15000);
  await openQuickAdd(page);
  const gateOn = await page.getByTestId("qa-nl-input").count();
  await typeSentence(page, SENTENCE);
  const filled = { amount: await page.getByPlaceholder("0", { exact: true }).inputValue(), who: await page.getByPlaceholder("e.g. Petrol, Swiggy, Netflix", { exact: true }).inputValue(), account: await page.getByTestId("qa-account").inputValue() };
  const afterFill = (await nlLocal(page)).length;
  await page.getByRole("button", { name: /Save Expense/ }).dblclick({ delay: 10 }).catch(() => {}); await page.waitForTimeout(900);
  const saved = await nlLocal(page);
  rec("CI1 typed entry while offline-resumed: gate on, fill writes nothing, double-tap Save stores exactly one, charged to card 3445, nothing sent", gateOn === 1 && filled.amount === "3000" && filled.who === "Domino's" && filled.account === "syn_cc_a" && afterFill === 0 && saved.length === 1 && saved[0].accId === "syn_cc_a" && saved[0].amount === 3000 && fake.writeLog.length === writes0 && (await banner(page)) === 1, { gateOn, filled, afterFill, saved: saved.length, accId: saved[0]?.accId, cloudWrites: fake.writeLog.length - writes0, banner: await banner(page) });
  // second offline cold start (still ?nl=1): no duplicate appears
  await page.close(); const p2 = await d.ctx.newPage(); d.page = p2; await p2.goto(URL_); await enterPin(p2, false); await waitFor(() => hasHome(p2), 15000);
  rec("CI1b offline cold start again: still exactly one typed entry (no duplicate), typed entry on at the plain address", (await nlLocal(p2)).length === 1 && fake.writeLog.length === writes0, { local: (await nlLocal(p2)).length });
  // plain address while offline: gate off, ordinary Quick Add works and writes one entry
  await p2.close(); const p3 = await d.ctx.newPage(); d.page = p3; await p3.goto(URL_ + "?nl=0"); await enterPin(p3, false); await waitFor(() => hasHome(p3), 15000);
  await openQuickAdd(p3); const hidden = (await p3.getByTestId("qa-nl-input").count()) === 0;
  await p3.getByPlaceholder("0", { exact: true }).fill("22"); await p3.getByPlaceholder("e.g. Petrol, Swiggy, Netflix", { exact: true }).fill("PLAINTEST 22");
  await p3.getByRole("button", { name: /Save Expense/ }).click(); await p3.waitForTimeout(900);
  const plain = (await L.localTxns(p3)).filter(t => t.merchant === "PLAINTEST 22");
  rec("CI2 ?nl=0 offline: input hidden, ordinary Quick Add saves one entry, nothing sent", hidden && plain.length === 1 && fake.writeLog.length === writes0, { hidden, plain: plain.length });
  // refused sentences stay refused offline (reopen with ?nl=1)
  await p3.close(); const p4 = await d.ctx.newPage(); d.page = p4; await p4.goto(URL_); await enterPin(p4, false); await waitFor(() => hasHome(p4), 15000);   // plain address: typed entry is on by default
  const before4 = (await L.localTxns(p4)).length; await openQuickAdd(p4); await typeSentence(p4, "paid my credit card bill 5000");
  const refused = await p4.getByTestId("qa-nl-refused").innerText().catch(() => "");
  rec("CI3 card-bill payment sentence is refused offline and writes nothing", /card bill payment/.test(refused) && (await L.localTxns(p4)).length === before4, { refused: refused.slice(0, 60), before: before4, after: (await L.localTxns(p4)).length });
  await p4.getByRole("button", { name: "Cancel" }).click(); await p4.waitForTimeout(300);
  // reconnect: confirm account, ask; nothing sent before the choice
  await d.ctx.setOffline(false);
  const asked = await waitFor(() => conflictShown(p4), 30000); await p4.waitForTimeout(2000);
  rec("CI4 reconnect with typed + plain entries: account confirmed, person asked, still nothing sent or replaced", asked && fake.writeLog.length === writes0 && nlRows().length === 0 && fake.cloudIds(uid).length === 12, { asked, writes: fake.writeLog.length - writes0, cloud: fake.cloudIds(uid).length });
  await p4.getByRole("button", { name: KEEP }).click();
  await waitFor(async () => nlRows().length === 1, 25000); await p4.waitForTimeout(2500);
  const cl = fake.cloudIds(uid); const loc = await L.localTxnIds(p4);
  const plainCloud = ((fake.rows.get(uid)?.snapshot?.txns) || []).filter(t => t.merchant === "PLAINTEST 22").length;
  rec("CI5 keep this device: typed entry and plain entry each reach the cloud exactly once; 12 originals unchanged; local = cloud", nlRows().length === 1 && plainCloud === 1 && cl.length === 14 && baseIds.every(i => cl.includes(i)) && JSON.stringify(cl) === JSON.stringify(loc) && (await banner(p4)) === 0, { typed: nlRows().length, plain: plainCloud, cloud: cl.length, local: loc.length, equal: JSON.stringify(cl) === JSON.stringify(loc) });
  const cardRow = nlRows()[0];
  rec("CI5b the synced typed entry is a card expense: charged to the card, dated today, no bank movement recorded", cardRow && cardRow.type === "expense" && cardRow.accId === "syn_cc_a" && !((fake.rows.get(uid)?.snapshot?.txns) || []).some(t => t.type === "cc_payment"), { type: cardRow?.type, accId: cardRow?.accId });
  // after sync: the same sentence is flagged as a possible duplicate, not blocked
  await p4.reload(); await enterPin(p4, false); await p4.waitForTimeout(1500);
  await p4.goto(URL_); await enterPin(p4, false); await waitFor(() => hasHome(p4), 15000);
  await openQuickAdd(p4); await typeSentence(p4, SENTENCE);
  const dup = await p4.getByTestId("qa-nl-q-duplicate").count(); const dis = await p4.getByRole("button", { name: /Save Expense/ }).isDisabled();
  rec("CI6 same sentence after sync: flagged as possible duplicate, Save still available, nothing written by filling", dup === 1 && !dis && (await nlLocal(p4)).length === 1 && nlRows().length === 1, { dup, saveDisabled: dis });
  await d.ctx.close();
}
// both devices changed + a typed entry made offline: nothing lost before the choice; choosing the cloud copy backs the typed entry up
{
  const other = [{ id: "C001", type: "expense", desc: "Other device expense", merchant: "OTHER", date: "2026-10-05", amount: 77, catId: "food", catIds: ["food"], accId: "syn_bank", people: {} }];
  const d = await phone({ cards: true }); const { page } = await reopenOffline(d, {}); await waitFor(() => hasHome(page), 15000);
  await openQuickAdd(page); await typeSentence(page, SENTENCE); await page.getByRole("button", { name: /Save Expense/ }).click(); await page.waitForTimeout(900);
  const w = fake.writeLog.length;
  fake.rows.set(uid, { snapshot: JSON.parse(JSON.stringify(snapshot(other))), micros: BigInt(Date.now()) * 1000n });
  await d.ctx.setOffline(false); const asked = await waitFor(() => conflictShown(page), 30000); await page.waitForTimeout(2500);
  const kept = { asked, cloudHasOther: fake.cloudIds(uid).includes("C001"), localHasTyped: (await nlLocal(page)).length, writes: fake.writeLog.length - w };
  rec("CI7 other device changed the cloud meanwhile: person asked; the other device's record and the typed entry both exist; nothing sent", asked && kept.cloudHasOther && kept.localHasTyped === 1 && kept.writes === 0, kept);
  await page.getByRole("button", { name: USE_CLOUD }).click(); await page.waitForTimeout(3500);
  const inBackup = await page.evaluate(() => Object.keys(localStorage).some(k => /backup/i.test(k) && (localStorage.getItem(k) || "").includes("Domino")));
  rec("CI7b choosing the cloud copy: other device's record kept, typed entry recoverable from the backup, cloud not overwritten", inBackup && fake.cloudIds(uid).includes("C001") && (await L.localTxnIds(page)).includes("C001"), { inBackup, cloudKeepsOther: fake.cloudIds(uid).includes("C001") });
  await d.ctx.close();
}
// ── OS11 ordinary online sign-in and sign-out are unchanged; signing out leaves nothing to resume offline ───────────────
{
  const EMAIL = "sync-test-a@example.invalid";
  await world(); fake.rows.clear(); fake.resetAccounts(); const u = fake.addAccount(EMAIL);
  fake.rows.set(u.id, { snapshot: JSON.parse(JSON.stringify(snapshot())), micros: BigInt(Date.now()) * 1000n });
  const N = await device("N", { signedIn: false }); ctxs.push(N.ctx); const page = N.page;
  await page.goto(URL_, { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.getByText("Sign In", { exact: true }).click(); await page.waitForTimeout(400);
  await page.getByPlaceholder("Email address").fill(EMAIL); await page.getByRole("button", { name: "Send OTP" }).click(); await page.waitForTimeout(700);
  await page.getByPlaceholder("······").fill("123456"); await page.getByRole("button", { name: /Verify/ }).click(); await page.waitForTimeout(2500);
  if (await page.getByPlaceholder("e.g. Priya Sharma").count()) { await page.getByPlaceholder("e.g. Priya Sharma").fill("Synthetic Tester"); await page.getByRole("button", { name: /Continue into Arth/ }).click(); await page.waitForTimeout(1500); }
  await enterPin(page, true); await page.waitForTimeout(1500);
  const home = await waitFor(() => hasHome(page), 15000);
  const ids = await L.localTxnIds(page);
  rec("OS11 online sign-in on a new device: reaches the app with the account's data, no offline banner", home && JSON.stringify(ids) === JSON.stringify(baseIds) && (await banner(page)) === 0, { home, local: ids.length, banner: await banner(page) });
  await L.openCloudSettings(page); await page.getByText("Sign Out", { exact: true }).click(); await page.waitForTimeout(2000);
  const welcome = /Welcome to Arth|Sign In|Sign Up/.test(await body(page));
  const keptLocal = (await L.localTxnIds(page)).length;
  await N.ctx.setOffline(true); await page.close(); const p2 = await N.ctx.newPage(); await p2.goto(URL_).catch(() => {}); await enterPin(p2, false); await p2.waitForTimeout(7000);
  rec("OS11b signed out: Welcome shown, data kept on the device, and reopening offline does NOT resume (no saved session)", welcome && keptLocal === 12 && (await banner(p2)) === 0 && !(await hasHome(p2)), { welcome, keptLocal, banner: await banner(p2), home: await hasHome(p2) });
  await N.ctx.close();
}
await browser.close(); web.close();
rec("SAFE no request ever went to a supabase host", !blocked.some(u => /supabase\.co/.test(u)), { nonLocalAborted: [...new Set(blocked.map(u => new URL(u).hostname))] });
console.log("\noutcome vector:", JSON.stringify(results));
const dir = new URL("./results/", import.meta.url).pathname; fs.mkdirSync(dir, { recursive: true });
const rec_ = JSON.stringify({ at: new Date().toISOString(), results }, null, 2);
fs.writeFileSync(dir + `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, rec_);
process.exit(results.every(r => r.pass) ? 0 : 1);
