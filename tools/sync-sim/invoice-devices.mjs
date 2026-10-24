// Invoice import across TWO SIMULATED devices (two Chromium contexts) against the LOCAL fake backend. SYNTHETIC DATA ONLY. This is NOT a real two-phone test.
// Setup:  VITE_SUPABASE_URL=http://localhost:54399 VITE_SUPABASE_ANON_KEY=synthetic VITE_FORCE_DEV_AUTH_BYPASS=false npx vite --port 5196 --strictPort &
// Run:    node tools/sync-sim/invoice-devices.mjs
// Questions answered: does `invoiceImports` reach the other device; is a duplicate blocked there; does Undo travel; do interrupted / lost-reply saves leave
// a half import or a repeat; and when both devices import offline, is anything silently overwritten.
import { writeFileSync, mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
import { startFakeSupabase } from "./fakeSupabase.mjs";
import * as L from "./lib.mjs";
import { BLINKIT_FIXTURE_3_ITEMS as ITEMS } from "../../src/domain/invoices/fixtures/blinkitGstInvoiceItems.fixture.js";
import { makePdf } from "../../src/domain/invoices/testing/pdfMaker.js";

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null; const want = id => !only || only.test(id);
const results = [];
const rec = (id, pass, d) => { results.push({ id, pass: !!pass }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${JSON.stringify(d)}`); };
const envProbe = await fetch(L.APP + "src/cloudSync.js").then(r => r.text()).catch(() => "");
if (!/VITE_SUPABASE_URL"\s*:\s*"http:\/\/localhost:54399"/.test(envProbe)) { console.error("REFUSING TO RUN: the dev server is not configured with VITE_SUPABASE_URL=http://localhost:54399"); process.exit(2); }

const dir = mkdtempSync(join(tmpdir(), "invdev-"));
const draw = items => makePdf([{ texts: items.map(i => ({ str: i.str, x: i.x, y: i.y, size: 8 })) }]);
const second = ITEMS.map(i => (i.str === "C00000T000000001" ? { ...i, str: "C00000T000000002" } : i.str === ": 0000000001" ? { ...i, str: ": 0000000002" } : i));
const PDF = { one: join(dir, "one.pdf"), two: join(dir, "two.pdf") };
writeFileSync(PDF.one, draw(ITEMS)); writeFileSync(PDF.two, draw(second));

const fake = await startFakeSupabase({ users: { [L.TOKEN]: L.USER } });
const { browser, device, blocked } = await L.launch();
const uid = L.USER.id;
const accounts = L.syntheticSnapshot([], "x").accounts;
const BASE = L.syntheticTxns("B", 6);
const baseIds = BASE.map(t => t.id).sort();
const cloudSnap = () => fake.rows.get(uid)?.snapshot || {};
const cloudIds = () => (cloudSnap().txns || []).map(t => String(t.id)).sort();
const cloudRecs = () => (cloudSnap().invoiceImports || []);
const ls = (page, k) => page.evaluate(x => JSON.parse(localStorage.getItem(x) || "[]"), k);
const synced = page => async () => { const s = await L.syncState(page); return s && s.baseToken && !s.pendingWrite && JSON.stringify(await L.localTxnIds(page)) === JSON.stringify(cloudIds()); };

async function resetWorld() { fake.rows.clear(); fake.writeLog.length = 0; fake.stats.unconditionalWrites = 0; await L.setFaults({ latencyMs: 0, rejectWrites: 0, dropResponseWrites: 0, offline: false, corruptNext: false, precisionMs: 0 }); }
async function boot(name, localTxns) {
  const d = await device(name, { seedLocal: { arth_txns: localTxns, arth_accounts: accounts, arth_master_user_setup_complete: true, arth_vehicles: [] } });
  await d.page.goto(L.APP, { waitUntil: "networkidle" }); await L.pin(d.page, true);
  return d;
}
async function establish() {
  await resetWorld();
  const A = await boot("A", BASE);
  await L.waitFor(() => cloudIds().length === BASE.length, { what: "A inserted" });
  const B = await boot("B", []);
  await L.waitFor(async () => (await L.localTxnIds(B.page)).length === BASE.length, { what: "B adopted" });
  await L.waitFor(synced(A.page)); await L.waitFor(synced(B.page));
  return { A, B };
}
const reload = async d => { await d.page.reload({ waitUntil: "networkidle" }); await L.pin(d.page, false); await d.page.waitForTimeout(1500); };
async function openImport(page) {
  await page.getByRole("button", { name: /➖/ }).first().click(); await page.waitForTimeout(500);
  await page.getByTestId("quick-from-invoice").click(); await page.waitForTimeout(500);
}
async function importIt(d, file) {
  await openImport(d.page);
  if (process.env.DEBUG && !(await d.page.getByTestId("invoice-file").count())) console.log("NO FILE INPUT, body:", (await L.bodyText(d.page)).replace(/\s+/g," ").slice(0, 600));
  await d.page.getByTestId("invoice-file").setInputFiles(file); await d.page.waitForTimeout(1500);
  await d.page.getByTestId("confirm-account").selectOption("syn_bank");
  await d.page.getByTestId("confirm-import").click(); await d.page.waitForTimeout(1500);
}
const back = async d => { await d.page.getByText("←", { exact: true }).first().click(); await d.page.waitForTimeout(500); };
const newTxn = (txns) => txns.find(t => !baseIds.includes(String(t.id)) && t.merchant === "Blinkit");
const everywhere = async (devs) => {            // every invoice record key and expense id that exists anywhere (cloud, device, safety backups)
  const keys = new Set(cloudRecs().map(r => r.key)), ids = new Set(cloudIds());
  for (const d of devs) {
    (await ls(d.page, "arth_invoice_imports")).forEach(r => keys.add(r.key)); (await L.localTxnIds(d.page)).forEach(i => ids.add(i));
    const backups = await d.page.evaluate(() => { try { return JSON.parse(localStorage.getItem("arth_sync_safety_backups") || "[]"); } catch { return []; } });
    backups.forEach(b => { (b.snapshot?.txns || []).forEach(t => ids.add(String(t.id))); (b.snapshot?.invoiceImports || []).forEach(r => keys.add(r.key)); });
  }
  return { keys: [...keys], ids: [...ids] };
};

// I1 ── A imports; the record and the expense reach B ───────────────────────────────────────────
if (want('I1')) {
  const { A, B } = await establish();
  await importIt(A, PDF.one);
  const t = newTxn(await L.localTxns(A.page));
  const inCloud = await L.waitFor(() => t && cloudIds().includes(String(t.id)) && cloudRecs().length === 1, { timeout: 15000 });
  await reload(B);
  const bTx = newTxn(await L.localTxns(B.page)), bRecs = await ls(B.page, "arth_invoice_imports");
  rec("I1 the imported expense AND its invoice record reach the other device; the starting expenses are untouched", Boolean(t) && inCloud && bTx && bTx.id === t.id && bTx.lineItems.length === 4 && bRecs.length === 1 && bRecs[0].txnId === t.id && baseIds.every(i => cloudIds().includes(i)), { cloudRecs: cloudRecs().length, bHasExpense: Boolean(bTx), bRecs: bRecs.length });
  // I2 ── B cannot import the same invoice again ──
  await openImport(B.page); await B.page.getByTestId("invoice-file").setInputFiles(PDF.one); await B.page.waitForTimeout(1500);
  const banner = await B.page.getByTestId("duplicate-banner").innerText().catch(() => "");
  rec("I2 on the other device the same invoice is recognised as already added and Confirm is disabled", /already added|imported before/.test(banner) && (await B.page.getByTestId("confirm-import").isDisabled()), { banner: banner.replace(/\s+/g, " ").slice(0, 80) });
  rec("I2b still one expense and one record on both devices and in the cloud", (await ls(B.page, "arth_invoice_imports")).length === 1 && cloudRecs().length === 1 && cloudIds().length === BASE.length + 1, {});
  // I3 ── A undoes (its screen still shows the Undo for this import); Undo travels ──
  await A.page.getByTestId("undo-import").click(); await A.page.waitForTimeout(800);
  const undone = await L.waitFor(() => cloudIds().length === BASE.length && cloudRecs().length === 0, { timeout: 15000 });
  await reload(B);
  rec("I3 Undo on A removes the expense and the record in the cloud and on B; the starting expenses are exactly as before", undone && (await L.localTxnIds(B.page)).join() === baseIds.join() && (await ls(B.page, "arth_invoice_imports")).length === 0 && cloudIds().join() === baseIds.join(), { cloud: cloudIds().length, bRecs: (await ls(B.page, "arth_invoice_imports")).length });
  rec("I3b no page errors on either device", A.errors.length === 0 && B.errors.length === 0, { a: A.errors.slice(0, 1), b: B.errors.slice(0, 1) });
  await A.ctx.close(); await B.ctx.close();
}

// I4 ── the backend rejects the save: the import is complete locally (both parts or neither), then reaches the cloud once ──
if (want('I4')) {
  const { A, B } = await establish();
  await L.setFaults({ rejectWrites: 3 });
  await importIt(A, PDF.one);
  const t = newTxn(await L.localTxns(A.page)), recs = await ls(A.page, "arth_invoice_imports");
  const both = Boolean(t) && recs.length === 1 && recs[0].txnId === t.id;
  const notYet = t && !cloudIds().includes(String(t.id));
  await L.setFaults({ rejectWrites: 0 });
  await A.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  const arrived = await L.waitFor(() => t && cloudIds().includes(String(t.id)) && cloudRecs().length === 1, { timeout: 30000 });
  await reload(B);
  rec("I4 backend rejects the save: A keeps expense + record together, nothing half-saved reaches the cloud; once the backend recovers both arrive exactly once and B gets both", both && notYet && arrived && (await ls(B.page, "arth_invoice_imports")).length === 1 && Boolean(newTxn(await L.localTxns(B.page))) && cloudIds().length === BASE.length + 1, { bothLocal: both, notInCloudWhileRejected: notYet, arrived, cloudRecs: cloudRecs().length, cloudTxns: cloudIds().length });
  await A.ctx.close(); await B.ctx.close();
}

// I5 ── the server applied the save but the reply was lost: no repeat, no duplicate ──
if (want('I5')) {
  const { A } = await establish();
  await L.setFaults({ dropResponseWrites: 1 });
  await importIt(A, PDF.one);
  const t = newTxn(await L.localTxns(A.page));
  await L.waitFor(() => t && cloudIds().includes(String(t.id)), { timeout: 10000 });
  await reload(A);
  const ok = await L.waitFor(synced(A.page), { timeout: 25000 });
  await A.page.waitForTimeout(2500);
  rec("I5 lost reply after the server applied the write: after reopening A and the cloud agree, exactly one expense and one record, no repeat", Boolean(t) && ok && cloudRecs().length === 1 && (await ls(A.page, "arth_invoice_imports")).length === 1 && cloudIds().filter(i => !baseIds.includes(i)).length === 1, { synced: ok, cloudRecs: cloudRecs().length, extraExpenses: cloudIds().filter(i => !baseIds.includes(i)).length });
  await A.ctx.close();
}

// I6 ── both devices import the SAME invoice while offline from each other ──
if (want('I6')) {
  const { A, B } = await establish();
  await L.setFaults({ offline: true });
  await importIt(A, PDF.one); await importIt(B, PDF.one); await back(A); await back(B);
  const ta = newTxn(await L.localTxns(A.page)), tb = newTxn(await L.localTxns(B.page));
  await L.setFaults({ offline: false });
  await A.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await L.waitFor(() => ta && cloudIds().includes(String(ta.id)), { timeout: 20000 });
  await B.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await B.page.waitForTimeout(4000);
  await A.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await A.page.waitForTimeout(5000);
  const bannerOf = async d => (await d.page.getByTestId("sync-attention-banner").innerText().catch(() => "")).replace(/\s+/g, " ");
  const banner = [await bannerOf(A), await bannerOf(B)].filter(Boolean).join(" | ");
  const all = await everywhere([A, B]);
  if (process.env.DEBUG) { console.log("I6 ids", JSON.stringify({ ta: ta && ta.id, tb: tb && tb.id, aNow: (await L.localTxns(A.page)).filter(t => t.merchant === "Blinkit").map(t => t.id), bNow: (await L.localTxns(B.page)).filter(t => t.merchant === "Blinkit").map(t => t.id), cloudNow: (cloudSnap().txns || []).filter(t => t.merchant === "Blinkit").map(t => t.id), bBackups: await B.page.evaluate(() => JSON.parse(localStorage.getItem("arth_sync_safety_backups") || "[]").map(b => ({ reason: b.reason, blinkit: (b.snapshot?.txns || []).filter(t => t.merchant === "Blinkit").map(t => t.id), recs: (b.snapshot?.invoiceImports || []).length }))), body: (await L.bodyText(B.page)).replace(/\s+/g, " ").slice(0, 300) }));
  console.log("I6 state", JSON.stringify({ aLocal: (await L.localTxnIds(A.page)).length, bLocal: (await L.localTxnIds(B.page)).length, cloud: cloudIds().length, cloudRecs: cloudRecs().length, aRecs: (await ls(A.page, "arth_invoice_imports")).length, bRecs: (await ls(B.page, "arth_invoice_imports")).length, aSync: (await L.syncState(A.page))?.conflict ? "conflict" : "none", bSync: (await L.syncState(B.page))?.conflict ? "conflict" : "none" }).slice(0, 900)); }
  rec("I6 both import offline: a device is told the two copies differ (no silent merge) and neither expense is lost", Boolean(ta && tb) && ta.id !== tb.id && /changed|review|conflict/i.test(banner) && all.ids.includes(String(ta.id)) && all.ids.includes(String(tb.id)), { banner: banner.slice(0, 110), idsKept: [ta && all.ids.includes(String(ta.id)), tb && all.ids.includes(String(tb.id))] });
  rec("I6b every starting expense is still present afterwards", baseIds.every(i => all.ids.includes(i)), { missing: baseIds.filter(i => !all.ids.includes(i)) });
  await A.ctx.close(); await B.ctx.close();
}

// I7 ── B edits an existing expense offline while A imports: neither change overwrites the other silently ──
if (want('I7')) {
  const { A, B } = await establish();
  await L.setFaults({ offline: true });
  await B.page.evaluate(() => { const k = "arth_txns"; const x = JSON.parse(localStorage.getItem(k)); x[0].desc = "EDITED-ON-B"; localStorage.setItem(k, JSON.stringify(x)); });
  await L.setFaults({ offline: false });
  await importIt(A, PDF.two); await back(A);
  const ta = newTxn(await L.localTxns(A.page));
  await L.waitFor(() => ta && cloudIds().includes(String(ta.id)), { timeout: 20000 });
  await reload(B);
  const all = await everywhere([A, B]);
  const bTxns = await L.localTxns(B.page), cTx = (cloudSnap().txns || []);
  const editSurvives = bTxns.some(t => t.desc === "EDITED-ON-B") || cTx.some(t => t.desc === "EDITED-ON-B") || (await B.page.evaluate(() => (localStorage.getItem("arth_sync_safety_backups") || "").includes("EDITED-ON-B")));
  rec("I7 B's edit of an existing expense and A's import both survive (cloud, device or pinned backup); the invoice record survives", editSurvives && all.ids.includes(String(ta.id)) && all.keys.some(k => /C00000T000000002/.test(k)), { editSurvives, importKept: all.ids.includes(String(ta.id)), recordKept: all.keys.length });
  await A.ctx.close(); await B.ctx.close();
}

rec("Z1 nothing left this machine except the local fake backend", blocked.filter(u => !/fonts\.(googleapis|gstatic)/.test(u)).length === 0 && fake.stats.unconditionalWrites === 0, { blocked: blocked.slice(0, 2), unconditionalWrites: fake.stats.unconditionalWrites });
console.log("outcome vector:", JSON.stringify(results));
await browser.close(); fake.close && fake.close();
process.exit(results.every(r => r.pass) ? 0 : 1);
