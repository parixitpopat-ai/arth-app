// SYNC-SAFETY-004: two-tab races, deterministic.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createTabOwnership, watchForeignWrites, DATA_KEYS, isDataKey, LEASE_KEY, OWNER_LOCK_NAME } from "./tabOwnership.js";
import { createFakeLocks, createStorageBus } from "./testing/tabs.js";
import { createClock, createMemoryStorage, createFakeCloud, createDevice, lostIds } from "./testing/sim.js";
import * as S from "./scenarios.js";

const tick = () => new Promise(r => setTimeout(r, 0));
function tab(locks, id, extra = {}) { const states = []; const o = createTabOwnership({ locks: locks ? locks.forTab(id) : null, tabId: id, onChange: s => states.push(s), ...extra }); return { id, o, states, last: () => states[states.length - 1] }; }

test("Web Locks: the first tab owns; a second tab waits and mounts nothing; when the owner closes the waiter takes over, in order", async () => {
  const locks = createFakeLocks();
  const A = tab(locks, "A"), B = tab(locks, "B"), C = tab(locks, "C");
  A.o.start(); await tick(); B.o.start(); C.o.start(); await tick();
  assert.deepEqual([A.last(), B.last(), C.last()], ["owner", undefined, undefined]);
  assert.equal(B.o.getState(), "waiting"); assert.equal(locks.holderOf(OWNER_LOCK_NAME), "A");
  locks.closeTab("A"); A.o.stop(); await tick();
  assert.equal(B.o.getState(), "owner", "first in the queue"); assert.equal(C.o.getState(), "waiting");
  locks.closeTab("B"); await tick();
  assert.equal(C.o.getState(), "owner");
});

test("Web Locks: 'Use this tab' takes over explicitly; the old owner is told it lost; it can take back", async () => {
  const locks = createFakeLocks();
  const A = tab(locks, "A"), B = tab(locks, "B");
  A.o.start(); await tick(); B.o.start(); await tick();
  B.o.takeOver(); await tick();
  assert.equal(B.o.getState(), "owner"); assert.equal(A.o.getState(), "lost");
  A.o.takeOver(); await tick();
  assert.equal(A.o.getState(), "owner"); assert.equal(B.o.getState(), "lost");
});

test("never two owners at once, whatever the interleaving of starts, closes and takeovers", async () => {
  const locks = createFakeLocks();
  const tabs = ["A", "B", "C", "D"].map(id => tab(locks, id));
  const open = new Set(tabs.map(t => t.id));
  const owners = () => tabs.filter(t => open.has(t.id) && t.o.getState() === "owner").length;
  tabs[0].o.start(); tabs[1].o.start(); await tick(); assert.equal(owners(), 1);
  tabs[2].o.takeOver(); await tick(); assert.equal(owners(), 1);
  tabs[3].o.start(); tabs[1].o.takeOver(); await tick(); assert.equal(owners(), 1);
  locks.closeTab(tabs[1].id); open.delete(tabs[1].id); await tick(); assert.ok(owners() <= 1);
  tabs[0].o.takeOver(); await tick(); assert.equal(owners(), 1);
});

test("lease fallback (no Web Locks): one owner; a crashed owner's lease expires and a waiter takes over; takeover is explicit", async () => {
  const clock = createClock(); const storage = createMemoryStorage();
  const mk = id => tab(null, id, { storage, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  const A = mk("A"), B = mk("B");
  A.o.start(); B.o.start();
  assert.deepEqual([A.o.getState(), B.o.getState()], ["owner", "waiting"]);
  await clock.advance(60_000);
  assert.equal(A.o.getState(), "owner", "heartbeat keeps the lease"); assert.equal(B.o.getState(), "waiting");
  // A crashes: its timers vanish without releasing the lease
  const crashed = mk("A2"); // stand-in: stop A's heartbeat by letting its timers be cleared without stop()
  A.o.stop(); storage.setItem(LEASE_KEY, JSON.stringify({ tabId: "A", expiresAt: clock.now() + 9000 }));   // lease left behind by the dead tab
  await clock.advance(5_000); assert.equal(B.o.getState(), "waiting", "lease still valid");
  await clock.advance(10_000); assert.equal(B.o.getState(), "owner", "expired lease claimed");
  const C = mk("C"); C.o.start(); assert.equal(C.o.getState(), "waiting");
  C.o.takeOver();
  await clock.advance(4_000);
  assert.equal(C.o.getState(), "owner"); assert.equal(B.o.getState(), "lost", "B's heartbeat sees the takeover");
  assert.ok(crashed);
});

test("lease fallback: two tabs claiming in the same instant do not both end up owners (read-back check)", () => {
  const clock = createClock(); const storage = createMemoryStorage();
  const racing = id => tab(null, id, { storage, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  const A = racing("A"), B = racing("B");
  // Interleave: B overwrites the lease between A's write and A's read-back.
  const realSet = storage.setItem; let n = 0;
  storage.setItem = (k, v) => { realSet(k, v); if (k === LEASE_KEY && n++ === 0) realSet(k, JSON.stringify({ tabId: "B", expiresAt: clock.now() + 9000 })); };
  A.o.start(); storage.setItem = realSet; B.o.start();
  assert.notEqual(A.o.getState(), "owner", "A saw it lost the race");
});

test("a change to any synced data key by another tab marks this tab stale; device-only keys and our own tab do not", () => {
  const bus = createStorageBus(); const tabA = bus.join("A"), tabB = bus.join("B");
  const stale = []; watchForeignWrites(tabB, undefined, k => stale.push(k));
  bus.write("A", "arth_auto_backups"); bus.write("A", "arth_sync_state"); bus.write("A", LEASE_KEY); bus.write("A", "arth_pin");
  assert.deepEqual(stale, [], "device-only keys do not matter");
  bus.write("B", "arth_txns"); assert.deepEqual(stale, [], "a tab's own writes are not announced to itself");
  bus.write("A", "arth_txns"); bus.write("A", "arth_bills");
  assert.deepEqual(stale, ["arth_txns"], "fires once");
  const stale2 = []; watchForeignWrites(tabB, undefined, k => stale2.push(k)); bus.write("A", null);
  assert.deepEqual(stale2, [null], "storage cleared by another tab");
  assert.ok(isDataKey("arth_plan_nudges") && !isDataKey("arth_pin"));
  assert.ok(tabA);
});

test("DATA_KEYS is exactly the persisted synced data: every other persisted key is a named device-local key (new keys force a decision)", () => {
  const files = ["src/App.jsx", "src/sync/syncState.js", "src/sync/safetyBackup.js", "src/sync/tabOwnership.js"];
  const keys = new Set();
  const walk = dir => { for (const f of fs.readdirSync(dir)) { const p = `${dir}/${f}`; if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f)) for (const m of fs.readFileSync(p, "utf8").matchAll(/["'`](arth_[a-z0-9_]+)["'`]/g)) keys.add(m[1]); } };
  walk("src");
  const DEVICE_ONLY = {
    arth_auto_backups: "rolling auto-backups kept on this device", arth_device_id: "identifies this device", arth_pin: "PIN hash stays on the device",
    arth_item_basis: "UI preference for the item form", arth_budget: "constant default; no setter exists", arth_school_relationships: "legacy key; now derived from membership relationships",
    arth_sync_state: "sync history", arth_sync_safety_backups: "sync safety backups", arth_tab_lease: "tab ownership lease", arth_data: "test-only simulation key",
    arth_pin_locked_until: "session-only lock timer", arth_txn_draft: "unsaved Add-transaction draft; device-only by design", arth_nl_card_note_seen: "typed-entry card note shown-count; a per-device UI counter", arth_data_owner: "which account the data on THIS device belongs to (account-isolation guard); must never sync",
    arth_snapshots: "NOT a storage key: the cloud table name", arth_higher: "NOT a storage key: a comparison constant in card reconciliation",
  };
  const unknown = [...keys].filter(k => !DATA_KEYS.includes(k) && !(k in DEVICE_ONLY));
  assert.deepEqual(unknown, [], `new persisted key(s) need a decision (synced data -> DATA_KEYS, otherwise DEVICE_ONLY): ${unknown.join(", ")}`);
  const missing = DATA_KEYS.filter(k => !keys.has(k));
  assert.deepEqual(missing, [], "DATA_KEYS lists keys the app no longer uses");
  assert.ok(files.length);
});

// ── the engine on shared storage (two tabs of one profile) ──────────────────────────────────────────────────────────
function twoTabs() {
  const kit = S.makeKit("new"); kit.seed(0);
  const shared = createMemoryStorage({ arth_data: JSON.stringify(S.baseData()) });
  const T1 = createDevice({ name: "T1", clock: kit.clock, cloud: kit.cloud, storage: shared });
  const T2 = createDevice({ name: "T2", clock: kit.clock, cloud: kit.cloud, storage: shared });
  return { kit, shared, T1, T2 };
}

test("without any coordination, a stale second tab is stopped by the engine guard and cannot overwrite the cloud", async () => {
  const { kit, T1, T2 } = twoTabs();
  await T1.start(); await T2.start(); await T1.settle(100); await T2.settle(100);
  const x = T1.addTxn("x"); await T1.settle(1500);          // tab 1 syncs a new transaction
  const y = T2.addTxn("y"); await T2.settle(1500);          // tab 2 (stale) edits and tries to sync
  assert.equal(T2.status().kind, "stale-tab");
  const cloudIds = (kit.cloud.rows.get(S.USER).snapshot.txns || []).map(t => t.id);
  assert.ok(cloudIds.includes(x) && !cloudIds.includes(y), "tab 1's change is intact in the cloud");
  assert.equal(kit.cloud.log.filter(l => l.kind === "swap" && l.ids.includes(y)).length, 0, "tab 2 never wrote");
  assert.deepEqual(lostIds([T1, T2], kit.cloud), []);
  // and the stopped engine stays stopped (no timer or later change revives it)
  T2.addTxn("z"); await T2.settle(600000);
  assert.equal(kit.cloud.log.filter(l => l.ids && l.ids.includes("T2-t2")).length, 0);
});

test("with the storage-event watcher, a stale tab stops BEFORE it can edit over the other tab's data", async () => {
  const { kit, shared, T1, T2 } = twoTabs();
  const bus = createStorageBus(); bus.join("T1"); const t2 = bus.join("T2");
  await T1.start(); await T2.start(); await T1.settle(100); await T2.settle(100);
  let blocked = false;
  watchForeignWrites(t2, undefined, () => { T2.engine.markStale("data changed in another tab"); blocked = true; });
  const x = T1.addTxn("x"); bus.write("T1", "arth_txns"); await T1.settle(1500);
  assert.equal(blocked, true); assert.equal(T2.status().kind, "stale-tab");
  // the UI is blocked at this point: tab 2 cannot add anything, so shared storage still holds tab 1's data
  assert.ok(JSON.parse(shared.getItem("arth_data")).txns.some(t => t.id === x));
  // reloading tab 2 loads the shared data (including x) and syncs normally
  await T2.reload(); await T2.settle(2000);
  assert.ok(T2.ids().includes(x)); assert.equal(T2.status().kind, "synced");
  assert.deepEqual(lostIds([T1, T2], kit.cloud), []);
});

test("negative control: with NO coordination at all a stale tab's persist clobbers the shared data and a later sync loses the other tab's transaction", async () => {
  const { kit, shared, T1, T2 } = twoTabs();
  await T1.start(); await T2.start(); await T1.settle(100); await T2.settle(100);
  const x = T1.addTxn("x"); await T1.settle(1500);
  T1.engine.stop();                                          // pretend the engine guard did not exist and tab 1 later closes
  const y = T2.addTxn("y");                                  // stale tab persists its (x-less) data over the shared storage
  assert.ok(!JSON.parse(shared.getItem("arth_data")).txns.some(t => t.id === x), "tab 2's persist dropped x locally");
  assert.ok(y);
  // This is why single-owner coordination (not only the guard) is required: x now survives only in the cloud and tab 1's memory.
});
