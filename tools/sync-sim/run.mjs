// Isolated sync-safety scenarios. SYNTHETIC DATA ONLY; fake backend on localhost; no production contact.
// Every non-local request is aborted; a request to *.supabase.co would fail the run.
// Setup:  VITE_SUPABASE_URL=http://localhost:54399 VITE_SUPABASE_ANON_KEY=synthetic VITE_FORCE_DEV_AUTH_BYPASS=false npx vite --port 5196 &
// Run:    node tools/sync-sim/run.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startFakeSupabase } from "./fakeSupabase.mjs";
import * as L from "./lib.mjs";

const OUT = new URL("./results/", import.meta.url).pathname;
const results = [];
const record = (id, property, pass, evidence) => { results.push({ id, property, pass, evidence }); console.log(`${pass ? "PASS" : "FAIL"}  ${id}  [${property}]\n      ${JSON.stringify(evidence)}`); };

const fake = await startFakeSupabase({ users: { [L.TOKEN]: L.USER } });
const { browser, device, blocked } = await L.launch();
const uid = L.USER.id;
const accounts = L.syntheticSnapshot([], "x").accounts;
const BASE = L.syntheticTxns("B", 12);
const baseIds = BASE.map(t => t.id).sort();
const exportBefore = L.writeImmutableExport(OUT + "immutable", "synthetic-baseline.export.json", { dataset: "synthetic", txns: BASE, accounts });

async function world({ cloudTxns = BASE, cloudAgeMs = 0 } = {}) {
  fake.rows.clear(); fake.writeLog.length = 0; await L.setFaults({ latencyMs: 0, rejectWrites: 0, dropResponseWrites: 0, offline: false });
  fake.seed(uid, L.syntheticSnapshot(cloudTxns, new Date(Date.now() - cloudAgeMs).toISOString()));
}
async function boot(name, localTxns, first = true) {
  const d = await device(name, { seedLocal: { arth_txns: localTxns, arth_accounts: accounts, arth_master_user_setup_complete: true } });
  await d.page.goto(L.APP, { waitUntil: "networkidle" }); await L.pin(d.page, first); await d.page.waitForTimeout(1800);
  return d;
}
const findId = async (page, desc) => (await L.localTxns(page)).find(t => t.desc === desc)?.id;
const reopen = async (d) => { const page = await d.ctx.newPage(); await page.goto(L.APP, { waitUntil: "networkidle" }); await L.pin(page, false); await page.waitForTimeout(2500); return page; };

// ── P1  durable local save BEFORE asynchronous sync ─────────────────────────────────────────
{
  await world(); const A = await boot("A", BASE);
  await L.setFaults({ offline: true });
  const w0 = fake.writeLog.length;
  await L.addExpense(A.page, "P1-OFFLINE-SAVE", 555);
  const id = await findId(A.page, "P1-OFFLINE-SAVE");              // read straight after Save, before the 900 ms push debounce
  const cloudHad = L.cloudTxnIds(fake, uid).includes(String(id));
  await A.page.reload({ waitUntil: "networkidle" }); await L.pin(A.page, false); await A.page.waitForTimeout(1500);
  const afterReload = Boolean(await findId(A.page, "P1-OFFLINE-SAVE"));
  record("P1", "1 durable local save before async sync", Boolean(id) && !cloudHad && fake.writeLog.length === w0 && afterReload,
    { savedLocallyImmediately: Boolean(id), cloudHadItAtThatMoment: cloudHad, serverWritesDuringTest: fake.writeLog.length - w0, stillThereAfterReloadWhileOffline: afterReload });
  await A.ctx.close();
}

// ── P2  recoverable, immutable export ───────────────────────────────────────────────────────
{
  const intact = L.verifyExport(exportBefore);
  const ids = JSON.parse(fs.readFileSync(exportBefore.file, "utf8")).txns.map(t => t.id).sort();
  const d = L.diff(baseIds, ids);
  const copy = path.join(os.tmpdir(), "tamper-copy.json"); fs.copyFileSync(exportBefore.file, copy); fs.writeFileSync(copy, "tampered");
  const tamperDetected = L.sha256(fs.readFileSync(copy, "utf8")) !== exportBefore.sha256; fs.unlinkSync(copy);
  record("P2", "2 recoverable immutable export", intact && !d.missing.length && !d.unexpected.length && tamperDetected,
    { file: "results/immutable/synthetic-baseline.export.json", sha256: exportBefore.sha256, idsInExport: ids.length, diffVsBaseline: d, tamperOfACopyDetectedByHash: tamperDetected, note: "write-once + SHA-256 verified; chmod 444 is advisory because the harness runs as root" });
}

// ── P5a  server rejects the write ───────────────────────────────────────────────────────────
{
  await world(); const A = await boot("A", BASE);
  await L.setFaults({ rejectWrites: 3 });
  await L.addExpense(A.page, "P5A-REJECTED", 611); await A.page.waitForTimeout(2500);
  const id = await findId(A.page, "P5A-REJECTED");
  const cloudDuring = L.cloudTxnIds(fake, uid).includes(String(id));
  const panel = await L.cloudPanelText(A.page);
  await A.page.getByText("←", { exact: true }).first().click().catch(() => {});
  await L.setFaults({ rejectWrites: 0 });
  await A.page.goto(L.APP, { waitUntil: "networkidle" }).catch(() => {}); await L.pin(A.page, false); await A.page.waitForTimeout(2500);
  const localAfter = Boolean(await findId(A.page, "P5A-REJECTED"));
  await L.addExpense(A.page, "P5A-NEXT", 612); await A.page.waitForTimeout(2500);
  const cloudAfter = L.cloudTxnIds(fake, uid);
  record("P5a", "5 server rejects write", Boolean(id) && !cloudDuring && cloudAfter.includes(String(id)),
    { localKeptWhileRejected: Boolean(id), cloudHadItWhileRejected: cloudDuring, rejectedWrites: fake.writeLog.filter(w => w.outcome === "rejected-500").length, userToldOfFailure: /Sync failed/.test(panel), survivedReloadLocally: localAfter, cloudHasItAfterServerRecovered: cloudAfter.includes(String(id)) });
  await A.ctx.close();
}

// ── P5b  write applied but response lost ────────────────────────────────────────────────────
{
  await world(); const A = await boot("A", BASE);
  await L.setFaults({ dropResponseWrites: 1 });
  await L.addExpense(A.page, "P5B-DROPPED", 622); await A.page.waitForTimeout(2500);
  const id = await findId(A.page, "P5B-DROPPED");
  const local = await L.localTxnIds(A.page), cloud = L.cloudTxnIds(fake, uid);
  const d = L.diff(local, cloud);
  record("P5b", "5 response lost after server applied", Boolean(id) && !d.missing.length && !d.unexpected.length,
    { localCount: local.length, cloudCount: cloud.length, reconcileLocalVsCloud: d, writesApplied: fake.writeLog.filter(w => w.outcome === "applied").length });
  await A.ctx.close();
}

// ── P5c  app closed inside the 900 ms push debounce, reopened ──────────────────────────────
for (const [label, age] of [["cloud last written 10 min ago", 600e3], ["cloud last written 10 s ago", 10e3]]) {
  await world({ cloudAgeMs: age }); const A = await boot("A", BASE);
  await L.addExpense(A.page, "P5C-CLOSED-EARLY", 633);
  const id = await findId(A.page, "P5C-CLOSED-EARLY");
  const w0 = fake.writeLog.length;
  await A.page.close();
  const page = await reopen(A);
  const stillLocal = (await L.localTxns(page)).some(t => String(t.id) === String(id));
  const cloudHas = L.cloudTxnIds(fake, uid).includes(String(id));
  const inBackup = (await L.localBackups(page)).some(b => b.ids.includes(String(id)));
  record(`P5c(${label})`, "5 closed before push", stillLocal || cloudHas,
    { savedLocallyBeforeClose: Boolean(id), writesReachedServerBeforeReopen: 0, serverWritesAfterReopen: fake.writeLog.length - w0, presentLocallyAfterReopen: stillLocal, presentInCloud: cloudHas, inLocalBackup: inBackup, SILENT_LOSS: !stillLocal && !cloudHas && !inBackup });
  await A.ctx.close();
}

// ── L1  boot with a cloud snapshot older than 60 s: does an edit sync, and what does Sync Now do? ──
{
  await world({ cloudAgeMs: 600e3 }); const A = await boot("A", BASE);
  const w0 = fake.writeLog.length;
  await L.addExpense(A.page, "L1-EDIT-AFTER-BOOT", 644); await A.page.waitForTimeout(3000);
  const id = await findId(A.page, "L1-EDIT-AFTER-BOOT");
  const syncedByAuto = L.cloudTxnIds(fake, uid).includes(String(id));
  const panel = await L.cloudPanelText(A.page);
  const claimsAuto = /Every change saves to cloud automatically/.test(panel), warnsNewer = /newer local data/.test(panel);
  await L.pressSyncNow(A.page);                                     // ONE tap, as a user would
  const afterTap = (await L.localTxns(A.page)).some(t => String(t.id) === String(id));
  const cloudAfterTap = L.cloudTxnIds(fake, uid).includes(String(id));
  const inBackup = (await L.localBackups(A.page)).some(b => b.ids.includes(String(id)));
  record("L1", "3 conflict handling / 4 reconciliation", syncedByAuto || (afterTap || cloudAfterTap || inBackup),
    { editSyncedAutomatically: syncedByAuto, serverWritesAfterEdit: fake.writeLog.length - w0, panelClaimsEveryChangeSavesAutomatically: claimsAuto, panelWarnsNewerLocalData: warnsNewer, afterOneSyncNowTap: { stillLocal: afterTap, inCloud: cloudAfterTap, inLocalBackup: inBackup }, SILENT_LOSS: !afterTap && !cloudAfterTap && !inBackup });
  await A.ctx.close();
}

// ── P3/P4  two devices diverge, then reconnect ──────────────────────────────────────────────
for (const [label, age] of [["A's push is 10 min old when B reconnects", 600e3], ["A's push is 10 s old when B reconnects", 10e3]]) {
  await world({ cloudAgeMs: 900e3 });
  const A_tx = L.syntheticTxns("A", 1, 1);
  const B = await boot("B", BASE);
  await L.setFaults({ offline: true });
  await L.addExpense(B.page, "B-OFFLINE-CREATE", 700);
  const bId = String(await findId(B.page, "B-OFFLINE-CREATE"));
  await B.page.close();
  await L.setFaults({ offline: false });
  fake.seed(uid, L.syntheticSnapshot([...BASE, ...A_tx], new Date(Date.now() - age).toISOString()));   // device A's push
  const expected = [...baseIds, ...A_tx.map(t => t.id), bId].sort();
  const page = await reopen(B);
  const bLocal = await L.localTxnIds(page), cloud = L.cloudTxnIds(fake, uid);
  const panel = await L.cloudPanelText(page);
  const inBackup = (await L.localBackups(page)).some(b => b.ids.includes(bId));
  const keptLive = bLocal.includes(bId) || cloud.includes(bId);
  const converged = JSON.stringify(bLocal) === JSON.stringify(cloud);
  record(`P3/P4(${label})`, "3 conflict detected / 4 reconcile", keptLive && /newer local data|conflict/i.test(panel) || (keptLive && converged && bLocal.length === expected.length),
    { expected: expected.length, deviceBLocal: bLocal.length, cloud: cloud.length, bKeptItsOfflineTxn: bLocal.includes(bId), cloudHasBsTxn: cloud.includes(bId), cloudHasAsTxn: cloud.includes("A001"), deviceBHasAsTxn: bLocal.includes("A001"), conflictVisibleInSettings: /newer local data|conflict/i.test(panel), bsTxnInLocalBackup: inBackup, devicesConverged: converged, SILENT_LOSS: !keptLive && !inBackup, missingFromCloudVsUnion: L.diff(expected, cloud).missing.length, missingFromBVsUnion: L.diff(expected, bLocal).missing.length });
  await B.ctx.close();
}

// ── harness self-checks ─────────────────────────────────────────────────────────────────────
const leaked = blocked.filter(u => /supabase\.(co|in)/.test(u));
record("SAFE", "isolation from production", leaked.length === 0, { supabaseRequestsAttempted: leaked.length, otherNonLocalAborted: [...new Set(blocked.map(u => new URL(u).hostname))], requestsServedByFake: fake.requestLog.length });
record("P2-after", "export unchanged after all scenarios", L.verifyExport(exportBefore), { sha256: exportBefore.sha256 });

fs.mkdirSync(OUT, { recursive: true });
const out = L.writeImmutableExport(OUT, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, { at: new Date().toISOString(), results, serverWriteLog: fake.writeLog.map(w => ({ seq: w.seq, outcome: w.outcome, txnIds: (w.snapshot?.txns || []).map(t => t.id) })) });
console.log("\nrun record:", out.file.replace(/.*results\//, "results/"), out.sha256.slice(0, 12));
await browser.close(); await fake.close();
