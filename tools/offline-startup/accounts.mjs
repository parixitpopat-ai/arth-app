// Account-isolation scenarios in the real app (SYNC-SAFETY-008). SYNTHETIC DATA ONLY, local fake backend, no request leaves localhost.
// One phone, accounts A and B: A signs in and syncs, signs out, B signs in. Checks the SCREEN and what actually reached the cloud.
//   Build: VITE_SUPABASE_URL=http://localhost:54399 VITE_SUPABASE_ANON_KEY=synthetic-anon-key npx vite build --outDir /tmp/dist-accounts --emptyOutDir
//   Run:   OFFLINE_DIST=/tmp/dist-accounts node tools/offline-startup/accounts.mjs      (prints PASS/FAIL lines, an outcome vector and its hash)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
import { startFakeSupabase } from "./fakeSupabase.mjs";
import * as L from "./lib.mjs";
const DIST = process.env.OFFLINE_DIST; if (!DIST) { console.error("set OFFLINE_DIST"); process.exit(2); }
const web = http.createServer((req, res) => { const p = new URL(req.url, "http://x").pathname; let f = path.join(DIST, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
  const t = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".svg": "image/svg+xml" }[path.extname(f)] || "application/octet-stream"; res.writeHead(200, { "content-type": t }); fs.createReadStream(f).pipe(res); });
await new Promise(r => web.listen(5234, r)); const URL_ = "http://localhost:5234/";
const fake = await startFakeSupabase({ users: {} });
const EA = "account-a@example.invalid", EB = "account-b@example.invalid";
const ATX = L.syntheticTxns("A", 12), BTX = L.syntheticTxns("Z", 5);
const snap = (txns, extra = {}) => ({ ...L.syntheticSnapshot(txns, new Date().toISOString()), masterUserSetupComplete: true, ...extra });
const results = []; const rec = (id, pass, ev) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}\n      ${JSON.stringify(ev)}`); };
const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null; const run = id => !only || only.has(id);
const { browser, device, blocked } = await L.launch();
const body = async p => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
const wait = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn().catch(() => false)) return true; await new Promise(r => setTimeout(r, 250)); } return false; };
const cloudIds = u => L.cloudTxnIds(fake, u.id);
const ownerOf = p => p.evaluate(() => { try { return JSON.parse(localStorage.getItem("arth_data_owner") || "null"); } catch { return null; } });
const backupsHave = (p, prefix) => p.evaluate(px => (JSON.parse(localStorage.getItem("arth_sync_safety_backups") || "[]")).filter(b => (b.snapshot?.txns || []).some(t => String(t.id).startsWith(px))).map(b => b.reason), prefix);

async function login(p, email, { first = true } = {}) {
  await p.goto(URL_, { waitUntil: "networkidle" }); await p.waitForTimeout(600);
  await p.getByText("Sign In", { exact: true }).click(); await p.waitForTimeout(400);
  await p.getByPlaceholder("Email address").fill(email); await p.getByRole("button", { name: "Send OTP" }).click(); await p.waitForTimeout(700);
  await p.getByPlaceholder("······").fill("123456"); await p.getByRole("button", { name: /Verify/ }).click(); await p.waitForTimeout(3000);
  if (await p.getByPlaceholder("e.g. Priya Sharma").count()) { await p.getByPlaceholder("e.g. Priya Sharma").fill("Synthetic Tester"); await p.getByRole("button", { name: /Continue into Arth/ }).click(); await p.waitForTimeout(1500); }
}
/** A phone on which account A has signed in (its cloud holds A's data), synced, and signed out. */
async function phoneAfterA({ bCloud = null, seedLocalExtra = {}, afterA = null } = {}) {
  fake.rows.clear(); fake.writeLog.length = 0; fake.stats.unconditionalWrites = 0; fake.resetAccounts();
  const ua = fake.addAccount(EA), ub = fake.addAccount(EB);
  fake.rows.set(ua.id, { snapshot: JSON.parse(JSON.stringify(snap(ATX))), micros: BigInt(Date.now()) * 1000n });
  if (bCloud) fake.rows.set(ub.id, { snapshot: JSON.parse(JSON.stringify(bCloud)), micros: BigInt(Date.now()) * 1000n });
  const d = await device("phone", { signedIn: false, seedLocal: seedLocalExtra }); const p = d.page;
  await login(p, EA); await L.pin(p, true).catch(() => {}); await p.waitForTimeout(2500);
  const syncedA = await wait(async () => (await L.localTxnIds(p)).length === 12);
  if (afterA) await afterA(p);
  await L.openCloudSettings(p); await p.getByText("Sign Out", { exact: true }).click(); await p.waitForTimeout(2000);
  return { d, p, ua, ub, syncedA };
}
async function signInB(p) { await login(p, EB); await L.pin(p, false).catch(() => {}); await p.waitForTimeout(2500); }
const onOwnership = p => body(p).then(t => /has account-a@example\.invalid's data|Nothing has been sent to the cloud or deleted/.test(t));

// AS1: B's cloud EMPTY.
if (run("AS1")) { const { d, p, ub, ua } = await phoneAfterA(); const writes0 = fake.writeLog.length; await signInB(p);
  const asked = await wait(() => onOwnership(p), 15000); await p.waitForTimeout(2500);
  rec("AS1 A -> sign out -> B (empty cloud): the person is asked; nothing uploaded, no row created for B, A's 12 transactions still on the phone, A's cloud untouched",
    asked && fake.writeLog.length === writes0 && !fake.rows.has(ub.id) && (await L.localTxnIds(p)).length === 12 && cloudIds(ua).length === 12 && fake.stats.unconditionalWrites === 0,
    { asked, writes: fake.writeLog.length - writes0, bRow: fake.rows.has(ub.id), local: (await L.localTxnIds(p)).length, owner: (await ownerOf(p))?.email });
  await d.ctx.close(); }

// AS5: signing out from the question changes nothing.
if (run("AS5")) { const { d, p, ub } = await phoneAfterA(); const writes0 = fake.writeLog.length; await signInB(p); await wait(() => onOwnership(p), 15000);
  await p.getByTestId("ownership-sign-out").click(); await p.waitForTimeout(2500);
  const t = await body(p), cond = { welcome: /Welcome to Arth|Sign in to Arth|Sign In|Sign Up/.test(t), kept: (await L.localTxnIds(p)).length === 12, noRow: !fake.rows.has(ub.id), noWrites: fake.writeLog.length === writes0 };
  rec("AS5 'Sign out and decide later': back at Welcome, phone data kept, nothing sent", Object.values(cond).every(Boolean), { ...cond, text: t.slice(0, 80), writes: fake.writeLog.length - writes0 });
  await d.ctx.close(); }

// AS2 + AS6: B's cloud POPULATED; then close and reopen on the question.
if (run("AS2")) { const { d, p, ub, ua } = await phoneAfterA({ bCloud: snap(BTX) }); const rowB = JSON.stringify(fake.rows.get(ub.id)?.snapshot?.txns); const writes0 = fake.writeLog.length; await signInB(p);
  const asked = await wait(() => onOwnership(p), 15000); await p.waitForTimeout(2500);
  rec("AS2 A -> sign out -> B (populated cloud): the person is asked; B's cloud copy is unchanged (5), nothing written", asked && JSON.stringify(fake.rows.get(ub.id)?.snapshot?.txns) === rowB && fake.writeLog.length === writes0 && cloudIds(ub).length === 5, { asked, bCloud: cloudIds(ub).length, writes: fake.writeLog.length - writes0 });
  await p.reload({ waitUntil: "networkidle" }); await L.pin(p, false).catch(() => {}); await p.waitForTimeout(3000);
  rec("AS6 app closed on the question and reopened (B's session restored): asked again, still nothing sent", (await onOwnership(p)) && fake.writeLog.length === writes0 && cloudIds(ub).length === 5, { asked: await onOwnership(p), writes: fake.writeLog.length - writes0 });
  // AS3: start fresh, populated
  await p.getByTestId("ownership-start-fresh").click(); await p.waitForTimeout(3500);
  const loc = await L.localTxnIds(p); const bk = await backupsHave(p, "A");
  rec("AS3 start fresh (populated cloud): the phone shows exactly B's 5 transactions, none of A's; A's 12 are in a pinned backup and still in A's cloud; B's cloud unchanged", loc.length === 5 && loc.every(i => i.startsWith("Z")) && cloudIds(ub).length === 5 && cloudIds(ub).every(i => i.startsWith("Z")) && cloudIds(ua).length === 12 && bk.includes("other-account-device-copy"), { local: loc.length, bCloud: cloudIds(ub).length, aCloud: cloudIds(ua).length, backupReasons: bk, owner: (await ownerOf(p))?.source });
  await d.ctx.close(); }

// AS4a: transfer, empty cloud (with the confirmation step).
if (run("AS4a")) { const { d, p, ub } = await phoneAfterA(); await signInB(p); await wait(() => onOwnership(p), 15000);
  await p.getByTestId("ownership-transfer").click(); await p.waitForTimeout(400);
  const confirmShown = (await p.getByTestId("ownership-confirm").count()) === 1; const beforeYes = fake.rows.has(ub.id);
  await p.getByTestId("ownership-confirm-yes").click(); await p.waitForTimeout(3500);
  const ok = await wait(async () => cloudIds(ub).length === 12, 15000);
  rec("AS4a transfer (empty cloud): needs a second confirmation; only then do A's 12 go into B (owner recorded as a transfer, backup first)", confirmShown && !beforeYes && ok && (await ownerOf(p))?.source === "transfer", { confirmShown, beforeYes, bCloud: cloudIds(ub).length, backups: await backupsHave(p, "A") });
  await d.ctx.close(); }

// AS4b: transfer, populated cloud -> the normal two-copies choice still follows.
if (run("AS4b")) { const { d, p, ub } = await phoneAfterA({ bCloud: snap(BTX) }); await signInB(p); await wait(() => onOwnership(p), 15000);
  const w0 = fake.writeLog.length;
  await p.getByTestId("ownership-transfer").click(); await p.getByTestId("ownership-confirm-yes").click(); await p.waitForTimeout(3500);
  const conflict = await wait(async () => /Two versions of your data found|both changed/.test(await body(p)), 15000);
  rec("AS4b transfer (populated cloud): ownership settled, then the explicit two-copies choice appears; B's cloud still unchanged and nothing written before it", conflict && cloudIds(ub).length === 5 && fake.writeLog.length === w0, { conflict, bCloud: cloudIds(ub).length, writes: fake.writeLog.length - w0 });
  await d.ctx.close(); }

// AS7: lists the app keeps when a snapshot lacks them must not leak A's data into B.
if (run("AS7")) { const A_GOALS = [{ id: "goalA", name: "A's goal", target: 5000 }];
  const { d, p, ub } = await phoneAfterA({ bCloud: snap(BTX), afterA: async pg => { await pg.evaluate(g => localStorage.setItem("arth_goals", JSON.stringify(g)), A_GOALS); await pg.reload({ waitUntil: "networkidle" }); await L.pin(pg, false).catch(() => {}); await pg.waitForTimeout(2500); } });
  const goalsBefore = await p.evaluate(() => JSON.parse(localStorage.getItem("arth_goals") || "[]")).catch(() => []);
  await signInB(p); await wait(() => onOwnership(p), 15000);
  await p.getByTestId("ownership-start-fresh").click(); await p.waitForTimeout(4000);
  const goals = await p.evaluate(() => JSON.parse(localStorage.getItem("arth_goals") || "[]")); const bGoals = fake.rows.get(ub.id)?.snapshot?.goals || [];
  rec("AS7 start fresh: A's goals (a list the app keeps when a snapshot lacks it) are gone from the phone and never reach B's cloud copy", goalsBefore.length === 1 && goals.length === 0 && !JSON.stringify(bGoals).includes("goalA"), { goalsBefore: goalsBefore.length, phoneGoals: goals.length, bCloudGoals: bGoals.length });
  await d.ctx.close(); }

// AS8: an interruption while resolving changes nothing (data service unreachable), then it works.
if (run("AS8")) { const { d, p, ub } = await phoneAfterA({ bCloud: snap(BTX) }); await signInB(p); await wait(() => onOwnership(p), 15000);
  await d.ctx.route("**/rest/v1/**", r => r.abort());
  await p.getByTestId("ownership-start-fresh").click(); await p.waitForTimeout(3000);
  const err = await p.getByTestId("ownership-error").innerText().catch(() => "");
  rec("AS8 start fresh while B's cloud copy cannot be read: an understandable error, the phone still holds A's 12, owner unchanged, nothing written", /Nothing was changed|could not be read|cannot be read/i.test(err) && (await L.localTxnIds(p)).length === 12 && (await ownerOf(p))?.email === EA, { err: err.slice(0, 120), local: (await L.localTxnIds(p)).length });
  await d.ctx.unroute("**/rest/v1/**"); await p.getByTestId("ownership-start-fresh").click(); await p.waitForTimeout(3500);
  rec("AS8b retrying after the connection returns completes the switch", (await L.localTxnIds(p)).length === 5, { local: (await L.localTxnIds(p)).length });
  await d.ctx.close(); }

// AS9: same account signing out and in again is not asked anything.
if (run("AS9")) { const { d, p, ua } = await phoneAfterA(); await login(p, EA); await L.pin(p, false).catch(() => {}); await p.waitForTimeout(3000);
  const home = /Good (Morning|Afternoon|Evening|Night)/.test(await body(p)); const asked = await onOwnership(p);
  rec("AS9 A signs out and back in: no question, reaches the app with A's data, A's cloud intact", home && !asked && (await L.localTxnIds(p)).length === 12 && cloudIds(ua).length === 12, { home, asked });
  await d.ctx.close(); }

// AS10: fresh install (clean phone) -> no question; the account's data arrives.
if (run("AS10")) { fake.rows.clear(); fake.writeLog.length = 0; fake.resetAccounts(); const ub = fake.addAccount(EB); fake.rows.set(ub.id, { snapshot: JSON.parse(JSON.stringify(snap(BTX))), micros: BigInt(Date.now()) * 1000n });
  const d = await device("fresh", { signedIn: false }); const p = d.page; await login(p, EB); await L.pin(p, true).catch(() => {}); await p.waitForTimeout(2500);
  const asked = await onOwnership(p);
  rec("AS10 fresh install: no question, B's 5 transactions arrive, phone is claimed by B", !asked && (await L.localTxnIds(p)).length === 5 && (await ownerOf(p))?.email === EB, { asked, local: (await L.localTxnIds(p)).length, owner: (await ownerOf(p))?.source });
  await d.ctx.close(); }

await browser.close(); web.close();
rec("SAFE no request ever went to a supabase host", !blocked.some(u => /supabase\.co/.test(u)), { nonLocal: [...new Set(blocked.map(u => new URL(u).hostname))] });
console.log("\noutcome vector:", JSON.stringify(results)); console.log("HASH " + crypto.createHash("md5").update(JSON.stringify(results)).digest("hex"));
process.exit(results.every(r => r.pass) ? 0 : 1);
