import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "./scenarios.js";
import { lostIds } from "./testing/sim.js";
import { statusText } from "./statusText.js";

const lost = (r, kit) => lostIds(r.devices, kit.cloud);
const cloudIds = (kit) => (kit.cloud.rows.get(S.USER)?.snapshot.txns || []).map(t => t.id);

// ── negative controls: the legacy model reproduces each documented loss, so these scenarios do catch the bug ──
test("legacy model: P5a reject then reload loses the transaction (control)", async () => {
  const kit = S.makeKit("legacy"); const r = await S.rejectThenReload(kit);
  assert.deepEqual(lost(r, kit), [r.id]);
});
test("legacy model: P5c close inside the push delay, cloud written 10 s ago, loses it (control)", async () => {
  const kit = S.makeKit("legacy"); const r = await S.closeInsideDebounce(kit, 10_000);
  assert.deepEqual(lost(r, kit), [r.id]);
});
test("legacy model: L1 stale cloud, edit, one Sync Now tap loses it (control)", async () => {
  const kit = S.makeKit("legacy"); const r = await S.staleCloudEditThenSyncNow(kit);
  assert.deepEqual(lost(r, kit), [r.id]);
});
test("legacy model: P3/P4 divergent devices, A's push 10 s old, loses B's transaction (control)", async () => {
  const kit = S.makeKit("legacy"); const r = await S.divergentDevices(kit, 10_000);
  assert.deepEqual(lost(r, kit), [r.bId]);
});

// ── the new engine ──
test("P5a reject then reload: nothing is lost and the change reaches the cloud once the server recovers", async () => {
  const kit = S.makeKit("new"); const r = await S.rejectThenReload(kit);
  assert.deepEqual(lost(r, kit), []);
  assert.ok(r.devices[0].ids().includes(r.id), "still on the device after the reload");
  kit.cloud.faults.rejectNext = 0;
  await r.devices[0].settle(400_000);
  assert.ok(cloudIds(kit).includes(r.id), "retry delivered it");
  assert.equal(r.devices[0].status().kind, "synced");
});

for (const [label, age] of [["10 s", 10_000], ["10 min", 600_000], ["a cloud stamp in the future", -3_600_000]]) {
  test(`P5c close inside the push delay (cloud written ${label} ago): nothing lost, delivered on reopen`, async () => {
    const kit = S.makeKit("new"); const r = await S.closeInsideDebounce(kit, age);
    assert.deepEqual(lost(r, kit), []);
    assert.ok(cloudIds(kit).includes(r.id));
  });
}

test("L1 stale cloud copy: the edit syncs automatically and one Sync Now tap changes nothing", async () => {
  const kit = S.makeKit("new"); const r = await S.staleCloudEditThenSyncNow(kit);
  assert.deepEqual(lost(r, kit), []);
  assert.ok(cloudIds(kit).includes(r.id));
  assert.ok(r.devices[0].ids().includes(r.id));
});

for (const [label, age] of [["10 s", 10_000], ["10 min", 600_000]]) {
  test(`P3/P4 divergent devices (A's push ${label} old): conflict is recorded, nothing replaced, nothing lost`, async () => {
    const kit = S.makeKit("new"); const r = await S.divergentDevices(kit, age);
    assert.deepEqual(lost(r, kit), []);
    assert.equal(r.B.status().kind, "conflict");
    assert.deepEqual(r.B.state().conflict.diff.onlyLocal, [r.bId]);
    assert.deepEqual(r.B.state().conflict.diff.onlyCloud, [r.aId]);
    assert.ok(r.B.ids().includes(r.bId), "B keeps its own transaction");
    assert.ok(!cloudIds(kit).includes(r.bId), "B did not overwrite the cloud");
    assert.ok(cloudIds(kit).includes(r.aId), "A's push is intact");
  });
}

test("divergent live device: a stale write is refused (compare-and-swap), not applied", async () => {
  const kit = S.makeKit("new"); const r = await S.divergentLiveDevice(kit);
  assert.deepEqual(lost(r, kit), []);
  assert.equal(r.B.status().kind, "conflict");
  assert.ok(cloudIds(kit).includes(r.aId) && !cloudIds(kit).includes(r.bId));
});

test("P5b lost reply: after reopening, the write is recognised as landed, not repeated, and the device is in sync", async () => {
  const kit = S.makeKit("new"); const r = await S.lostReplyThenReload(kit);
  const A = r.devices[0];
  assert.deepEqual(lost(r, kit), []);
  assert.equal(kit.cloud.log.filter(l => l.outcome === "applied").length, r.writesBefore, "no second write");
  assert.equal(A.state().pendingWrite, null);
  assert.equal(A.status().kind, "synced");
  assert.ok(cloudIds(kit).includes(r.id));
});

test("status text never claims a save or backup that was not verified", () => {
  const unverified = ["pending", "failed", "conflict", "blocked-backup", "paused-token", "paused-reconcile", "syncing", "sent", "idle"];
  for (const kind of unverified) {
    const t = statusText({ kind, error: "x", nextRetryAt: "2026-10-15T06:00:00Z", diff: { onlyLocal: ["a"], onlyCloud: [] } });
    const all = `${t.headline} ${t.detail}`.toLowerCase();
    assert.ok(!/every change saves/.test(all), kind);
    assert.ok(!/saved to backup/.test(all), kind);
    assert.ok(!/verified/.test(all) || kind === "blocked-backup" || kind === "sent" || kind === "paused-token", `${kind}: ${all}`);
  }
  assert.match(statusText({ kind: "synced", verifiedAt: "2026-10-15T06:00:00Z" }).detail, /verified/);
});

import { listSafetyBackups, backedUpTxnIds } from "./safetyBackup.js";
import { advanceToken } from "./syncEngine.js";

test("lost reply followed by more edits: our own write is recognised, no false conflict, everything delivered", async () => {
  const kit = S.makeKit("new"); const r = await S.lostReplyThenMoreEdits(kit);
  assert.equal(r.A.state().conflict, null);
  assert.equal(r.A.status().kind, "synced");
  assert.deepEqual(lost(r, kit), []);
  assert.ok(cloudIds(kit).includes(r.x) && cloudIds(kit).includes(r.y));
});

test("stale base while both devices are live: the compare-and-swap refuses B's write; A's data is intact", async () => {
  const kit = S.makeKit("new"); const r = await S.staleBaseLiveWrite(kit);
  assert.deepEqual(lost(r, kit), []);
  assert.ok(cloudIds(kit).includes(r.aId) && !cloudIds(kit).includes(r.bId), "B did not overwrite A");
  assert.equal(r.B.status().kind, "conflict");
});

test("a clean device that adopts the cloud copy first makes a verified backup of what it replaces", async () => {
  const kit = S.makeKit("new"); const r = await S.cleanDeviceFastForwards(kit);
  await r.A.engine.onVisible(); await r.A.settle(500);
  assert.ok(r.A.ids().includes(r.bId), "A adopted B's change");
  const bk = listSafetyBackups(r.A.storage);
  assert.equal(bk.length, 1);
  assert.equal(bk[0].reason, "before-fast-forward");
  assert.equal(bk[0].txnCount, 3, "backup holds what A had before");
  assert.equal(r.A.status().kind, "synced");
});

test("if the backup cannot be written, nothing is replaced and the status says so; it succeeds once storage allows", async () => {
  const kit = S.makeKit("new"); const r = await S.cleanDeviceFastForwards(kit);
  const used = [...r.A.storage.raw.values()].reduce((n, v) => n + v.length, 0);
  r.A.storage.limit.bytes = used + 50;                       // no room for a backup
  const before = r.A.ids();
  await r.A.engine.onVisible(); await r.A.settle(200);
  assert.equal(r.A.status().kind, "blocked-backup");
  assert.deepEqual(r.A.ids(), before, "device data untouched");
  r.A.storage.limit.bytes = Infinity;
  await r.A.engine.syncNow(); await r.A.settle(200);
  assert.ok(r.A.ids().includes(r.bId));
  assert.equal(listSafetyBackups(r.A.storage).length, 1);
});

test("a backup that does not read back identically is not accepted", async () => {
  const { createSafetyBackup } = await import("./safetyBackup.js");
  const store = new Map();
  const corrupting = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v.replace(/"txns":\[[^\]]*\]/, '"txns":[]')) };
  const snap = { txns: [{ id: 1 }, { id: 2 }], accounts: [] };
  const res = await createSafetyBackup(corrupting, { reason: "t", snapshot: snap, genId: () => "x" });
  assert.equal(res.ok, false);
});

test("conflict: choices never merge, the replaced side is backed up first, conflict survives a reload and blocks pushes", async () => {
  // persists across reload and blocks pushes
  let kit = S.makeKit("new"); let r = await S.divergentDevices(kit, 600_000);
  const writes = kit.cloud.log.filter(l => l.outcome === "applied").length;
  const b2 = r.B.addTxn("b2"); await r.B.settle(5000);
  assert.equal(kit.cloud.log.filter(l => l.outcome === "applied").length, writes, "no push while a conflict is pending");
  await r.B.reload(); await r.B.settle(2000);
  assert.equal(r.B.status().kind, "conflict");
  assert.equal((await r.B.engine.syncNow()).outcome, "conflict", "Sync Now does not force anything");
  assert.equal((await r.B.engine.resolveConflict("later")).outcome, "conflict");
  assert.ok(r.B.ids().includes(b2));

  // keep this device: cloud (with A's transaction) is backed up first, then replaced
  kit = S.makeKit("new"); r = await S.divergentDevices(kit, 10_000);
  assert.equal((await r.B.engine.resolveConflict("keep-local")).outcome, "resolved-keep-local");
  assert.ok(cloudIds(kit).includes(r.bId));
  assert.ok(backedUpTxnIds(r.B.storage).has(r.aId), "A's transaction is recoverable from B's backup");
  assert.deepEqual(lost(r, kit), []);
  assert.equal(r.B.state().conflict, null);
  await r.A.engine.onVisible(); await r.A.settle(500);          // A, clean, now adopts the result (with its own verified backup)
  assert.ok(r.A.ids().includes(r.bId));

  // use the cloud copy: this device is backed up first, then replaced
  kit = S.makeKit("new"); r = await S.divergentDevices(kit, 10_000);
  assert.equal((await r.B.engine.resolveConflict("use-cloud")).outcome, "resolved-use-cloud");
  assert.ok(r.B.ids().includes(r.aId) && !r.B.ids().includes(r.bId));
  assert.ok(backedUpTxnIds(r.B.storage).has(r.bId), "B's own transaction is recoverable from its backup");
  assert.deepEqual(lost(r, kit), []);
});

test("an unreliable concurrency token (rounded to whole seconds) pauses sync instead of risking an overwrite", async () => {
  const kit = S.makeKit("new", { tokenPrecisionMs: 1000 }, { debounceMs: 100 });
  const A = kit.mk("A"); kit.seed(0); await A.start(); await A.settle(50);
  const id = A.addTxn("x"); await A.settle(500);
  assert.equal(A.status().kind, "paused-token");
  const writes = kit.cloud.log.filter(l => l.outcome === "applied").length;
  A.addTxn("y"); await A.settle(5000);
  assert.equal(kit.cloud.log.filter(l => l.outcome === "applied").length, writes, "no further writes while paused");
  assert.ok(A.ids().includes(id), "local data is safe");
});

test("reconciliation: a cloud copy that differs from what was sent is detected and sync pauses (not reported as synced)", async () => {
  const kit = S.makeKit("new", { echoMeta: false });
  const A = kit.mk("A"); kit.seed(0); await A.start(); await A.settle(100);
  kit.cloud.faults.corruptNext = true;
  A.addTxn("x"); await A.settle(1500);
  assert.equal(A.status().kind, "paused-reconcile");
  assert.notEqual(A.state().lastReconcile.ok, true);
  assert.ok(A.ids().length === 4, "local data intact");
});

test("without an echoed write record the status says 'sent', and a full read-back runs at most every 10 minutes", async () => {
  const kit = S.makeKit("new", { echoMeta: false });
  const A = kit.mk("A"); kit.seed(0); await A.start(); await A.settle(100);
  A.addTxn("x"); await A.settle(1500);
  assert.equal(A.status().kind, "synced", "first push is read back");
  A.addTxn("y"); await A.settle(1500);
  assert.equal(A.status().kind, "sent", "within 10 minutes: accepted but not read back");
  await A.engine.syncNow(); await A.settle(100);
  assert.equal(A.status().kind, "synced", "a manual sync verifies");
});

test("retry backs off 2s, 5s, 15s, 60s, then every 5 min; delivers when the cloud returns; reconnecting retries at once", async () => {
  const seen = [];
  const kit = S.makeKit("new", {}, { onStatus: s => { if (s.nextRetryAt) seen.push(Date.parse(s.nextRetryAt)); } });
  const A = kit.mk("A"); kit.seed(0); await A.start(); await A.settle(100);
  kit.cloud.faults.offlineDevices.add("A");
  const t0 = kit.clock.now(); const id = A.addTxn("x"); await A.settle(900 + 2000 + 5000 + 15000 + 60000 + 300000 + 300000);
  const gaps = seen.slice(1).map((v, i) => v - seen[i]);
  assert.deepEqual(gaps.slice(0, 5), [5000, 15000, 60000, 300000, 300000]);
  assert.equal(A.status().kind, "pending");
  assert.ok(A.ids().includes(id) && t0 > 0);
  kit.cloud.faults.offlineDevices.delete("A");
  await A.engine.onOnline(); await A.settle(100);
  assert.ok(cloudIds(kit).includes(id));
  assert.equal(A.status().kind, "synced");
});

test("tokens strictly advance, even when the clock is behind or equal", () => {
  assert.equal(advanceToken("2026-10-15T06:00:00.000Z", Date.parse("2026-10-15T05:00:00.000Z")), "2026-10-15T06:00:00.001Z");
  assert.equal(advanceToken("2026-10-15T06:00:00.000Z", Date.parse("2026-10-15T06:00:00.000Z")), "2026-10-15T06:00:00.001Z");
  assert.equal(advanceToken("2026-10-15T06:00:00.000Z", Date.parse("2026-10-15T07:00:00.000Z")), "2026-10-15T07:00:00.000Z");
  assert.equal(advanceToken(null, 5), new Date(5).toISOString());
});
