// SYNC-SAFETY-004: backup recovery, "Decide later" preserving both copies, whole-snapshot reconciliation, file fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "./scenarios.js";
import { lostIds } from "./testing/sim.js";
import { listPinned, listSafetyBackups, SAFETY_BACKUPS_KEY } from "./safetyBackup.js";
import { buildRecoverableExport, verifyRecoverableExport } from "./recoverableExport.js";
import { digestSnapshot } from "./digest.js";

const cloudIds = kit => (kit.cloud.rows.get(S.USER)?.snapshot.txns || []).map(t => t.id);
const stored = d => JSON.parse(d.storage.getItem(SAFETY_BACKUPS_KEY) || "[]");

test("'Decide later' keeps BOTH copies (pinned, verified) even after both devices keep changing, and nothing is lost", async () => {
  const kit = S.makeKit("new"); const r = await S.decideLaterWhileBothMove(kit);
  const pins = listPinned(r.B.storage);
  assert.deepEqual(pins.map(p => p.reason).sort(), ["conflict-cloud-copy", "conflict-device-copy"]);
  assert.equal(r.B.state().conflict.held.cloud, true);
  const cloudCopy = stored(r.B).find(b => b.reason === "conflict-cloud-copy");
  const deviceCopy = stored(r.B).find(b => b.reason === "conflict-device-copy");
  assert.ok(cloudCopy.snapshot.txns.some(t => t.id === r.aId), "the cloud copy as it was at the conflict holds A's transaction");
  assert.ok(!cloudCopy.snapshot.txns.some(t => t.id === r.aLater), "…even though the live cloud copy has since moved on");
  assert.ok(cloudIds(kit).includes(r.aLater), "A kept syncing");
  assert.ok(deviceCopy.snapshot.txns.some(t => t.id === r.bId));
  assert.ok(r.B.ids().includes(r.bId) && r.B.ids().includes(r.bLater), "B's device keeps working locally");
  assert.equal(r.B.status().kind, "conflict");
  assert.deepEqual(lostIds([r.A, r.B], kit.cloud), []);
});

test("pinned conflict backups survive heavy backup churn and are released once the conflict is resolved", async () => {
  const kit = S.makeKit("new"); const r = await S.divergentDevices(kit, 10_000);
  // Churn: many ordinary backups come and go (each use-cloud/keep-local style replacement makes one).
  const { createSafetyBackup } = await import("./safetyBackup.js"); let n = 0;
  for (let i = 0; i < 15; i++) await createSafetyBackup(r.B.storage, { reason: `churn${i}`, snapshot: { txns: [{ id: `x${i}` }] }, genId: () => `g${++n}` });
  assert.equal(listPinned(r.B.storage).length, 2, "pinned backups were not pruned by the rotation");
  assert.equal((await r.B.engine.resolveConflict("keep-local")).outcome, "resolved-keep-local");
  assert.equal(listPinned(r.B.storage).length, 0, "released after resolution");
  assert.ok(stored(r.B).some(b => b.reason === "conflict-cloud-copy"), "still present as ordinary backups (newest 10)");
});

test("if the cloud copy cannot be held locally the conflict is still recorded, nothing is replaced, and the status says so", async () => {
  const kit = S.makeKit("new");
  const A = kit.mk("A"), B = kit.mk("B"); kit.seed(0); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  kit.cloud.faults.offlineDevices.add("B"); B.addTxn("b"); await B.settle(1500);
  A.addTxn("a"); await A.settle(1500);
  kit.cloud.faults.offlineDevices.delete("B");
  B.storage.failKeys.add(SAFETY_BACKUPS_KEY);   // browser storage cannot hold backups
  await B.engine.onVisible(); await B.settle(500);
  assert.equal(B.status().kind, "conflict");
  assert.equal(B.state().conflict.held.cloud, false);
  assert.match(B.engine.getStatus().kind, /conflict/);
  assert.ok(B.ids().some(id => id.startsWith("B-")), "device data untouched");
});

test("reconciliation covers every list: an apply that drops a bill, payment, relationship, schedule or nudge is caught and not reported as synced", async () => {
  const { createDevice } = await import("./testing/sim.js");
  for (const key of ["bills", "contributions", "membershipRelationships", "feePeriods", "planNudges", "billerAccounts"]) {
    const kit = S.makeKit("new");
    kit.cloud.seed(S.USER, { version: 1, ...S.richData() }, 0);
    const drop = data => { if (Array.isArray(data[key])) data[key] = data[key].slice(1); else delete data[key]; return data; };
    const D = createDevice({ name: "D", clock: kit.clock, cloud: kit.cloud, applyTransform: drop });   // a normaliser bug on this key
    D.storage.setItem("arth_data", JSON.stringify({ txns: [], accounts: [], bills: [], people: [], planNudges: {} }));
    await D.start(); await D.settle(200);
    assert.equal(D.status().kind, "paused-reconcile", `${key}: a dropped record must pause sync`);
    assert.match(D.status().detail || D.state().lastReconcile.detail, new RegExp(key.slice(0, 6)), key);
    assert.deepEqual(listSafetyBackups(D.storage).map(b => b.reason), ["before-fast-forward"], "and the device's previous data was backed up first");
  }
  // control: a faithful apply reconciles cleanly and reports the dependent records it checked
  const kit = S.makeKit("new"); kit.cloud.seed(S.USER, { version: 1, ...S.richData() }, 0);
  const { createDevice: mk } = await import("./testing/sim.js");
  const ok = mk({ name: "OK", clock: kit.clock, cloud: kit.cloud });
  ok.storage.setItem("arth_data", JSON.stringify({ txns: [], accounts: [], bills: [], people: [], planNudges: {} }));
  await ok.start(); await ok.settle(200);
  assert.equal(ok.status().kind, "synced");
  assert.ok(ok.state().lastReconcile.records >= 10, "counted records across all lists");
});

test("file fallback: when browser storage cannot hold a backup, a file the person saves and re-selects secures the replacement; wrong, damaged or cancelled files do not", async () => {
  async function scenario(provide) {
    const kit = S.makeKit("new", {}, { requestExternalBackup: provide });
    const A = kit.mk("A"), B = kit.mk("B"); kit.seed(0); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
    const bId = B.addTxn("b"); await B.settle(1500);
    A.storage.failKeys.add(SAFETY_BACKUPS_KEY);   // browser storage cannot hold a backup
    const before = A.ids();
    await A.engine.onVisible(); await A.settle(500);
    return { kit, A, B, bId, before };
  }
  // 1. person saves and re-selects the correct file -> replacement allowed
  let seen;
  let r = await scenario(async (snapshot, reason) => { seen = { reason }; const file = await buildRecoverableExport(snapshot, { reason }); return verifyRecoverableExport(JSON.parse(JSON.stringify(file)), snapshot); });
  assert.ok(r.A.ids().includes(r.bId), "replacement proceeded after the verified file");
  assert.equal(r.A.status().kind, "synced"); assert.equal(r.A.state().lastBackup.external, true); assert.ok(seen.reason);
  // 2. a file of different data
  r = await scenario(async (snapshot, reason) => verifyRecoverableExport(await buildRecoverableExport({ txns: [{ id: "other" }] }, { reason }), snapshot));
  assert.equal(r.A.status().kind, "blocked-backup"); assert.deepEqual(r.A.ids(), r.before, "nothing replaced");
  // 3. a damaged file (edited after saving)
  r = await scenario(async (snapshot, reason) => { const f = JSON.parse(JSON.stringify(await buildRecoverableExport(snapshot, { reason }))); f.snapshot.txns.pop(); return verifyRecoverableExport(f, snapshot); });
  assert.equal(r.A.status().kind, "blocked-backup"); assert.deepEqual(r.A.ids(), r.before);
  // 4. cancelled
  r = await scenario(async () => ({ ok: false, error: "cancelled" }));
  assert.equal(r.A.status().kind, "blocked-backup"); assert.deepEqual(r.A.ids(), r.before);
  // 5. no file option at all
  const kit = S.makeKit("new"); const A = kit.mk("A"), B = kit.mk("B"); kit.seed(0); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  B.addTxn("b"); await B.settle(1500);
  A.storage.failKeys.add(SAFETY_BACKUPS_KEY);
  await A.engine.onVisible(); await A.settle(500);
  assert.equal(A.status().kind, "blocked-backup");
  assert.ok(!A.ids().includes("B-t1"), "no file option and no storage: nothing replaced");
});

test("recoverable export: format, checksum and record checks", async () => {
  const snap = { txns: [{ id: 1 }, { id: 2 }], bills: [{ id: "b" }], planNudges: { m: { status: "dismissed" } } };
  const file = await buildRecoverableExport(snap, { reason: "t", now: () => 0 });
  assert.equal(file.snapshot, snap, "snapshot stays at the top level so the existing Restore accepts the file");
  assert.equal(file.digest, await digestSnapshot(snap)); assert.equal(file.counts.bills, 1);
  assert.equal((await verifyRecoverableExport(JSON.parse(JSON.stringify(file)), snap)).ok, true);
  assert.equal((await verifyRecoverableExport({ app: "x" }, snap)).ok, false);
  const tampered = JSON.parse(JSON.stringify(file)); tampered.snapshot.bills = [];
  assert.match((await verifyRecoverableExport(tampered, snap)).error, /damaged/);
  assert.match((await verifyRecoverableExport(file, { ...snap, txns: [] })).error, /different data/);
});

test("a backup records what Arth's own restore would drop, so the status never over-promises recoverability", async () => {
  const { createSafetyBackup } = await import("./safetyBackup.js");
  const { createMemoryStorage } = await import("./testing/sim.js");
  const { backupText } = await import("./statusText.js");
  const store = createMemoryStorage();
  const snap = { txns: [{ id: "s1" }, { id: "s1dup" }, { id: "t2" }], bills: [{ id: "b" }] };
  const dedupe = list => list.filter(t => t.id !== "s1dup");                     // stands in for dedupeSettlementTxns
  const r = await createSafetyBackup(store, { reason: "t", snapshot: snap, genId: () => "g", normalizers: { txns: dedupe } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.restoreDrops, [{ key: "txns", count: 1 }]);
  assert.match(backupText({ at: "2026-10-15T06:00:00Z", txnCount: 3, restoreDrops: r.restoreDrops }), /would drop 1 record/);
  assert.doesNotMatch(backupText({ at: "2026-10-15T06:00:00Z", txnCount: 3 }), /would drop/);
});

test("a manual restore backs up BOTH this device and the cloud copy first, then the restored data replaces the cloud; nothing is lost", async () => {
  const kit = S.makeKit("new"); kit.seed(0);
  const A = kit.mk("A"), B = kit.mk("B"); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  const oldSnapshot = { ...JSON.parse(JSON.stringify(A.data())) };                 // the "backup" being restored: base data only
  const x = A.addTxn("x"); await A.settle(1500);                                    // x exists on A and in the cloud
  assert.ok(cloudIds(kit).includes(x));
  await B.engine.onVisible(); await B.settle(500); assert.ok(B.ids().includes(x), "B has x too");
  const r = await A.restoreFrom(oldSnapshot); assert.equal(r.ok, true);
  await A.settle(2000);
  const reasons = listSafetyBackups(A.storage).map(b => b.reason).sort();
  assert.deepEqual(reasons, ["before-restore", "cloud-before-restore"]);
  assert.ok(stored(A).every(b => b.snapshot.txns.some(t => t.id === x)), "both backups hold the transaction that the restore removes");
  assert.ok(!cloudIds(kit).includes(x), "the restored (older) data replaced the cloud copy, deliberately");
  await B.engine.onVisible(); await B.settle(500);                                  // B adopts it, with its own backup first
  assert.ok(B.status().kind === "synced" && !B.ids().includes(x));
  assert.ok(stored(B).some(b => b.reason === "before-fast-forward" && b.snapshot.txns.some(t => t.id === x)), "B's copy with x is backed up before it is replaced");
  assert.deepEqual(lostIds([A, B], kit.cloud), []);
});

test("a restore is refused, with nothing replaced, when the cloud copy cannot be backed up or no backup can be stored", async () => {
  const kit = S.makeKit("new"); kit.seed(0);
  const A = kit.mk("A"); await A.start(); await A.settle(100);
  const old = JSON.parse(JSON.stringify(A.data())); A.addTxn("x"); await A.settle(1500);
  const before = A.ids();
  kit.cloud.faults.offlineDevices.add("A");                                         // cannot read the cloud copy to back it up
  const r1 = await A.restoreFrom(old);
  assert.equal(r1.ok, false); assert.match(r1.error, /cloud copy could not be read/); assert.deepEqual(A.ids(), before);
  kit.cloud.faults.offlineDevices.delete("A");
  A.storage.failKeys.add(SAFETY_BACKUPS_KEY);                                       // storage cannot hold a backup, no file option
  const r2 = await A.restoreFrom(old);
  assert.equal(r2.ok, false); assert.deepEqual(A.ids(), before);
});

test("the engine re-checks a file backup's checksum itself: a UI that reports success for the wrong data is not trusted", async () => {
  const kit = S.makeKit("new", {}, { requestExternalBackup: async () => ({ ok: true, digest: "0".repeat(64), txnCount: 3 }) });
  const A = kit.mk("A"), B = kit.mk("B"); kit.seed(0); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  const bId = B.addTxn("b"); await B.settle(1500);
  A.storage.failKeys.add(SAFETY_BACKUPS_KEY);
  const before = A.ids();
  await A.engine.onVisible(); await A.settle(500);
  assert.equal(A.status().kind, "blocked-backup");
  assert.deepEqual(A.ids(), before, "nothing replaced");
  assert.ok(!A.ids().includes(bId));
});
