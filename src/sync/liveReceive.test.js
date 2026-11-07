import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "./scenarios.js";
import { listSafetyBackups } from "./safetyBackup.js";
import { createDevice, createMemoryStorage } from "./testing/sim.js";

test("another device saved: a clean device receives it on the next look, after a verified backup, without the person doing anything", async () => {
  const kit = S.makeKit("new"); const { A, B, bId } = await S.cleanDeviceFastForwards(kit);
  assert.ok(!A.ids().includes(bId), "A has not looked yet");
  const out = await A.poll(); await A.settle(500);
  assert.equal(out.outcome, "pulled");
  assert.ok(A.ids().includes(bId), "B's transaction arrived on A");
  assert.ok(listSafetyBackups(A.storage).some(b => b.reason === "before-fast-forward"), "A's previous data was backed up first");
  assert.equal(A.status().kind, "synced");
});

test("nothing changed in the cloud: a look is only a version-stamp check and runs no sync", async () => {
  const kit = S.makeKit("new"); kit.seed(0); const A = kit.mk("A"); await A.start(); await A.settle(100);
  const writes = kit.cloud.log.length;
  assert.equal((await A.poll()).outcome, "unchanged");
  assert.equal((await A.poll()).outcome, "unchanged");
  assert.equal(kit.cloud.log.length, writes);
  assert.equal(listSafetyBackups(A.storage).length, 0);
});

test("a device's own save is not mistaken for someone else's", async () => {
  const kit = S.makeKit("new"); kit.seed(0); const A = kit.mk("A"); await A.start(); await A.settle(100);
  const id = A.addTxn("mine"); await A.settle(1500);
  assert.equal((await A.poll()).outcome, "unchanged");
  assert.ok(A.ids().includes(id));
});

test("both devices changed: the look never replaces anything; it raises the conflict and keeps this device's own change", async () => {
  const kit = S.makeKit("new"); kit.seed(0);
  let aOnline = true;                                            // A's own view of its connection (the app's navigator.onLine)
  const stA = createMemoryStorage({ arth_data: JSON.stringify(S.baseData()) });
  const A = createDevice({ name: "A", clock: kit.clock, cloud: kit.cloud, storage: stA, engineOpts: { isOnline: () => aOnline } });
  const B = kit.mk("B"); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  aOnline = false;                                               // A edits while offline
  const aId = A.addTxn("a-offline"); await A.settle(2000);
  const bId = B.addTxn("b"); await B.settle(1500);               // B saves
  aOnline = true;
  const out = await A.poll(); await A.settle(500);
  assert.equal(out.outcome, "conflict");
  assert.ok(A.ids().includes(aId), "A's own change is still there");
  assert.ok(!A.ids().includes(bId), "B's change was not merged in silently");
  assert.equal(A.status().kind, "conflict");
  assert.equal((await A.poll()).outcome, "skipped", "while a conflict waits, looking does nothing");
});

test("a failed look is not a failed sync: offline or an error leaves the status alone", async () => {
  const kit = S.makeKit("new"); kit.seed(0); const A = kit.mk("A"); await A.start(); await A.settle(100);
  const before = A.status();
  kit.cloud.faults.offlineDevices.add("A");
  assert.equal((await A.poll()).outcome, "skipped");
  assert.deepEqual(A.status(), before);
});

test("a stopped engine does not look", async () => {
  const kit = S.makeKit("new"); kit.seed(0); const A = kit.mk("A"); await A.start(); await A.settle(100);
  A.engine.stop();
  assert.equal((await A.poll()).outcome, "skipped");
});

test("a device that has never agreed with the cloud does not look (the opening sync decides first)", async () => {
  const kit = S.makeKit("new"); const A = kit.mk("A");
  A.start();                                  // not awaited: engine exists but has not agreed yet
  const out = await A.poll();
  assert.ok(["skipped", "unchanged"].includes(out.outcome));
});
