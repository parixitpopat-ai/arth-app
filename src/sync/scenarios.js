// src/sync/scenarios.js — the reproduced failure cases from SYNC-SAFETY-001, as deterministic scenarios.
// Each takes a world and a device factory so it can run against the NEW engine (must lose nothing) and
// against the LEGACY reference model (negative control: must lose, proving the scenario catches the bug).

import { createClock, createFakeCloud, createDevice, createMemoryStorage } from "./testing/sim.js";
import { createLegacyDevice } from "./testing/legacy.js";

export const USER = "synthetic-user-0001";
const BASE_TXNS = [1, 2, 3].map(n => ({ id: `base-${n}`, type: "expense", desc: `Base ${n}`, amount: 100 * n, date: "2026-10-01", catId: "food", catIds: ["food"], accId: "syn_bank", people: {} }));
export const baseData = () => ({ txns: BASE_TXNS.map(t => ({ ...t })), accounts: [{ id: "syn_bank", name: "SYN Bank", type: "bank", balance: 100000 }], bills: [], people: [], planNudges: {} });
const baseSnapshot = () => ({ version: 1, ...baseData() });
export const richData = () => ({ ...baseData(), bills: [{ id: "bill1", paidByTxnId: "base-1" }], contributions: [{ id: "c1", obligationType: "bill", obligationId: "bill1", txnId: "base-1" }], membershipRelationships: [{ id: "r1", billerAccountId: "ba1" }], billerAccounts: [{ id: "ba1" }], feeSchedules: [{ id: "s1" }], feePeriods: [{ id: "p1", scheduleId: "s1" }], planNudges: { "2026-11": { status: "dismissed" } } });

export function makeKit(kind, cloudOpts = {}, engineOpts = {}) {
  const clock = createClock(); const cloud = createFakeCloud({ clock, ...cloudOpts });
  const mk = (name, storage = createMemoryStorage()) => {
    if (!storage.getItem("arth_data")) storage.setItem("arth_data", JSON.stringify(baseData()));
    return (kind === "legacy" ? createLegacyDevice : createDevice)({ name, clock, cloud, storage, ...(kind === "legacy" ? {} : { engineOpts }) });
  };
  return { kind, clock, cloud, mk, seed: (ageMs = 0) => cloud.seed(USER, baseSnapshot(), ageMs) };
}

/** P5a: the server rejects the write; the person then reloads within a minute. */
export async function rejectThenReload(kit) {
  const A = kit.mk("A"); kit.seed(0); await A.start(); await A.settle(100);
  kit.cloud.faults.rejectNext = 3;
  const id = A.addTxn("x"); await A.settle(1500);
  await A.reload(); await A.settle(3000);
  return { devices: [A], id };
}

/** P5c: the app is closed inside the 900 ms push delay and reopened. */
export async function closeInsideDebounce(kit, cloudAgeMs) {
  const A = kit.mk("A"); kit.seed(cloudAgeMs); await A.start(); await A.settle(100);
  const id = A.addTxn("x");
  await A.reload(); await A.settle(2000);
  return { devices: [A], id };
}

/** L1: the cloud copy is older than a minute; an edit is made, then Sync Now is tapped once. */
export async function staleCloudEditThenSyncNow(kit) {
  const A = kit.mk("A"); kit.seed(10 * 60 * 1000); await A.start(); await A.settle(100);
  const id = A.addTxn("x"); await A.settle(3000);
  if (A.engine.syncNow) await A.engine.syncNow(); else await A.syncNow();
  await A.settle(1000);
  return { devices: [A], id };
}

/** P3/P4: device B creates a transaction while offline; device A pushes its own meanwhile; B comes back `ageMs` later. */
export async function divergentDevices(kit, ageMs) {
  kit.seed(0);
  const A = kit.mk("A"), B = kit.mk("B"); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  kit.cloud.faults.offlineDevices.add("B");
  const bId = B.addTxn("b"); await B.settle(1500);
  const aId = A.addTxn("a"); await A.settle(1500);
  await kit.clock.advance(ageMs);
  kit.cloud.faults.offlineDevices.delete("B");
  await B.reload(); await B.settle(2000);
  return { devices: [A, B], A, B, aId, bId };
}

/** Same divergence, but B stays open (no reload): its retry or next edit meets a cloud that moved on. */
export async function divergentLiveDevice(kit) {
  kit.seed(0);
  const A = kit.mk("A"), B = kit.mk("B"); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  kit.cloud.faults.offlineDevices.add("B");
  const bId = B.addTxn("b"); await B.settle(1500);
  const aId = A.addTxn("a"); await A.settle(1500);
  kit.cloud.faults.offlineDevices.delete("B");
  await B.settle(10000);
  return { devices: [A, B], A, B, aId, bId };
}

/** P5b: the write is applied but the reply is lost; the app is reopened. */
export async function lostReplyThenReload(kit) {
  const A = kit.mk("A"); kit.seed(0); await A.start(); await A.settle(100);
  kit.cloud.faults.dropReplyNext = 1;
  const id = A.addTxn("x"); await A.settle(1500);
  const writesBefore = kit.cloud.log.filter(l => l.outcome === "applied").length;
  await A.reload(); await A.settle(2000);
  return { devices: [A], id, writesBefore };
}

/** A reply is lost, then the person keeps editing before the retry: our own earlier write must not look like someone else's. */
export async function lostReplyThenMoreEdits(kit) {
  const A = kit.mk("A"); kit.seed(0); await A.start(); await A.settle(100);
  kit.cloud.faults.dropReplyNext = 1;
  const x = A.addTxn("x"); await A.settle(1000);
  const y = A.addTxn("y"); await A.settle(3000);
  return { devices: [A], A, x, y };
}

/** Both devices online; A writes; B (still holding the old version) edits: B's write must be refused, not applied. */
export async function staleBaseLiveWrite(kit) {
  kit.seed(0);
  const A = kit.mk("A"), B = kit.mk("B"); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  const aId = A.addTxn("a"); await A.settle(1500);
  const bId = B.addTxn("b"); await B.settle(1500);
  return { devices: [A, B], A, B, aId, bId };
}

/** A is clean; B writes; A learns of it and must adopt the cloud copy only after a verified backup of what it replaces. */
export async function cleanDeviceFastForwards(kit) {
  kit.seed(0);
  const A = kit.mk("A"), B = kit.mk("B"); await A.start(); await B.start(); await A.settle(100); await B.settle(100);
  const bId = B.addTxn("b"); await B.settle(1500);
  return { devices: [A, B], A, B, bId };
}

/** Divergence where the device keeps editing while "Decide later" is in force, and the other device pushes again. */
export async function decideLaterWhileBothMove(kit) {
  const r = await divergentDevices(kit, 10_000);
  const { A, B } = r;
  const cloudAtConflict = (kit.cloud.rows.get(USER)?.snapshot.txns || []).map(t => t.id);
  const bLater = B.addTxn("b-after-conflict"); await B.settle(3000);
  const aLater = A.addTxn("a-after-conflict"); await A.settle(3000);   // A keeps syncing and moves the cloud copy on
  await B.engine.resolveConflict("later");
  return { ...r, bLater, aLater, cloudAtConflict };
}
