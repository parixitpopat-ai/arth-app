// Isolated sync-safety scenarios against the REAL app (SYNC-SAFETY-002). SYNTHETIC DATA ONLY; local fake backend.
// Guards: the app must be configured for the local fake (checked from the dev server's own env injection); every non-local
// request is aborted and recorded; any request to *.supabase.co, or any unconditional cloud write, fails the run.
// Setup:  VITE_SUPABASE_URL=http://localhost:54399 VITE_SUPABASE_ANON_KEY=synthetic VITE_FORCE_DEV_AUTH_BYPASS=false npx vite --port 5196 &
// Run:    node tools/sync-sim/run.mjs        (writes a hashed record to tools/sync-sim/results/)
import fs from "node:fs";
import { startFakeSupabase } from "./fakeSupabase.mjs";
import * as L from "./lib.mjs";

const OUT = new URL("./results/", import.meta.url).pathname;
const results = [];
const record = (id, property, pass, evidence) => { results.push({ id, property, pass, evidence }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  [${property}]\n      ${JSON.stringify(evidence)}`); };

// ── refuse to run unless the app is pointed at the local fake ──
const envProbe = await fetch(L.APP + "src/cloudSync.js").then(r => r.text()).catch(() => "");
if (!/VITE_SUPABASE_URL"\s*:\s*"http:\/\/localhost:54399"/.test(envProbe)) { console.error("REFUSING TO RUN: the dev server is not configured with VITE_SUPABASE_URL=http://localhost:54399"); process.exit(2); }

const fake = await startFakeSupabase({ users: { [L.TOKEN]: L.USER } });
const { browser, device, blocked } = await L.launch();
const uid = L.USER.id;
const accounts = L.syntheticSnapshot([], "x").accounts;
const BASE = L.syntheticTxns("B", 12);
const baseIds = BASE.map(t => t.id).sort();
const exportBefore = L.writeImmutableExport(OUT + "immutable", "synthetic-baseline.export.json", { dataset: "synthetic", txns: BASE, accounts });
const ctxs = [];

async function resetWorld() { fake.rows.clear(); fake.writeLog.length = 0; fake.stats.unconditionalWrites = 0; await L.setFaults({ latencyMs: 0, rejectWrites: 0, dropResponseWrites: 0, offline: false, corruptNext: false, precisionMs: 0 }); }
async function boot(name, localTxns) {
  const d = await device(name, { seedLocal: { arth_txns: localTxns, arth_accounts: accounts, arth_master_user_setup_complete: true } });
  ctxs.push(d.ctx);
  await d.page.goto(L.APP, { waitUntil: "networkidle" }); await L.pin(d.page, true);
  return d;
}
const ids = page => L.localTxnIds(page);
const findId = async (page, desc) => (await L.localTxns(page)).find(t => t.desc === desc)?.id;
const cloud = () => fake.cloudIds(uid);
const synced = page => async () => { const s = await L.syncState(page); const l = await ids(page); return s && s.baseToken && !s.pendingWrite && JSON.stringify(l) === JSON.stringify(cloud()); };
/** Two devices that have genuinely synced through the app: A uploads its data, B starts empty and adopts it. */
async function establish() {
  await resetWorld();
  const A = await boot("A", BASE);
  await L.waitFor(() => cloud().length === BASE.length, { what: "A inserted" });
  const B = await boot("B", []);
  await L.waitFor(async () => (await ids(B.page)).length === BASE.length, { what: "B adopted" });
  await L.waitFor(synced(A.page)); await L.waitFor(synced(B.page));
  return { A, B };
}
const lostAcross = async (devs, created) => {
  const live = new Set(cloud()); for (const d of devs) { (await ids(d.page)).forEach(i => live.add(i)); (await L.safetyBackupIds(d.page)).forEach(i => live.add(i)); }
  return created.filter(i => !live.has(String(i)));
};
const bannerText = async page => (await page.getByTestId("sync-attention-banner").innerText().catch(() => "")).replace(/\s+/g, " ");

// P1 ── durable local save before async sync ─────────────────────────────────────────────────
{
  const { A } = await establish();
  await L.setFaults({ offline: true });
  const w0 = fake.writeLog.length;
  await L.addExpense(A.page, "P1-OFFLINE", 555);
  const id = await findId(A.page, "P1-OFFLINE");
  const cloudHad = cloud().includes(String(id));
  await A.page.reload({ waitUntil: "networkidle" }); await L.pin(A.page, false); await A.page.waitForTimeout(1500);
  const after = Boolean(await findId(A.page, "P1-OFFLINE"));
  record("P1", "1 durable local save before async sync", Boolean(id) && !cloudHad && fake.writeLog.length === w0 && after, { savedLocallyImmediately: Boolean(id), cloudHadItThen: cloudHad, serverWritesWhileOffline: fake.writeLog.length - w0, survivedReloadOffline: after });
}

// P2 ── recoverable, immutable export (the harness dataset AND the app's own Download backup) ──
{
  const { A } = await establish();
  const intact = L.verifyExport(exportBefore);
  const fileIds = JSON.parse(fs.readFileSync(exportBefore.file, "utf8")).txns.map(t => t.id).sort();
  await A.page.getByText("☰", { exact: true }).first().dispatchEvent("click"); await A.page.waitForTimeout(400);
  await A.page.getByText("⚙️", { exact: true }).first().dispatchEvent("click"); await A.page.waitForTimeout(400);
  await A.page.getByText("Backup & Restore", { exact: true }).dispatchEvent("click"); await A.page.waitForTimeout(500);
  const [dl] = await Promise.all([A.page.waitForEvent("download", { timeout: 10000 }), A.page.getByText("⬇ Download backup").first().dispatchEvent("click")]);
  const dlPath = await dl.path(); const dlJson = JSON.parse(fs.readFileSync(dlPath, "utf8"));
  const appExportIds = (dlJson.snapshot?.txns || []).map(t => String(t.id)).sort();
  const saved = L.writeImmutableExport(OUT + "immutable", "app-download-backup.json", dlJson);
  const localNow = await ids(A.page);
  record("P2", "2 recoverable immutable export", intact && JSON.stringify(fileIds) === JSON.stringify(baseIds) && JSON.stringify(appExportIds) === JSON.stringify(localNow) && L.verifyExport(saved),
    { harnessExportIntact: intact, harnessExportIds: fileIds.length, appDownloadIds: appExportIds.length, appDownloadEqualsDevice: JSON.stringify(appExportIds) === JSON.stringify(localNow), appDownloadHashed: L.verifyExport(saved) });
}

// P5a ── server rejects the write; the app is reloaded right away ──────────────────────────────
{
  const { A } = await establish();
  await L.setFaults({ rejectWrites: 3 });
  await L.addExpense(A.page, "P5A-REJECTED", 611);
  const id = await findId(A.page, "P5A-REJECTED");
  await L.waitFor(() => fake.writeLog.some(w => w.outcome === "rejected-500"), { timeout: 8000 });
  const panel = await L.cloudHeadline(A.page);
  await A.page.reload({ waitUntil: "networkidle" }); await L.pin(A.page, false); await A.page.waitForTimeout(1200);
  const localAfter = Boolean(await findId(A.page, "P5A-REJECTED"));
  const delivered = await L.waitFor(() => cloud().includes(String(id)), { timeout: 30000 });
  record("P5a", "5 server rejects the write", Boolean(id) && localAfter && delivered && /not synced yet/i.test(panel.headline) && /not in the cloud yet/i.test(panel.detail),
    { localKeptThroughReload: localAfter, userToldChangesNotSynced: /not synced yet/i.test(panel.headline), deliveredAfterServerRecovered: delivered, rejectedWrites: fake.writeLog.filter(w => w.outcome === "rejected-500").length });
}

// P5b ── write applied, reply lost; app reopened ───────────────────────────────────────────────
{
  const { A } = await establish();
  await L.setFaults({ dropResponseWrites: 1 });
  await L.addExpense(A.page, "P5B-DROPPED", 622);
  const id = await findId(A.page, "P5B-DROPPED");
  await L.waitFor(() => cloud().includes(String(id)), { timeout: 8000 });
  const applied = () => fake.writeLog.filter(w => w.outcome === "applied" && (w.kind === "swap" || w.kind === "insert")).length;
  await A.page.reload({ waitUntil: "networkidle" }); await L.pin(A.page, false);
  const ok = await L.waitFor(synced(A.page), { timeout: 20000 });
  const w1 = applied(); await A.page.waitForTimeout(2500);
  record("P5b", "5 reply lost after the server applied the write", Boolean(id) && ok && applied() === w1, { cloudHasIt: cloud().includes(String(id)), deviceAndCloudIdentical: Boolean(ok), noRepeatedWrites: applied() === w1, localIds: (await ids(A.page)).length, cloudIds: cloud().length });
}

// P5c ── app closed inside the 900 ms push delay, then reopened ────────────────────────────────
{
  const { A } = await establish();
  await L.addExpense(A.page, "P5C-CLOSED-EARLY", 633);
  const id = await findId(A.page, "P5C-CLOSED-EARLY");
  await A.page.close();
  const page = await A.ctx.newPage(); await page.goto(L.APP, { waitUntil: "networkidle" }); await L.pin(page, false);
  const delivered = await L.waitFor(() => cloud().includes(String(id)), { timeout: 20000 });
  const local = (await L.localTxns(page)).some(t => String(t.id) === String(id));
  record("P5c", "5 closed before the change was sent", Boolean(id) && local && delivered, { savedLocallyBeforeClose: Boolean(id), presentAfterReopen: local, deliveredToCloud: delivered });
}

// L1 ── edit, auto-sync, then ONE Sync Now tap ───────────────────────────────────────────────
{
  const { A } = await establish();
  await L.addExpense(A.page, "L1-EDIT", 644);
  const id = await findId(A.page, "L1-EDIT");
  const auto = await L.waitFor(() => cloud().includes(String(id)), { timeout: 15000 });
  await L.openCloudSettings(A.page); await A.page.getByTestId("sync-now").dispatchEvent("click"); await A.page.waitForTimeout(2500);
  const still = Boolean(await findId(A.page, "L1-EDIT"));
  const panel = await L.cloudHeadline(A.page);
  record("L1", "3/4 Sync Now never replaces unsynced data; status is verified", Boolean(id) && auto && still && cloud().includes(String(id)) && !/every change saves/i.test(panel.detail),
    { editSyncedAutomatically: auto, survivedOneSyncNowTap: still, inCloudAfterTap: cloud().includes(String(id)), forbiddenPhraseShown: /every change saves|saved to backup/i.test(panel.detail + panel.backup), headline: panel.headline });
}

// P3/P4 ── devices diverge while B is offline; B returns ───────────────────────────────────────
async function diverge() {
  const { A, B } = await establish();
  await B.ctx.setOffline(true);
  await L.addExpense(B.page, "B-OFFLINE", 700);
  const bId = String(await findId(B.page, "B-OFFLINE"));
  await L.addExpense(A.page, "A-ONLINE", 800);
  const aId = String(await findId(A.page, "A-ONLINE"));
  await L.waitFor(() => cloud().includes(aId), { timeout: 15000 });
  await B.ctx.setOffline(false);
  await B.page.reload({ waitUntil: "networkidle" }); await L.pin(B.page, false);
  await L.waitFor(async () => (await L.syncState(B.page))?.conflict, { timeout: 20000 });
  return { A, B, aId, bId };
}
{
  const { A, B, aId, bId } = await diverge();
  const banner = await bannerText(B.page);
  const sheet = await B.page.getByTestId("sync-conflict-sheet").count();
  const onlyHere = await B.page.getByTestId("sync-conflict-local").innerText().catch(() => ""), onlyCloud = await B.page.getByTestId("sync-conflict-cloud").innerText().catch(() => "");
  const st = await L.syncState(B.page); const bLocal = await ids(B.page);
  const writesByB = fake.writeLog.filter(w => w.outcome === "applied" && w.txnIds?.includes(bId)).length;
  const union = [...baseIds, aId, bId].sort();
  record("P3/P4", "3 conflict detected, 4 reconciliation", st?.conflict && bLocal.includes(bId) && cloud().includes(aId) && !cloud().includes(bId) && writesByB === 0 && sheet === 1 && /both changed/i.test(banner),
    { conflictRecorded: Boolean(st?.conflict), bKeptItsTxn: bLocal.includes(bId), bOverwroteCloud: writesByB > 0, cloudKeptAsTxn: cloud().includes(aId), bannerShown: /both changed/i.test(banner), sheetShown: sheet === 1, sheetOnlyHere: /1 transaction only here/.test(onlyHere), sheetOnlyCloud: /1 transaction only in the cloud/.test(onlyCloud), unionSize: union.length, lostAcrossDevices: (await lostAcross([A, B], [aId, bId])).length });
  // decide later: sheet closes, banner stays, nothing is written, Sync Now does not force
  const w0 = fake.writeLog.length;
  await B.page.getByTestId("sync-later").dispatchEvent("click"); await B.page.waitForTimeout(800);
  await L.openCloudSettings(B.page); await B.page.getByTestId("sync-now").dispatchEvent("click"); await B.page.waitForTimeout(2000);
  const stillConflict = Boolean((await L.syncState(B.page))?.conflict), kept = (await ids(B.page)).includes(bId);
  record("C-later", "3 decide later keeps sync paused and replaces nothing", stillConflict && kept && fake.writeLog.length === w0, { stillConflict, localKept: kept, serverWrites: fake.writeLog.length - w0 });
}
{
  const { A, B, aId, bId } = await diverge();
  await B.page.getByTestId("sync-keep-local").dispatchEvent("click");
  const resolved = await L.waitFor(async () => { const s = await L.syncState(B.page); return s && !s.conflict && s.baseToken; }, { timeout: 20000 });
  const bk = await L.safetyBackups(B.page); const bkIds = await L.safetyBackupIds(B.page);
  await A.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await L.waitFor(async () => (await ids(A.page)).includes(bId), { timeout: 20000 });
  record("C-keep-local", "3 conflict choice: keep this device; the cloud copy is backed up first", resolved && cloud().includes(bId) && bkIds.includes(aId) && (await lostAcross([A, B], [aId, bId])).length === 0,
    { resolved: Boolean(resolved), cloudNowHasBs: cloud().includes(bId), cloudCopyBackedUpFirst: bk.some(b => b.reason === "before-keep-local"), asTxnRecoverableFromBackup: bkIds.includes(aId), otherDeviceAdoptedResult: (await ids(A.page)).includes(bId), lost: (await lostAcross([A, B], [aId, bId])).length });
}
{
  const { A, B, aId, bId } = await diverge();
  await B.page.getByTestId("sync-use-cloud").dispatchEvent("click");
  const resolved = await L.waitFor(async () => { const s = await L.syncState(B.page); return s && !s.conflict && s.baseToken && (await ids(B.page)).includes(aId); }, { timeout: 20000 });
  const bkIds = await L.safetyBackupIds(B.page); const bk = await L.safetyBackups(B.page);
  record("C-use-cloud", "3 conflict choice: use the cloud copy; this device is backed up first", resolved && !(await ids(B.page)).includes(bId) && bkIds.includes(bId) && (await lostAcross([A, B], [aId, bId])).length === 0,
    { resolved: Boolean(resolved), bNowHasAs: (await ids(B.page)).includes(aId), deviceBackedUpFirst: bk.some(b => b.reason === "before-use-cloud"), bsTxnRecoverableFromBackup: bkIds.includes(bId), lost: (await lostAcross([A, B], [aId, bId])).length });
}

// Q1 ── a backup that cannot be written blocks the replacement ────────────────────────────────
{
  const { A, B, aId, bId } = await diverge();
  await B.page.evaluate(() => { const chunk = "x".repeat(400); let n = 0; try { for (;;) { localStorage.setItem("pad" + n, chunk); n++; } } catch { /* full */ } for (let i = 0; i < 6; i++) localStorage.removeItem("pad" + (n - 1 - i)); });
  const before = await ids(B.page);
  await B.page.getByTestId("sync-use-cloud").dispatchEvent("click"); await B.page.waitForTimeout(3000);
  const after = await ids(B.page);
  const err = await B.page.locator("[role=alert]").first().innerText().catch(() => "");
  const st = await L.syncState(B.page);
  await B.page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith("pad")) localStorage.removeItem(k); });
  record("Q1", "backup-before-replacement: a failed backup blocks the replacement", JSON.stringify(before) === JSON.stringify(after) && after.includes(bId) && Boolean(st?.conflict), { deviceUntouched: JSON.stringify(before) === JSON.stringify(after), conflictStillOpen: Boolean(st?.conflict), userToldNothingReplaced: /nothing was replaced|could not be completed/i.test(err) });
}

// R1 ── a cloud copy that differs from what was sent pauses sync ─────────────────────────────
{
  const { A } = await establish();
  await L.setFaults({ corruptNext: true });
  await L.addExpense(A.page, "R1-CORRUPTED", 650);
  const id = String(await findId(A.page, "R1-CORRUPTED"));
  const paused = await L.waitFor(async () => (await L.syncState(A.page))?.paused === "reconcile-mismatch", { timeout: 15000 });
  const banner = await bannerText(A.page);
  record("R1", "4 reconciliation mismatch is detected and sync pauses", paused && !cloud().includes(id) && (await ids(A.page)).includes(id) && /don't match|copies/i.test(banner), { paused: Boolean(paused), localIntact: (await ids(A.page)).includes(id), bannerShown: /copies/i.test(banner), cloudMissingTheTxn: !cloud().includes(id) });
}

// T1 ── an unreliable (coarse) concurrency token pauses sync ─────────────────────────────────
{
  await resetWorld(); await L.setFaults({ precisionMs: 60000 });
  const A = await boot("A", BASE);
  await L.waitFor(() => cloud().length === BASE.length);
  await L.waitFor(async () => (await L.syncState(A.page))?.baseToken);
  await L.addExpense(A.page, "T1-COARSE", 660);
  const paused = await L.waitFor(async () => (await L.syncState(A.page))?.paused === "token-unreliable", { timeout: 15000 });
  const w = fake.writeLog.filter(x => x.outcome === "applied").length;
  await L.addExpense(A.page, "T1-AFTER", 661); await A.page.waitForTimeout(3000);
  record("T1", "concurrency token unreliable: sync pauses instead of overwriting", paused && fake.writeLog.filter(x => x.outcome === "applied").length === w, { paused: Boolean(paused), noFurtherWrites: fake.writeLog.filter(x => x.outcome === "applied").length === w });
}

// ── harness self-checks ─────────────────────────────────────────────────────────────────────
const leaked = blocked.filter(u => /supabase\.(co|in)/.test(u));
record("SAFE", "isolation from production", leaked.length === 0 && fake.stats.unconditionalWrites === 0, { supabaseRequestsAttempted: leaked.length, unconditionalCloudWrites: fake.stats.unconditionalWrites, otherNonLocalAborted: [...new Set(blocked.map(u => new URL(u).hostname))] });
record("P2-after", "export unchanged after all scenarios", L.verifyExport(exportBefore), { sha256: exportBefore.sha256 });

fs.mkdirSync(OUT, { recursive: true });
const stable = results.map(r => ({ id: r.id, pass: r.pass }));
const out = L.writeImmutableExport(OUT, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, { at: new Date().toISOString(), outcomeVector: stable, results });
console.log("\noutcome vector:", JSON.stringify(stable));
console.log("run record:", out.file.replace(/.*results\//, "results/"), out.sha256.slice(0, 12));
for (const c of ctxs) await c.close().catch(() => {});
await browser.close(); await fake.close();
process.exit(results.every(r => r.pass) ? 0 : 1);
