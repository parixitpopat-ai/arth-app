// Account-isolation guard (SYNC-SAFETY-008). One phone, several accounts: the data on the phone belongs to one account, and
// switching accounts must never silently upload, replace or merge it. All data synthetic; deterministic (fake clock, fake cloud).
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClock, createFakeCloud, createDevice, createMemoryStorage, lostIds } from "./testing/sim.js";
import { createSyncEngine } from "./syncEngine.js";
import { classifyOwnership, readOwner, writeOwner, startFreshSnapshot, OWNER_KEY } from "./deviceOwner.js";
import { backedUpTxnIds, readSafetyBackups } from "./safetyBackup.js";
import { txnIdsOf, digestSnapshot } from "./digest.js";
import { decideSync, SYNC_ACTIONS } from "./decideSync.js";
import { loadSyncState, saveSyncState } from "./syncState.js";

const A = "user-A", B = "user-B";
const txn = (id, who = "x") => ({ id, type: "expense", desc: `${who} ${id}`, amount: 100, date: "2026-10-01", catId: "food", catIds: ["food"], accId: "syn_bank", people: {} });
const dataWith = ids => ({ txns: ids.map(i => txn(i)), accounts: [{ id: "syn_bank", name: "SYN Bank", type: "bank", balance: 100000 }], bills: [], people: [], planNudges: {}, monthOverrides: {} });
const snapWith = ids => ({ version: 1, savedAt: "2026-10-01T00:00:00.000Z", ...dataWith(ids) });

/** One phone (one storage) and one cloud. `signIn` is a person signing in on the phone; `fresh` = an interactive sign-in, otherwise a session that continues. */
function world({ phoneIds = [], clouds = {} } = {}) {
  const clock = createClock(); const cloud = createFakeCloud({ clock });
  const storage = createMemoryStorage(); storage.setItem("arth_data", JSON.stringify(dataWith(phoneIds)));
  for (const [u, ids] of Object.entries(clouds)) cloud.seed(u, snapWith(ids), 0);
  const devs = []; let n = 0;
  const signIn = (userId, { fresh = true } = {}) => { const d = createDevice({ name: `phone-${userId}-${++n}`, userId, userEmail: `${userId}@example.invalid`, continuedSession: !fresh, clock, cloud, storage }); devs.push(d); return d; };
  const writes = () => cloud.log.filter(l => l.outcome === "applied").length;
  return { clock, cloud, storage, signIn, devs, writes, rowIds: u => { const r = cloud.rows.get(u); return r ? txnIdsOf(r.snapshot).sort() : null; } };
}
const sorted = a => [...a].sort();

test("A -> sign out -> B (fresh sign-in), B's cloud EMPTY: nothing is uploaded or replaced; the person is asked", async () => {
  const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  assert.equal(readOwner(w.storage).userId, A);
  const before = w.writes();
  const b = w.signIn(B); const out = await b.start(); await b.settle(5000);
  assert.equal(out.outcome, "ownership"); assert.equal(out.ownership.kind, "other-account"); assert.equal(out.ownership.ownerUserId, A);
  assert.equal(b.status().kind, "ownership");
  assert.equal(w.writes(), before, "no cloud write");
  assert.equal(w.cloud.rows.has(B), false, "no row was created for B");
  assert.deepEqual(sorted(b.ids()), ["a1", "a2"], "the device's data is untouched");
  // nothing happens later either (retries, visibility, manual sync, edits)
  await b.engine.onVisible(); await b.engine.syncNow(); b.addTxn("late"); await b.settle(900000);
  assert.equal(w.cloud.rows.has(B), false); assert.equal(w.writes(), before);
});

test("A -> sign out -> B, B's cloud POPULATED: B's copy is not overwritten; the question is about this phone's ownership first", async () => {
  const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"], [B]: ["b1", "b2", "b3"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  const before = w.writes(), rowB = JSON.stringify(w.cloud.rows.get(B));
  const b = w.signIn(B); const out = await b.start(); await b.settle(5000);
  assert.equal(out.outcome, "ownership");
  assert.equal(JSON.stringify(w.cloud.rows.get(B)), rowB, "B's row is byte-identical");
  assert.equal(w.writes(), before);
  assert.deepEqual(sorted(b.ids()), ["a1", "a2"]);
});

test("start fresh, B's cloud empty: the phone holds none of A's data, A's data is in a verified pinned backup and A's own cloud copy, and B gets an empty account", async () => {
  const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  const b = w.signIn(B); await b.start();
  const r = await b.engine.resolveOwnership("start-fresh"); assert.equal(r.outcome, "started-fresh");
  assert.deepEqual(b.ids(), [], "none of A's transactions remain on the phone");
  const bk = readSafetyBackups(w.storage).find(x => x.reason === "other-account-device-copy");
  assert.ok(bk && bk.pinned, "pinned backup"); assert.deepEqual(sorted(txnIdsOf(bk.snapshot)), ["a1", "a2"]);
  assert.equal(readOwner(w.storage).userId, B); assert.equal(readOwner(w.storage).source, "start-fresh");
  await b.engine.boot(); await b.settle(3000);
  assert.deepEqual(w.rowIds(B), [], "B's new row holds none of A's data");
  assert.deepEqual(w.rowIds(A), ["a1", "a2"], "A's cloud copy is untouched");
  assert.deepEqual(lostIds([a, b], w.cloud, A), []);
});

test("start fresh, B's cloud populated: the phone ends with exactly B's data; A's data survives only in the backup and A's cloud", async () => {
  const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"], [B]: ["b1", "b2"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  const b = w.signIn(B); await b.start();
  const r = await b.engine.resolveOwnership("start-fresh"); assert.equal(r.outcome, "started-fresh");
  assert.deepEqual(sorted(b.ids()), ["b1", "b2"]);
  await b.engine.boot(); await b.settle(3000);
  assert.deepEqual(w.rowIds(B), ["b1", "b2"], "B's cloud copy gained nothing from A");
  assert.deepEqual(w.rowIds(A), ["a1", "a2"]);
  assert.deepEqual(sorted([...backedUpTxnIds(w.storage)]).filter(i => i.startsWith("a")), ["a1", "a2"]);
});

test("transfer, B's cloud empty: only after the explicit choice does A's data go into B (with a verified backup first)", async () => {
  const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  const b = w.signIn(B); await b.start(); await b.settle(1000);
  assert.equal(w.cloud.rows.has(B), false, "still nothing before the choice");
  const r = await b.engine.resolveOwnership("transfer"); assert.equal(r.outcome, "transferred");
  assert.ok(readSafetyBackups(w.storage).some(x => x.reason === "before-account-transfer" && x.pinned));
  assert.equal(readOwner(w.storage).transferredFrom, A);
  await b.engine.boot(); await b.settle(3000);
  assert.deepEqual(w.rowIds(B), ["a1", "a2"]);
});

test("transfer, B's cloud populated: ownership is settled, but the two copies still need an explicit choice; nothing is replaced meanwhile", async () => {
  const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"], [B]: ["b1"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  const b = w.signIn(B); await b.start();
  await b.engine.resolveOwnership("transfer");
  const out = await b.engine.boot(); await b.settle(2000);
  assert.equal(out.outcome, "conflict");
  assert.deepEqual(w.rowIds(B), ["b1"], "B's copy not replaced"); assert.deepEqual(sorted(b.ids()), ["a1"], "device copy not replaced");
});

test("an unsynced change made as A is never lost by switching to B: it is flagged, and it survives in the backup after 'start fresh'", async () => {
  const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200);
  w.cloud.faults.offlineDevices.add(a.name);                 // A is offline when the change is made
  const unsynced = a.addTxn("only-on-phone"); await a.settle(2000);
  a.signOut(); w.cloud.faults.offlineDevices.delete(a.name);
  const b = w.signIn(B); const out = await b.start();
  assert.equal(out.outcome, "ownership"); assert.equal(out.ownership.unsynced, true, "told that A has changes the cloud never saw");
  assert.ok(b.ids().includes(unsynced));
  await b.engine.resolveOwnership("start-fresh");
  assert.ok(!b.ids().includes(unsynced));
  assert.ok(backedUpTxnIds(w.storage).has(unsynced), "kept in the pinned backup");
  assert.deepEqual(lostIds([a, b], w.cloud, A), []);
});

test("returning to A afterwards: A's cloud copy is intact and the phone can sync as A again (A's data is not mixed with B's)", async () => {
  const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"], [B]: ["b1"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  const b = w.signIn(B); await b.start(); await b.engine.resolveOwnership("start-fresh"); await b.engine.boot(); await b.settle(2000); b.signOut();
  assert.equal(readOwner(w.storage).userId, B);
  const a2 = w.signIn(A); const out = await a2.start();                     // A signs back in: the phone now holds B's data
  assert.equal(out.outcome, "ownership"); assert.equal(out.ownership.ownerUserId, B);
  assert.deepEqual(w.rowIds(A), ["a1"]); assert.deepEqual(w.rowIds(B), ["b1"]);
});

test("same account signing out and back in: no question, sync continues", async () => {
  const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.addTxn("a2"); await a.settle(2000); a.signOut();
  const a2 = w.signIn(A); const out = await a2.start(); await a2.settle(2000);
  assert.notEqual(out.outcome, "ownership");
  assert.deepEqual(w.rowIds(A), sorted(a2.ids()));
});

test("fresh install (no data, no record): the first account claims the phone and is not asked anything", async () => {
  const w = world({ phoneIds: [], clouds: { [B]: ["b1"] } });
  const b = w.signIn(B); const out = await b.start(); await b.settle(2000);
  assert.notEqual(out.outcome, "ownership"); assert.equal(readOwner(w.storage).userId, B);
  assert.deepEqual(sorted(b.ids()), ["b1"]);
});

test("fresh install, empty cloud: the account is created from the (empty) phone and claims it", async () => {
  const w = world({ phoneIds: [], clouds: {} });
  const b = w.signIn(B); const out = await b.start(); await b.settle(2000);
  assert.notEqual(out.outcome, "ownership"); assert.equal(readOwner(w.storage).userId, B); assert.deepEqual(w.rowIds(B), []);
});

test("offline-resumed / restored session (continues) on a phone with no recorded owner: it is the same person, so the phone is claimed without a question", async () => {
  const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"] } });
  const a = w.signIn(A, { fresh: false }); const out = await a.start(); await a.settle(2000);
  assert.notEqual(out.outcome, "ownership"); assert.equal(readOwner(w.storage).userId, A); assert.equal(readOwner(w.storage).source, "session");
});

test("a continued session does NOT override a recorded different owner (the person closed the app on the question, then reopened as B)", async () => {
  const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"], [B]: [] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  const b = w.signIn(B); await b.start();                                    // asked; closed without answering
  const b2 = w.signIn(B, { fresh: false }); const out = await b2.start();     // reopened: B's session is restored
  assert.equal(out.outcome, "ownership"); assert.equal(out.ownership.ownerUserId, A);
  assert.deepEqual(w.rowIds(B), []);
});

test("data with no recorded owner and an interactive sign-in is not uploaded: the person is asked (and can add it to the account in one step)", async () => {
  const w = world({ phoneIds: ["x1", "x2"], clouds: {} });
  const b = w.signIn(B); const out = await b.start(); await b.settle(3000);
  assert.equal(out.outcome, "ownership"); assert.equal(out.ownership.kind, "unowned-with-data");
  assert.equal(w.cloud.rows.has(B), false);
  await b.engine.resolveOwnership("transfer"); await b.engine.boot(); await b.settle(2000);
  assert.deepEqual(w.rowIds(B), ["x1", "x2"]);
});

test("failures while resolving change nothing: no connection, unreadable cloud copy, backup that cannot be verified", async () => {
  const mk = () => { const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"], [B]: ["b1"] } }); return w; };
  { // offline
    const w = mk(); const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
    const b = w.signIn(B); await b.start(); w.cloud.faults.offlineDevices.add(b.name);
    const r = await b.engine.resolveOwnership("start-fresh"); assert.equal(r.outcome, "failed");
    assert.deepEqual(sorted(b.ids()), ["a1"]); assert.equal(readOwner(w.storage).userId, A);
  }
  { // storage cannot hold the backup
    const w = mk(); const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
    const b = w.signIn(B); await b.start(); w.storage.failKeys.add("arth_sync_safety_backups");
    for (const choice of ["start-fresh", "transfer"]) {
      const r = await b.engine.resolveOwnership(choice); assert.equal(r.outcome, "blocked-backup", choice);
      assert.deepEqual(sorted(b.ids()), ["a1"], choice); assert.equal(readOwner(w.storage).userId, A, choice);
    }
    assert.deepEqual(w.rowIds(B), ["b1"]);
  }
});

test("a decision that was not taken stays not taken after reload (the block does not depend on memory)", async () => {
  const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  const b = w.signIn(B); await b.start();
  for (let i = 0; i < 3; i++) { await b.reload(); const o = await b.engine.syncNow(); assert.equal(o.outcome, "ownership"); }
  assert.equal(w.cloud.rows.has(B), false);
});

// ── pure rules ──
test("classifyOwnership: every combination", () => {
  const c = (o, h, meaningful, cont) => classifyOwnership({ owner: o && { userId: o }, historyOwner: h && { userId: h }, userId: "me", localMeaningful: meaningful, continuedSession: cont }).kind;
  assert.equal(c("me", null, true, false), "own");
  assert.equal(c(null, "me", true, false), "own");
  assert.equal(c("other", null, false, false), "claim", "nothing to protect");
  assert.equal(c("other", null, true, true), "other-account", "continued session never overrides a recorded owner");
  assert.equal(c("other", null, true, false), "other-account");
  assert.equal(c(null, "other", true, false), "other-account", "sync history names the owner on devices from before this record");
  assert.equal(c(null, null, true, true), "claim");
  assert.equal(c(null, null, true, false), "unowned-with-data");
  assert.equal(c(null, null, false, false), "claim");
});

test("owner record: unreadable or malformed counts as no record", () => {
  const st = createMemoryStorage(); assert.equal(readOwner(st), null);
  st.setItem(OWNER_KEY, "{oops"); assert.equal(readOwner(st), null);
  st.setItem(OWNER_KEY, JSON.stringify({ userId: 5 })); assert.equal(readOwner(st), null);
  writeOwner(st, { userId: "u", email: "e", source: "x" }); assert.equal(readOwner(st).userId, "u");
});

test("startFreshSnapshot empties EVERY data key on the device (the app's restore keeps lists the incoming snapshot lacks) and lays the new account's own data over it", () => {
  const local = { version: 1, dark: false, savedAt: "x", masterUserSetupComplete: true, txns: [{ id: "a1" }], billers: [{ id: "bl" }], goals: [{ id: "g" }], gifts: [{ id: "gf" }], perPersonBudgets: { p: 1 }, accounts: [{ id: "acc" }], cats: [{ id: "c" }], syncMeta: { writeId: "w" } };
  const fresh = startFreshSnapshot(local, null, ["accounts", "cats"], "now");
  assert.deepEqual([fresh.txns, fresh.billers, fresh.goals, fresh.gifts], [[], [], [], []]); assert.deepEqual(fresh.perPersonBudgets, {});
  assert.equal("accounts" in fresh, false); assert.equal("cats" in fresh, false); assert.equal("syncMeta" in fresh, false);
  assert.equal(fresh.masterUserSetupComplete, false); assert.equal(fresh.dark, false);
  const over = startFreshSnapshot(local, { txns: [{ id: "b1" }], syncMeta: { writeId: "z" } }, ["accounts", "cats"], "now");
  assert.deepEqual(over.txns, [{ id: "b1" }]); assert.deepEqual(over.billers, []); assert.equal("syncMeta" in over, false);
});

// ── item 5: the conflict question is skipped ONLY where the engine can show the copies have not diverged ──
test("decision table: a write without a question requires a recorded common point AND an unchanged cloud token; every other divergence asks", () => {
  const base = { networkOk: true, localMeaningful: true, localDigest: "L" };
  const cloud = t => ({ token: t, digest: "C", meaningful: true });
  assert.equal(decideSync({ ...base, hasBase: true, baseToken: "t1", baseDigest: "B", cloud: cloud("t1") }).action, SYNC_ACTIONS.PUSH, "cloud unchanged since the common point");
  assert.equal(decideSync({ ...base, hasBase: true, baseToken: "t1", baseDigest: "B", cloud: cloud("t2") }).action, SYNC_ACTIONS.CONFLICT, "cloud moved and this side changed");
  assert.equal(decideSync({ ...base, hasBase: false, cloud: cloud("t1") }).action, SYNC_ACTIONS.CONFLICT, "no common point, both hold data");
  assert.equal(decideSync({ ...base, hasBase: false, localDigest: "C", cloud: cloud("t1") }).action, SYNC_ACTIONS.ADOPT_BASE, "identical content");
});

test("a common point recorded for another account is not a common point for this one (history is per account)", () => {
  const st = createMemoryStorage(); saveSyncState(st, { ...loadSyncState(st, A), baseToken: "t1", baseDigest: "D" });
  assert.equal(loadSyncState(st, A).baseToken, "t1"); assert.equal(loadSyncState(st, B).baseToken, null);
});

// ═══ Decisions D1–D5 (review round): exact behaviours ═══════════════════════════════════════════════════════════════════════════
const uploads = w => w.cloud.log.filter(l => l.outcome === "applied").length;
const dropWrites = (storage, key) => { const set = storage.setItem.bind(storage); storage.setItem = (k, v) => { if (k === key) return; set(k, v); }; return () => { storage.setItem = set; }; };   // a write that silently does not land

test("D1: a common point needs BOTH a token and the content it stood for; half a history is no history and asks instead of writing", async () => {
  const base = { networkOk: true, localMeaningful: true, localDigest: "L" };
  const cloud = { token: "t1", digest: "C", meaningful: true };
  assert.equal(decideSync({ ...base, hasBase: true, baseToken: "t1", baseDigest: undefined, cloud }).action, SYNC_ACTIONS.CONFLICT);
  assert.equal(decideSync({ ...base, hasBase: true, baseToken: "t1", baseDigest: "", cloud }).action, SYNC_ACTIONS.CONFLICT);
  assert.equal(decideSync({ ...base, hasBase: true, baseToken: "", baseDigest: "B", cloud }).action, SYNC_ACTIONS.CONFLICT);
  assert.equal(decideSync({ ...base, hasBase: true, baseToken: "t1", baseDigest: "B", cloud }).action, SYNC_ACTIONS.PUSH, "the full history still allows the unchanged-cloud write");
  // in the engine: damage the stored history, then edit and reconnect: the cloud must not be written
  const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1", "other"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(500);
  const st = JSON.parse(w.storage.getItem("arth_sync_state")); delete st.baseDigest; w.storage.setItem("arth_sync_state", JSON.stringify(st));
  const before = uploads(w); w.cloud.cloud = null;
  await a.reload(); a.addTxn("edit"); await a.settle(5000);
  assert.equal(uploads(w), before, "nothing was written on the strength of a half history");
  assert.equal(a.status().kind, "conflict");
});

test("D1: reconnect after offline edits -> cloud UNCHANGED is written once with no question; cloud CHANGED asks and sends nothing", async () => {
  for (const cloudMoved of [false, true]) {
    const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"] } });
    const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(500);
    w.cloud.faults.offlineDevices.add(a.name); const mine = a.addTxn("offline"); await a.settle(2000);
    if (cloudMoved) w.cloud.seed(A, snapWith(["a1", "from-another-device"]), 0);
    const before = uploads(w); w.cloud.faults.offlineDevices.delete(a.name);
    await a.reload(); await a.settle(20000);
    if (cloudMoved) { assert.equal(a.status().kind, "conflict"); assert.equal(uploads(w), before, "nothing sent while the two copies are undecided"); assert.ok(a.ids().includes(mine)); }
    else { assert.equal(a.status().kind === "synced" || a.status().kind === "sent", true); assert.equal(uploads(w), before + 1, "exactly one conditional write"); assert.ok(w.rowIds(A).includes(mine)); }
  }
});

test("D2: transferred data never replaces an existing cloud row, even one with no user data; with no row it is created", async () => {
  const profileOnly = { version: 1, savedAt: "2026-10-01T00:00:00.000Z", txns: [], accounts: [{ id: "syn_bank", name: "SYN Bank", type: "bank", balance: 5 }], bills: [], people: [], planNudges: {}, monthOverrides: {}, masterUserSetupComplete: true };
  const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"] } }); w.cloud.seed(B, profileOnly, 0);
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
  const b = w.signIn(B); await b.start(); await b.engine.resolveOwnership("transfer");
  const rowBefore = JSON.stringify(w.cloud.rows.get(B)); const out = await b.engine.boot(); await b.settle(3000);
  assert.equal(out.outcome, "conflict"); assert.equal(JSON.stringify(w.cloud.rows.get(B)), rowBefore, "B's existing row is untouched until the person chooses");
  assert.deepEqual(sorted(b.ids()), ["a1", "a2"]);
});

test("D3: signing out with unsynced edits -> reported from local content, a verified backup is taken, NOTHING is sent and nothing is removed", async () => {
  const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(500);
  const clean = await a.engine.prepareSignOut(); assert.equal(clean.unsynced, false); assert.equal(clean.backup, undefined);
  assert.equal(readSafetyBackups(w.storage).some(b => b.reason === "before-sign-out"), false, "no backup when nothing is unsynced");
  w.cloud.faults.rejectNext = 99; const id = a.addTxn("unsent"); await a.settle(3000);
  const before = uploads(w);
  const info = await a.engine.prepareSignOut();
  assert.equal(info.unsynced, true); assert.equal(info.backup.verified, true);
  const bk = readSafetyBackups(w.storage).find(b => b.reason === "before-sign-out");
  assert.ok(bk.pinned && txnIdsOf(bk.snapshot).includes(id), "the unsent change is in the verified pinned backup");
  assert.deepEqual((await a.engine.prepareSignOut()).backup.id, info.backup.id, "asking again reuses the same backup");
  a.signOut(); await a.settle(900000);
  assert.equal(uploads(w), before, "sign-out sent nothing"); assert.ok(a.ids().includes(id), "and removed nothing"); assert.ok(!w.rowIds(A).includes(id));
});

test("D3: a phone that never completed a sync for the account, and a pending conflict, both count as unsynced", async () => {
  { const w = world({ phoneIds: ["x1"], clouds: {} }); const a = w.signIn(A, { fresh: false }); w.cloud.faults.offlineDevices.add(a.name); await a.start(); await a.settle(200);
    const i = await a.engine.prepareSignOut(); assert.equal(i.unsynced, true); assert.equal(i.neverSynced, true); }
  { const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"] } }); const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(300);
    w.cloud.seed(A, snapWith(["a1", "c1"]), 0); a.addTxn("l"); await a.settle(100); await a.engine.syncNow(); await a.settle(300);
    assert.equal(a.status().kind, "conflict"); const i = await a.engine.prepareSignOut(); assert.equal(i.unsynced, true); assert.equal(i.conflict, true); }
});

test("D3: offline sign-out check works with no connection (it needs none) and still takes the backup", async () => {
  const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"] } });
  const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(500);
  w.cloud.faults.offlineDevices.add(a.name); const id = a.addTxn("offline-edit"); await a.settle(2000);
  const i = await a.engine.prepareSignOut();
  assert.equal(i.unsynced, true); assert.equal(i.backup.verified, true);
  assert.ok(backedUpTxnIds(w.storage).has(id));
});

test("D3: interrupted backups are reported honestly: a failed write and a write that silently does not land are both 'not verified'; nothing is cleared", async () => {
  for (const mode of ["throws", "silent"]) {
    const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"] } });
    const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(500);
    w.cloud.faults.rejectNext = 99; const id = a.addTxn("unsent"); await a.settle(2000);
    if (mode === "throws") w.storage.failKeys.add("arth_sync_safety_backups"); else dropWrites(w.storage, "arth_sync_safety_backups");
    const i = await a.engine.prepareSignOut();
    assert.equal(i.unsynced, true, mode); assert.equal(i.backup.verified, false, mode); assert.ok(i.backup.error, mode);
    assert.ok(a.ids().includes(id), `${mode}: the phone still holds the change`);
    assert.equal(readSafetyBackups(w.storage).some(b => b.reason === "before-sign-out"), false, `${mode}: no unverified backup is claimed`);
  }
});

test("D3: if the check itself cannot run the answer is 'unknown' (the app warns), never 'nothing to worry about'", async () => {
  const eng = createSyncEngine({ userId: "u", deviceId: "d", cloud: { read: async () => null, insert: async () => ({}), swap: async () => ({}) }, storage: createMemoryStorage(), getSnapshot: () => { throw new Error("cannot read the app data"); }, applySnapshot: async () => {}, readLocalAfterApply: async () => ({}), genId: () => "g" });
  const i = await eng.prepareSignOut(); assert.equal(i.unsynced, null); assert.ok(i.error);
});

test("D3 + restart: sign out with unsynced edits, close the app, reopen: the edit is still on the phone; the same account signing back in sends it once; another account is told about it", async () => {
  for (const next of ["same", "other"]) {
    const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"], [B]: ["b1"] } });
    const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(500);
    w.cloud.faults.rejectNext = 99; const id = a.addTxn("unsent"); await a.settle(2000);
    await a.engine.prepareSignOut(); a.signOut(); w.cloud.faults.rejectNext = 0;
    const before = uploads(w);
    if (next === "same") {
      const a2 = w.signIn(A); const out = await a2.start(); await a2.settle(5000);
      assert.notEqual(out.outcome, "ownership"); assert.ok(w.rowIds(A).includes(id)); assert.equal(uploads(w), before + 1, "sent exactly once, after the account signed back in");
    } else {
      const b = w.signIn(B); const out = await b.start();
      assert.equal(out.outcome, "ownership"); assert.equal(out.ownership.unsynced, true); assert.equal(uploads(w), before);
      await b.engine.resolveOwnership("start-fresh"); assert.ok(!b.ids().includes(id)); assert.ok(backedUpTxnIds(w.storage).has(id), "the unsent edit survives in the pinned backup");
      assert.deepEqual(lostIds(w.devs, w.cloud), []);
    }
  }
});

test("D4 failed transfers: backup not verifiable / owner record unwritable / upload rejected / app closed before the first sync: nothing uploaded early, nothing removed, nothing duplicated", async () => {
  const setup = async () => { const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"] } }); const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut(); const b = w.signIn(B); await b.start(); return { w, b }; };
  { // (1) the backup silently does not land
    const { w, b } = await setup(); const undo = dropWrites(w.storage, "arth_sync_safety_backups");
    const r = await b.engine.resolveOwnership("transfer"); assert.equal(r.outcome, "blocked-backup");
    assert.equal(readOwner(w.storage).userId, A); assert.equal(w.cloud.rows.has(B), false); assert.deepEqual(sorted(b.ids()), ["a1", "a2"]); undo();
  }
  { // (2) the owner record cannot be written: reported, nothing uploaded; fixing storage lets it complete
    const { w, b } = await setup(); w.storage.failKeys.add(OWNER_KEY);
    const r = await b.engine.resolveOwnership("transfer"); assert.equal(r.outcome, "failed"); assert.match(r.error, /Nothing was uploaded/);
    assert.equal(readOwner(w.storage).userId, A); assert.equal(w.cloud.rows.has(B), false); assert.deepEqual(sorted(b.ids()), ["a1", "a2"]);
    w.storage.failKeys.delete(OWNER_KEY); const r2 = await b.engine.resolveOwnership("transfer"); assert.equal(r2.outcome, "transferred");
  }
  { // (3) the upload is rejected after the transfer: data stays, retried, lands once
    const { w, b } = await setup(); await b.engine.resolveOwnership("transfer"); w.cloud.faults.rejectNext = 2; const u0 = uploads(w);
    await b.engine.boot(); await b.settle(1000); assert.equal(w.cloud.rows.has(B), false); assert.deepEqual(sorted(b.ids()), ["a1", "a2"]);
    await b.settle(60000); assert.deepEqual(w.rowIds(B), ["a1", "a2"]); assert.equal(uploads(w), u0 + 1, "retried until it landed, and landed exactly once");
  }
  { // (4) the app is closed right after the transfer, before any sync: on reopening the data is still there and still goes up exactly once
    const { w, b } = await setup(); await b.engine.resolveOwnership("transfer"); b.signOut();
    const b2 = w.signIn(B, { fresh: false }); const out = await b2.start(); await b2.settle(3000);
    assert.notEqual(out.outcome, "ownership"); assert.deepEqual(w.rowIds(B), ["a1", "a2"]);
  }
});

test("D4 start fresh: nothing is cleared until the backup is verified; an interrupted apply or an unwritable owner record loses nothing and uploads nothing", async () => {
  { // order: at the moment the phone's data is replaced the verified pinned backup already exists
    const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"], [B]: ["b1"] } });
    const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
    let backupSeenAtClear = null;
    const b = createDevice({ name: "phone-B-x", userId: B, userEmail: "b@example.invalid", continuedSession: false, clock: w.clock, cloud: w.cloud, storage: w.storage, applyTransform: d => { backupSeenAtClear = readSafetyBackups(w.storage).some(x => x.reason === "other-account-device-copy" && x.pinned && txnIdsOf(x.snapshot).includes("a1")); return d; } });
    await b.start(); await b.engine.resolveOwnership("start-fresh");
    assert.equal(backupSeenAtClear, true, "the verified backup existed before the phone's data was replaced");
  }
  { // an apply that dies half way
    const w = world({ phoneIds: ["a1", "a2"], clouds: { [A]: ["a1", "a2"], [B]: ["b1"] } });
    const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
    const b = createDevice({ name: "phone-B-y", userId: B, userEmail: "b@example.invalid", continuedSession: false, clock: w.clock, cloud: w.cloud, storage: w.storage, applyTransform: () => { throw new Error("apply interrupted"); } });
    await b.start(); const before = uploads(w); const r = await b.engine.resolveOwnership("start-fresh");
    assert.equal(r.outcome, "failed"); assert.equal(uploads(w), before); assert.equal(readOwner(w.storage).userId, A, "ownership not claimed");
    assert.ok(backedUpTxnIds(w.storage).has("a1") && backedUpTxnIds(w.storage).has("a2"), "A's data is in the verified backup");
    assert.deepEqual(w.rowIds(A), ["a1", "a2"]); assert.deepEqual(w.rowIds(B), ["b1"]);
  }
  { // the owner record cannot be written after the switch
    const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"], [B]: ["b1"] } });
    const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
    const b = w.signIn(B); await b.start(); w.storage.failKeys.add(OWNER_KEY); const before = uploads(w);
    const r = await b.engine.resolveOwnership("start-fresh"); assert.equal(r.outcome, "failed"); assert.equal(uploads(w), before);
    assert.ok(backedUpTxnIds(w.storage).has("a1")); assert.deepEqual(sorted(b.ids()), ["b1"]); assert.equal(readOwner(w.storage).userId, A);
    assert.deepEqual(w.rowIds(A), ["a1"]); assert.deepEqual(w.rowIds(B), ["b1"]);
  }
  { // same, when the new account has NO cloud row yet (a separate code path)
    const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"] } });
    const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
    const b = w.signIn(B); await b.start(); dropWrites(w.storage, "arth_sync_safety_backups"); const before = uploads(w);
    const r = await b.engine.resolveOwnership("start-fresh"); assert.equal(r.outcome, "blocked-backup");
    assert.deepEqual(sorted(b.ids()), ["a1"], "nothing cleared"); assert.equal(uploads(w), before); assert.equal(w.cloud.rows.has(B), false); assert.equal(readOwner(w.storage).userId, A);
  }
  { // the backup silently does not land: the phone is left exactly as it was
    const w = world({ phoneIds: ["a1"], clouds: { [A]: ["a1"], [B]: ["b1"] } });
    const a = w.signIn(A, { fresh: false }); await a.start(); await a.settle(200); a.signOut();
    const b = w.signIn(B); await b.start(); dropWrites(w.storage, "arth_sync_safety_backups"); const before = uploads(w);
    const r = await b.engine.resolveOwnership("start-fresh"); assert.equal(r.outcome, "blocked-backup");
    assert.deepEqual(sorted(b.ids()), ["a1"]); assert.equal(uploads(w), before); assert.equal(readOwner(w.storage).userId, A);
  }
});

// ── randomised multi-account model ──
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
async function runAccountModel(seed, steps = 70) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const w = world({ phoneIds: [], clouds: {} });
  const users = [A, B, "user-C"], allowed = Object.fromEntries(users.map(u => [u, new Set()])), log = [], violations = [];
  let cur = null, curUserId = null, blocked = false;   // blocked: the ownership question is open; the app shows nothing else, so no edits can be made
  const check = what => {
    for (const u of users) { const ids = w.rowIds(u); if (ids) for (const id of ids) if (!allowed[u].has(id)) violations.push(`${what}: ${id} is in ${u}'s cloud copy but was never created by or deliberately transferred to ${u}`); }
    const lost = lostIds(w.devs, w.cloud); if (lost.length) violations.push(`${what}: lost ${lost.join(",")}`);
  };
  const signIn = async (u, fresh) => {
    cur = w.signIn(u, { fresh }); curUserId = u; blocked = false; const out = await cur.start(); await cur.settle(300); log.push(`signin ${u} ${fresh ? "fresh" : "cont"} -> ${out.outcome} [owner=${(readOwner(w.storage) || {}).userId}]`);
    if (out.outcome === "ownership") {
      blocked = true;
      const c = pick(["start-fresh", "start-fresh", "transfer", "leave"]);
      if (c === "leave") { log.push("leave"); return; }
      blocked = false;
      if (c === "transfer") cur.ids().forEach(id => allowed[u].add(id));
      const o = await cur.engine.resolveOwnership(c); log.push(`${c} -> ${o.outcome}`);
      if (o.outcome === "started-fresh" || o.outcome === "transferred") { const b = await cur.engine.boot(); log.push(`boot -> ${b.outcome}`); if (b.outcome === "conflict") { const k = pick(["keep-local", "use-cloud"]); await cur.engine.resolveConflict(k); log.push(k); } }
    } else if (out.outcome === "conflict") { const k = pick(["keep-local", "use-cloud", "later"]); await cur.engine.resolveConflict(k); log.push(`conflict ${k}`); }
  };
  await signIn(pick(users), r() < 0.5);
  for (let i = 0; i < steps; i++) {
    const roll = r(); let act;
    if (roll < 0.34 && cur && !blocked) { const id = cur.addTxn("m"); allowed[curUserId].add(id); act = `add ${id}`; await cur.settle(0); }
    else if (roll < 0.50) { const ms = pick([200, 3000, 60000, 900000]); act = `time ${ms}`; if (cur) await cur.settle(ms); else await w.clock.advance(ms); }
    else if (roll < 0.58 && cur) { const off = w.cloud.faults.offlineDevices; if (off.has(cur.name)) { off.delete(cur.name); act = "online"; } else { off.add(cur.name); act = "offline"; } }
    else if (roll < 0.64 && cur) { act = "reload"; await cur.reload(); await cur.settle(300); }
    else if (roll < 0.70 && cur) { act = "syncNow"; await cur.engine.syncNow(); await cur.settle(0); }
    else { // switch account (or sign out and back in as the same one)
      const next = pick(users); act = `switch -> ${next}`; if (cur) cur.signOut(); w.cloud.faults.offlineDevices.clear();
      await signIn(next, r() < 0.7);
    }
    log.push(act + ` [owner=${(readOwner(w.storage) || {}).userId}]`); check(`step ${i} (${act})`);
  }
  w.cloud.faults.offlineDevices.clear();
  return { violations, log, hash: crypto.createHash("sha256").update(log.join("\n") + "|" + users.map(u => `${u}:${(w.rowIds(u) || []).join(",")}`).join(";")).digest("hex") };
}

for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
  test(`account model seed ${seed}: no account's cloud copy ever gains another account's data unless explicitly transferred; nothing is lost; the run is reproducible`, async () => {
    const a = await runAccountModel(seed); assert.deepEqual(a.violations.slice(0, 2), [], a.log.slice(-14).join("\n"));
    const b = await runAccountModel(seed); assert.equal(b.hash, a.hash, "same seed, different event log");
  });
}
