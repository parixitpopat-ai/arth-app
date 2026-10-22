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
async function boot(name, localTxns, extra = {}) {
  const d = await device(name, { seedLocal: { arth_txns: localTxns, arth_accounts: accounts, arth_master_user_setup_complete: true, ...extra } });
  ctxs.push(d.ctx);
  await d.page.goto(L.APP, { waitUntil: "networkidle" }); await L.pin(d.page, true);
  return d;
}
const ids = page => L.localTxnIds(page);
const findId = async (page, desc) => (await L.localTxns(page)).find(t => t.desc === desc)?.id;
const cloud = () => fake.cloudIds(uid);
const synced = page => async () => { const s = await L.syncState(page); const l = await ids(page); return s && s.baseToken && !s.pendingWrite && JSON.stringify(l) === JSON.stringify(cloud()); };
/** Two devices that have genuinely synced through the app: A uploads its data, B starts empty and adopts it. */
async function establish(extraA = {}) {
  await resetWorld();
  const A = await boot("A", BASE, extraA);
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

// Q1 ── a backup that cannot be written blocks the replacement (the file sheet is offered; cancelling replaces nothing) ──
{
  const { A, B, aId, bId } = await diverge();
  await L.failBackupWrites(B.page, true);
  const before = await ids(B.page);
  await B.page.getByTestId("sync-use-cloud").dispatchEvent("click");
  const sheet = await L.waitFor(() => B.page.getByTestId("sync-backup-file-sheet").count(), { timeout: 8000 });
  await B.page.getByTestId("sync-backup-file-cancel").dispatchEvent("click"); await B.page.waitForTimeout(1500);
  const after = await ids(B.page);
  const st = await L.syncState(B.page);
  await L.failBackupWrites(B.page, false);
  record("Q1", "backup-before-replacement: a failed backup blocks the replacement", JSON.stringify(before) === JSON.stringify(after) && after.includes(bId) && Boolean(st?.conflict) && Boolean(sheet), { fileSheetOffered: Boolean(sheet), deviceUntouched: JSON.stringify(before) === JSON.stringify(after), conflictStillOpen: Boolean(st?.conflict) });
}

// R1 ── a cloud copy that differs from what was sent pauses sync ─────────────────────────────
{
  const { A } = await establish();
  await L.setFaults({ corruptNext: true });
  await L.addExpense(A.page, "R1-CORRUPTED", 650);
  const id = String(await findId(A.page, "R1-CORRUPTED"));
  const paused = await L.waitFor(async () => (await L.syncState(A.page))?.paused === "reconcile-mismatch", { timeout: 15000 });
  const banner = await bannerText(A.page);
  const localAfter = await ids(A.page);
  record("R1", "4 reconciliation mismatch is detected and sync pauses", paused && localAfter.includes(id) && cloud().length === localAfter.length - 1 && /don't match|copies/i.test(banner), { paused: Boolean(paused), localIntact: localAfter.includes(id), bannerShown: /copies/i.test(banner), cloudHasOneFewerThanDevice: cloud().length === localAfter.length - 1 });
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


// ══ SYNC-SAFETY-004 scenarios ═══════════════════════════════════════════════════════════════════════════════════════
const monthKeyAhead = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const NEXT = monthKeyAhead(1);
const bigBill = () => ({ id: "nb1", name: "Big annual fee", merchant: "SYN", amount: 90000, dueDate: `${NEXT}-10`, billDate: `${NEXT}-10`, catId: "utilities", catIds: ["utilities"], status: "unpaid", paidDate: null, createdDate: "2026-10-01", createdAt: 1, splitPeople: {}, recurring: false });
const cloudSnap = () => fake.rows.get(uid)?.snapshot;
const fireVisible = page => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));

// TAB ── two tabs of one device: only one owns the app; a takeover is explicit; a foreign write makes a tab stale ─────────
{
  const { A } = await establish();
  const tab1 = A.page, tab2 = await A.ctx.newPage();
  await tab2.goto(L.APP, { waitUntil: "networkidle" }); await tab2.waitForTimeout(1500);
  const pausedShown = await tab2.getByTestId("tab-paused").count(), appMounted = await tab2.getByText("+", { exact: true }).count();
  const title = await tab2.getByTestId("tab-paused-title").innerText().catch(() => "");
  const w0 = fake.writeLog.length;
  await L.addExpense(tab1, "TAB-FROM-1", 811); const t1 = String(await findId(tab1, "TAB-FROM-1"));
  const delivered = await L.waitFor(() => cloud().includes(t1), { timeout: 15000 });
  record("TAB1", "two-tab: only one tab runs Arth; the second mounts nothing and cannot sync", pausedShown === 1 && appMounted === 0 && /open in another tab/i.test(title) && delivered,
    { secondTabPaused: pausedShown === 1, secondTabMountedNoApp: appMounted === 0, secondTabTitleOk: /open in another tab/i.test(title), ownerStillSyncs: delivered, ownerWritesOnly: fake.writeLog.length - w0 >= 1 });
  // explicit takeover: tab 2 loads the latest data; tab 1 pauses
  await tab2.getByTestId("tab-take-over").click(); await tab2.waitForTimeout(1500); await L.pin(tab2, false); await tab2.waitForTimeout(1500);
  const t2sees = (await ids(tab2)).includes(t1);
  const tab1Paused = await L.waitFor(() => tab1.getByTestId("tab-paused").count(), { timeout: 8000 });
  await L.addExpense(tab2, "TAB-FROM-2", 822); const t2 = String(await findId(tab2, "TAB-FROM-2"));
  const delivered2 = await L.waitFor(() => cloud().includes(t2), { timeout: 15000 });
  await tab1.getByTestId("tab-take-over").click(); await tab1.waitForTimeout(1500); await L.pin(tab1, false); await tab1.waitForTimeout(1500);
  const t1sees = (await ids(tab1)).includes(t2);
  const lost = await lostAcross([{ page: tab1 }], [t1, t2]);
  record("TAB2", "two-tab: 'Use this tab' hands over with the latest data; nothing is lost", t2sees && Boolean(tab1Paused) && delivered2 && t1sees && lost.length === 0,
    { newOwnerSawOldOwnersChange: t2sees, oldOwnerPaused: Boolean(tab1Paused), newOwnerSynced: delivered2, handedBackWithLatest: t1sees, lost: lost.length });
  // a write by another tab to the synced data makes the owner stale (defence in depth)
  await A.ctx.route("**/__tab-writer.html", r => r.fulfill({ contentType: "text/html", body: "<script>const t=JSON.parse(localStorage.getItem('arth_txns')||'[]'); if(t[0]) t[0].note='edited elsewhere'; localStorage.setItem('arth_txns', JSON.stringify(t));</script>ok" }));
  const writer = await A.ctx.newPage(); await writer.goto(L.APP + "__tab-writer.html"); await writer.waitForTimeout(500); await writer.close();
  const staleShown = await L.waitFor(async () => /changed in another tab/i.test(await tab1.getByTestId("tab-paused-title").innerText().catch(() => "")), { timeout: 8000 });
  await tab1.getByTestId("tab-reload").click(); await tab1.waitForTimeout(1500); await L.pin(tab1, false); await tab1.waitForTimeout(1500);
  record("TAB3", "two-tab: a foreign write marks the tab stale; it stops, then reloads cleanly", Boolean(staleShown) && (await ids(tab1)).includes(t2), { staleOverlayShown: Boolean(staleShown), reloadedWithLatestData: (await ids(tab1)).includes(t2) });
}

// BN ── Plan Ahead nudge through the real UI, across two devices ────────────────────────────────────────────────────────
{
  const { A, B } = await establish({ arth_bills: [bigBill()] });
  await L.waitFor(async () => (await L.localTxnIds(B.page)).length === BASE.length);
  await L.openPlanAhead(B.page); const beforeCard = await L.nudgeNotNow(B.page).count();           // B sees the card
  await L.goHome(B.page).catch(() => {});
  await B.page.reload({ waitUntil: "networkidle" }); await L.pin(B.page, false);
  await L.openPlanAhead(A.page); await L.nudgeNotNow(A.page).click(); await A.page.waitForTimeout(500);
  const inCloud = await L.waitFor(() => Boolean(cloudSnap()?.planNudges?.[NEXT]?.dismissedAtUsed), { timeout: 15000 });
  await fireVisible(B.page);
  const bGot = await L.waitFor(async () => Boolean((await L.localNudges(B.page))[NEXT]?.dismissedAtUsed), { timeout: 15000 });
  await B.page.reload({ waitUntil: "networkidle" }); await L.pin(B.page, false);
  await L.openPlanAhead(B.page); const afterCard = await L.nudgeNotNow(B.page).count();
  record("BN1", "Plan Ahead: 'Not now' reaches the cloud and the other device stops offering the card", beforeCard === 1 && inCloud && bGot && afterCard === 0, { otherDeviceSawCardBefore: beforeCard === 1, dismissalInCloud: inCloud, otherDeviceReceivedIt: bGot, otherDeviceCardGone: afterCard === 0 });
}
{
  const { A, B } = await establish({ arth_bills: [bigBill()] });
  await L.openPlanAhead(A.page); await L.nudgeRaise(A.page).click(); await A.page.waitForTimeout(500);
  const inCloud = await L.waitFor(() => cloudSnap()?.monthOverrides?.[NEXT] === 90000 && cloudSnap()?.planNudges?.[NEXT]?.raisedTo === 90000, { timeout: 15000 });
  await fireVisible(B.page);
  const bGot = await L.waitFor(async () => (await L.localOverrides(B.page))[NEXT] === 90000 && (await L.localNudges(B.page))[NEXT]?.raisedTo === 90000, { timeout: 15000 });
  record("BN2", "Plan Ahead: accepting a raise syncs the nudge record and the budget override together", inCloud && bGot, { raiseAndOverrideInCloud: inCloud, otherDeviceGotBoth: bGot, reconcile: (await L.syncState(B.page))?.lastReconcile?.ok === true });
}
{
  const { A, B } = await establish({ arth_bills: [bigBill()] });
  await B.ctx.setOffline(true);
  await L.openPlanAhead(B.page); await L.nudgeRaise(B.page).click(); await B.page.waitForTimeout(500);
  await L.openPlanAhead(A.page); await L.nudgeNotNow(A.page).click(); await A.page.waitForTimeout(500);
  await L.waitFor(() => Boolean(cloudSnap()?.planNudges?.[NEXT]?.dismissedAtUsed), { timeout: 15000 });
  await B.ctx.setOffline(false);
  await B.page.reload({ waitUntil: "networkidle" }); await L.pin(B.page, false);
  const conflict = await L.waitFor(async () => (await L.syncState(B.page))?.conflict, { timeout: 20000 });
  const other = await B.page.getByTestId("sync-conflict-other").innerText().catch(() => "");
  const pins = (await B.page.evaluate(() => JSON.parse(localStorage.getItem("arth_sync_safety_backups") || "[]").filter(b => b.pinned).map(b => b.reason).sort()));
  record("BN3", "Plan Ahead: a nudge-only conflict is described and both copies are held", Boolean(conflict) && /Plan Ahead choices/.test(other) && pins.length === 2 && cloudSnap()?.planNudges?.[NEXT]?.dismissedAtUsed != null,
    { conflictRecorded: Boolean(conflict), sheetNamesPlanAhead: /Plan Ahead choices/.test(other), sheetNamesBudgetChange: /monthly budget changes/.test(other), bothCopiesHeld: pins.join("|") === "conflict-cloud-copy|conflict-device-copy", cloudKeptDismissal: cloudSnap()?.planNudges?.[NEXT]?.dismissedAtUsed != null });
}

// FB ── backup file fallback, through the real UI ───────────────────────────────────────────────────────────────────────
async function fileFallbackSetup() {
  const { A, B, aId, bId } = await diverge();
  await L.failBackupWrites(B.page, true);
  await B.page.getByTestId("sync-use-cloud").dispatchEvent("click");
  await L.waitFor(() => B.page.getByTestId("sync-backup-file-sheet").count(), { timeout: 8000 });
  return { A, B, aId, bId };
}
{
  const { A, B, aId, bId } = await fileFallbackSetup();
  const [dl] = await Promise.all([B.page.waitForEvent("download", { timeout: 10000 }), B.page.getByTestId("sync-backup-file-download").dispatchEvent("click")]);
  const file = await dl.path(); const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const saved = L.writeImmutableExport(OUT + "immutable", "sync-fallback-backup.json", parsed);
  await B.page.getByTestId("sync-backup-file-input").setInputFiles(file); await B.page.waitForTimeout(2500);
  const replaced = await L.waitFor(async () => (await ids(B.page)).includes(aId) && !(await ids(B.page)).includes(bId), { timeout: 15000 });
  const st = await L.syncState(B.page);
  const fileHasBs = (parsed.snapshot?.txns || []).some(t => String(t.id) === bId);
  await L.failBackupWrites(B.page, false);
  record("FB1", "backup-file fallback: a downloaded, re-selected, verified file secures the replacement", Boolean(replaced) && fileHasBs && st?.lastBackup?.external === true && L.verifyExport(saved), { fileContainsTheReplacedData: fileHasBs, replacementProceededAfterVerification: Boolean(replaced), recordedAsFileBackup: st?.lastBackup?.external === true, fileHasChecksum: typeof parsed.digest === "string" && parsed.digest.length === 64 });
}
{
  const { B, bId } = await fileFallbackSetup();
  const [dl] = await Promise.all([B.page.waitForEvent("download", { timeout: 10000 }), B.page.getByTestId("sync-backup-file-download").dispatchEvent("click")]);
  const good = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
  const before = await ids(B.page);
  const bad1 = OUT + "immutable/synthetic-baseline.export.json";                            // a different, non-Arth-sync file
  await B.page.getByTestId("sync-backup-file-input").setInputFiles(bad1); await B.page.waitForTimeout(1500);
  const err1 = await B.page.getByTestId("sync-backup-file-error").innerText().catch(() => "");
  const damaged = JSON.parse(JSON.stringify(good)); damaged.snapshot.txns.pop();
  fs.mkdirSync(OUT + "tmp", { recursive: true }); const dpath = OUT + "tmp/damaged-backup.json"; fs.writeFileSync(dpath, JSON.stringify(damaged));
  await B.page.getByTestId("sync-backup-file-input").setInputFiles(dpath); await B.page.waitForTimeout(1500);
  const err2 = await B.page.getByTestId("sync-backup-file-error").innerText().catch(() => "");
  const unchanged = JSON.stringify(await ids(B.page)) === JSON.stringify(before) && before.includes(bId);
  await B.page.getByTestId("sync-backup-file-cancel").dispatchEvent("click"); await B.page.waitForTimeout(1000);
  await L.failBackupWrites(B.page, false); fs.rmSync(OUT + "tmp", { recursive: true, force: true });
  record("FB2", "backup-file fallback: wrong or damaged files are refused and nothing is replaced", /not an Arth sync backup/i.test(err1) && /damaged/i.test(err2) && unchanged && Boolean((await L.syncState(B.page))?.conflict),
    { wrongFileRefused: /not an Arth sync backup/i.test(err1), damagedFileRefused: /damaged/i.test(err2), deviceUntouched: unchanged, conflictStillOpen: Boolean((await L.syncState(B.page))?.conflict) });
}

// RB ── recover from a sync safety backup through Backup & Restore (both sides are backed up first) ───────────────────────
{
  const { A, B, aId, bId } = await diverge();
  await B.page.getByTestId("sync-use-cloud").dispatchEvent("click");                       // B adopts A's data; B's own is saved as 'before-use-cloud'
  await L.waitFor(async () => (await ids(B.page)).includes(aId) && !(await ids(B.page)).includes(bId), { timeout: 20000 });
  await L.waitFor(synced(B.page), { timeout: 20000 });
  await B.page.getByText("☰", { exact: true }).first().dispatchEvent("click"); await B.page.waitForTimeout(400);
  await B.page.getByText("⚙️", { exact: true }).first().dispatchEvent("click"); await B.page.waitForTimeout(400);
  await B.page.getByText("Backup & Restore", { exact: true }).dispatchEvent("click"); await B.page.waitForTimeout(600);
  const rows = await B.page.getByTestId("sync-safety-backup-row").count();
  B.page.on("dialog", d => d.accept());
  await B.page.getByTestId("sync-safety-backup-row").filter({ hasText: "before replacing this device" }).getByRole("button", { name: "Restore" }).click();
  const restored = await L.waitFor(async () => (await ids(B.page)).includes(bId) && !(await ids(B.page)).includes(aId), { timeout: 20000 });
  const reasons = (await L.safetyBackups(B.page)).map(b => b.reason);
  const delivered = await L.waitFor(() => cloud().includes(bId) && !cloud().includes(aId), { timeout: 20000 });
  const bkIds = await L.safetyBackupIds(B.page);
  record("RB1", "recovery: restoring a sync safety backup backs up the device AND the cloud copy first, and loses nothing", rows >= 1 && Boolean(restored) && reasons.includes("before-restore") && reasons.includes("cloud-before-restore") && bkIds.includes(aId) && bkIds.includes(bId) && (await lostAcross([A, B], [aId, bId])).length === 0,
    { safetyBackupsListedInUi: rows >= 1, restoredOldDeviceData: Boolean(restored), deviceBackedUpFirst: reasons.includes("before-restore"), cloudCopyBackedUpFirst: reasons.includes("cloud-before-restore"), restoredDataSyncedToCloud: Boolean(delivered), bothVersionsStillRecoverable: bkIds.includes(aId) && bkIds.includes(bId), lost: (await lostAcross([A, B], [aId, bId])).length });
}

// SI ── sign-in and recovery through the real screens (fake auth, code 123456) ─────────────────────────────────────────────
async function finishSignIn(page, { name = "Synthetic Tester", newPin = true } = {}) {
  await page.waitForTimeout(1500);
  await L.completeProfile(page, name);
  await L.pin(page, newPin); await page.waitForTimeout(2000);
}
// SYNC-SAFETY-008: a phone that already holds data with no recorded owner is asked, on an interactive sign-in, what to do with it
// before anything is sent. These scenarios model such a phone ("an existing install"), so they answer "Add it to this account".
async function signInAddingExisting(page, email) {
  const r = await L.signIn(page, email, { mode: "signin" });
  const asked = Boolean(await L.waitFor(() => page.getByTestId("ownership-screen").count(), { timeout: 8000 }));
  const before = asked ? JSON.stringify(cloud()) : null;
  if (asked) { await page.getByTestId("ownership-transfer").click(); await page.getByTestId("ownership-confirm-yes").click(); }   // the transfer always needs the second, explicit confirmation
  return { r, asked, cloudBeforeAnswer: before };
}
const EMAIL = "sync-test-a@example.invalid";
const NTX = L.syntheticTxns("N", 5);
{
  await resetWorld(); fake.resetAccounts();
  const N = await device("N", { signedIn: false }); ctxs.push(N.ctx);
  const r = await L.signIn(N.page, EMAIL, { mode: "signup" }); await finishSignIn(N.page);
  const rowMade = await L.waitFor(() => fake.rows.size === 1, { timeout: 15000 });
  await L.addExpense(N.page, "SI1-FIRST", 901); const id = String(await findId(N.page, "SI1-FIRST"));
  const delivered = await L.waitFor(() => cloud().includes(id), { timeout: 15000 });
  const st = await L.syncState(N.page);
  const profileInCloud = JSON.stringify(cloudSnap()?.people || []).includes("Synthetic Tester");
  record("SI1", "sign-in: a brand-new account reaches the app, creates its cloud copy, and syncs the first transaction", r.stage === "verified" && rowMade && delivered && Boolean(st?.baseToken) && !st?.conflict && profileInCloud, { signedIn: r.stage === "verified", cloudCopyCreated: rowMade, firstTransactionSynced: delivered, profileInCloud, noConflict: !st?.conflict });
}
{
  await resetWorld(); fake.resetAccounts(); fake.addAccount(EMAIL);
  const N = await device("N", { signedIn: false, seedLocal: { arth_txns: BASE, arth_accounts: accounts } }); ctxs.push(N.ctx);
  const q = await signInAddingExisting(N.page, EMAIL); await finishSignIn(N.page);
  const ok = await L.waitFor(() => JSON.stringify(cloud()) === JSON.stringify(baseIds), { timeout: 20000 });
  const sawConflict = await N.page.getByText("Two versions of your data found").count();
  record("SI2", "sign-in: an existing install with no recorded owner is asked first (nothing uploaded before the answer); 'Add it to this account' then uploads its data to the empty account", q.asked && q.cloudBeforeAnswer === "[]" && Boolean(ok) && sawConflict === 0 && JSON.stringify(await ids(N.page)) === JSON.stringify(baseIds), { asked: q.asked, cloudBeforeAnswer: q.cloudBeforeAnswer, cloudHoldsAllLocalTransactions: Boolean(ok), noConflictScreen: sawConflict === 0, localUnchanged: JSON.stringify(await ids(N.page)) === JSON.stringify(baseIds) });
}
for (const choice of ["keep-cloud", "keep-local"]) {
  await resetWorld(); fake.resetAccounts(); fake.addAccount(EMAIL);
  const X = await device("X", { signedIn: false, seedLocal: { arth_txns: BASE, arth_accounts: accounts } }); ctxs.push(X.ctx);
  await signInAddingExisting(X.page, EMAIL); await finishSignIn(X.page);
  await L.waitFor(() => JSON.stringify(cloud()) === JSON.stringify(baseIds), { timeout: 20000 });
  const N = await device("N", { signedIn: false, seedLocal: { arth_txns: NTX, arth_accounts: accounts } }); ctxs.push(N.ctx);
  await signInAddingExisting(N.page, EMAIL);
  const screen = await L.waitFor(() => N.page.getByText("Two versions of your data found").count(), { timeout: 15000 });
  const nIds = NTX.map(t => t.id).sort();
  await N.page.getByRole("button", { name: choice === "keep-cloud" ? /Use the cloud version/ : /Keep this device's data/ }).click();
  await N.page.waitForTimeout(2500); await finishSignIn(N.page);
  const bkIds = await L.safetyBackupIds(N.page);
  const reasons = (await L.safetyBackups(N.page)).map(b => b.reason);
  let ok;
  if (choice === "keep-cloud") ok = JSON.stringify(await ids(N.page)) === JSON.stringify(baseIds) && nIds.every(i => bkIds.includes(i)) && JSON.stringify(cloud()) === JSON.stringify(baseIds);
  else ok = JSON.stringify(cloud()) === JSON.stringify(nIds) && baseIds.every(i => bkIds.includes(i));
  record(`SI3-${choice}`, "sign-in: existing install and a different cloud copy -> explicit choice, the replaced side is backed up first", Boolean(screen) && ok,
    { conflictScreenShown: Boolean(screen), chosenSideWon: ok, replacedSideRecoverableFromBackup: choice === "keep-cloud" ? nIds.every(i => bkIds.includes(i)) : baseIds.every(i => bkIds.includes(i)), backupReasons: reasons.sort() });
}
{
  await resetWorld(); fake.resetAccounts(); fake.addAccount(EMAIL);
  const N = await device("N", { signedIn: false, seedLocal: { arth_txns: BASE, arth_accounts: accounts } }); ctxs.push(N.ctx);
  await signInAddingExisting(N.page, EMAIL); await finishSignIn(N.page);
  await L.waitFor(synced(N.page), { timeout: 20000 });
  const before = await L.syncState(N.page);
  await L.openCloudSettings(N.page); await N.page.getByText("Sign Out", { exact: true }).click(); await N.page.waitForTimeout(1500);
  const welcome = await N.page.getByText("Welcome to Arth").count();
  await L.signIn(N.page, EMAIL, { mode: "signin" }); await N.page.waitForTimeout(3000);
  const after = await L.syncState(N.page);
  const conflict = await N.page.getByText("Two versions of your data found").count();
  record("SI4", "sign-in: signing out and back in keeps the sync history; no conflict, nothing re-uploaded or lost", welcome === 1 && conflict === 0 && after?.baseToken === before?.baseToken && !after?.conflict && JSON.stringify(await ids(N.page)) === JSON.stringify(baseIds),
    { signedOutToWelcome: welcome === 1, noConflictScreen: conflict === 0, historyKept: after?.baseToken === before?.baseToken, dataUnchanged: JSON.stringify(await ids(N.page)) === JSON.stringify(baseIds) });
}
{
  await resetWorld(); fake.resetAccounts();
  const u = fake.addAccount("recovery@example.invalid");                                     // an account whose data lives only in the cloud
  fake.rows.set(u.id, { snapshot: JSON.parse(JSON.stringify({ ...L.syntheticSnapshot(BASE, new Date().toISOString()), masterUserSetupComplete: true })), micros: BigInt(Date.now()) * 1000n });
  const R = await device("R", { signedIn: false }); ctxs.push(R.ctx);                       // a reinstalled app: empty storage
  await L.signIn(R.page, "recovery@example.invalid", { mode: "signin" }); await R.page.waitForTimeout(2500); await L.pin(R.page, true); await R.page.waitForTimeout(2500);
  const got = await L.waitFor(async () => JSON.stringify(await ids(R.page)) === JSON.stringify(baseIds), { timeout: 20000 });
  const st = await L.syncState(R.page);
  record("SI5", "recovery: a reinstalled app signs in and gets every record back, reconciled", Boolean(got) && st?.lastReconcile?.ok === true && !st?.conflict, { allTransactionsRestored: Boolean(got), reconciled: st?.lastReconcile?.ok === true, recordsChecked: st?.lastReconcile?.records > 0, noConflict: !st?.conflict });
}
{
  await resetWorld(); fake.resetAccounts(); fake.addAccount(EMAIL);
  const N = await device("N", { signedIn: false }); ctxs.push(N.ctx);
  const bad = await L.signIn(N.page, EMAIL, { mode: "signin", code: "000000" });
  const err = await N.page.getByText(/expired or is invalid|didn't work|invalid/i).first().innerText().catch(() => "");
  const session = await N.page.evaluate(() => Boolean(localStorage.getItem("sb-localhost-auth-token")));
  const M = await device("M", { signedIn: false }); ctxs.push(M.ctx);
  const unknown = await L.signIn(M.page, "nobody@example.invalid", { mode: "signin" });
  const hint = await M.page.getByText(/couldn't find an Arth account/i).count();
  record("SI6", "sign-in: a wrong code and an unknown email are refused cleanly", bad.stage === "verified" && err.length > 0 && !session && unknown.stage === "email" && hint > 0, { wrongCodeRefused: err.length > 0 && !session, unknownEmailHint: hint > 0 });
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
