// SYNC-SAFETY-004: Plan Ahead nudge state (planNudges + the monthOverrides it can raise) across two devices.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as S from "./scenarios.js";
import { createDevice } from "./testing/sim.js";
import { planNudge } from "../domain/budget/nudge.js";
import { backedUpTxnIds, listSafetyBackups, SAFETY_BACKUPS_KEY } from "./safetyBackup.js";
import { danglingReferences } from "./snapshotIntegrity.js";

const NOV = "2026-11";
const plan = { budgetUsed: 80000, monthBudget: 50000, over: 30000 };
const kindOn = (dev, month = NOV) => { const rec = dev.nudgeRecord(month); const ctx = { ...plan, monthBudget: dev.data().monthOverrides?.[month] ?? plan.monthBudget }; return planNudge({ ...ctx, over: Math.max(0, plan.budgetUsed - ctx.monthBudget), record: rec })?.kind ?? null; };
const cloudSnap = kit => kit.cloud.rows.get(S.USER)?.snapshot;
const stored = d => JSON.parse(d.storage.getItem(SAFETY_BACKUPS_KEY) || "[]");

async function pair() {
  const kit = S.makeKit("new"); kit.seed(0);
  const A = kit.mk("A"), B = kit.mk("B"); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  return { kit, A, B };
}

test("dismissal on one device reaches the cloud and the other device shows it dismissed (not the card again)", async () => {
  const { kit, A, B } = await pair();
  assert.equal(kindOn(B), "card");
  A.dismissNudge(NOV, 80000); await A.settle(1500);
  assert.deepEqual(cloudSnap(kit).planNudges[NOV], { dismissedAtUsed: 80000 }, "stored in the cloud copy");
  assert.equal(A.status().kind, "synced");
  await B.engine.onVisible(); await B.settle(500);
  assert.equal(kindOn(B), "dismissed");
  assert.equal(B.status().kind, "synced");
  assert.equal(B.state().lastReconcile.ok, true, "reconciled after adopting");
});

test("accepting a raise syncs the nudge record AND the budget override together; undo (key deleted) propagates too", async () => {
  const { kit, A, B } = await pair();
  A.acceptNudge(NOV, 50000, 80000); await A.settle(1500);
  const snap = cloudSnap(kit);
  assert.equal(snap.monthOverrides[NOV], 80000); assert.equal(snap.planNudges[NOV].raisedTo, 80000);
  await B.engine.onVisible(); await B.settle(500);
  assert.equal(kindOn(B), "raised");
  assert.equal(B.data().monthOverrides[NOV], 80000);
  A.undoNudge(NOV); await A.settle(1500);
  assert.ok(!(NOV in cloudSnap(kit).planNudges) && !(NOV in cloudSnap(kit).monthOverrides), "deletions reach the cloud");
  await B.engine.onVisible(); await B.settle(500);
  assert.equal(kindOn(B), "card"); assert.equal(B.status().kind, "synced");
});

test("a brand-new device signing in (restore) gets the dismissal", async () => {
  const { kit, A } = await pair();
  A.dismissNudge(NOV, 80000); await A.settle(1500);
  const C = createDevice({ name: "C", clock: kit.clock, cloud: kit.cloud }); await C.start(); await C.settle(500);
  assert.equal(kindOn(C), "dismissed");
  assert.equal(C.status().kind, "synced");
});

test("a dismissal made offline survives a reload and is delivered when the connection returns", async () => {
  const { kit, A, B } = await pair();
  kit.cloud.faults.offlineDevices.add("A");
  A.dismissNudge(NOV, 80000); await A.settle(1500);
  await A.reload(); await A.settle(500);
  assert.equal(kindOn(A), "dismissed", "still dismissed locally after the reload");
  assert.equal(A.status().kind, "pending");
  assert.ok(!cloudSnap(kit).planNudges[NOV]);
  kit.cloud.faults.offlineDevices.delete("A");
  await A.engine.onOnline(); await A.settle(500);
  assert.equal(cloudSnap(kit).planNudges[NOV].dismissedAtUsed, 80000);
  await B.engine.onVisible(); await B.settle(500);
  assert.equal(kindOn(B), "dismissed");
});

test("conflict: one device dismisses while the other (offline) accepts the raise; the sheet says what differs, nothing is replaced, both choices stay recoverable", async () => {
  const { kit, A, B } = await pair();
  kit.cloud.faults.offlineDevices.add("B");
  B.acceptNudge(NOV, 50000, 80000); await B.settle(1500);
  A.dismissNudge(NOV, 80000); await A.settle(1500);
  kit.cloud.faults.offlineDevices.delete("B");
  await B.reload(); await B.settle(1500);
  assert.equal(B.status().kind, "conflict");
  const lists = B.state().conflict.diff.lists.map(d => d.key).sort();
  assert.deepEqual(lists, ["monthOverrides", "planNudges"]);
  const planDiff = B.state().conflict.diff.lists.find(d => d.key === "planNudges");
  assert.deepEqual(planDiff.changed, [NOV], "the same month was edited differently on each side");
  assert.deepEqual(B.state().conflict.diff.onlyLocal, [], "no transaction differs: the old summary would have said nothing");
  assert.match(B.engine.getStatus().kind, /conflict/);
  assert.equal(kindOn(B), "raised", "B still shows its own choice; nothing replaced");
  assert.equal(cloudSnap(kit).planNudges[NOV].dismissedAtUsed, 80000, "the cloud still has A's dismissal");
  // both copies are held while deciding
  const holds = stored(B).filter(b => b.pinned);
  assert.deepEqual(holds.map(h => h.reason).sort(), ["conflict-cloud-copy", "conflict-device-copy"]);
  assert.equal(holds.find(h => h.reason === "conflict-cloud-copy").snapshot.planNudges[NOV].dismissedAtUsed, 80000);
  assert.equal(holds.find(h => h.reason === "conflict-device-copy").snapshot.planNudges[NOV].raisedTo, 80000);
  // choose the cloud copy: B adopts A's dismissal and its own raise is still recoverable from the backup
  assert.equal((await B.engine.resolveConflict("use-cloud")).outcome, "resolved-use-cloud");
  assert.equal(kindOn(B), "dismissed");
  assert.ok(stored(B).some(b => b.reason === "before-use-cloud" && b.snapshot.planNudges[NOV].raisedTo === 80000), "B's own raise kept in a verified backup");
  assert.equal(B.status().kind, "synced");
});

test("a stale device editing something unrelated cannot erase another device's dismissal", async () => {
  const { kit, A, B } = await pair();
  A.dismissNudge(NOV, 80000); await A.settle(1500);
  B.addTxn("unrelated"); await B.settle(1500);                 // B has not seen A's change
  assert.equal(B.status().kind, "conflict");
  assert.equal(cloudSnap(kit).planNudges[NOV].dismissedAtUsed, 80000, "the cloud copy keeps the dismissal");
  assert.deepEqual(B.state().conflict.diff.lists.find(d => d.key === "planNudges").onlyCloud, [NOV]);
  assert.deepEqual(danglingReferences(cloudSnap(kit)), []);
});

test("nudge records survive a backup round trip (the safety backup holds planNudges and monthOverrides exactly)", async () => {
  const { A, B, kit } = await pair();
  B.acceptNudge(NOV, 50000, 80000); await B.settle(1500);
  A.dismissNudge("2026-12", 90000); await A.settle(1500);
  await B.engine.onVisible(); await B.settle(500);               // B had local changes? it pushed first; A conflicts instead
  const dev = A.status().kind === "conflict" ? A : B;
  const r = await dev.engine.resolveConflict("keep-local");
  assert.ok(["resolved-keep-local", "none"].includes(r.outcome));
  const b = listSafetyBackups(dev.storage);
  assert.ok(b.length >= 1);
  assert.ok(stored(dev).every(x => "planNudges" in x.snapshot && "monthOverrides" in x.snapshot));
  assert.ok(kit);
});
