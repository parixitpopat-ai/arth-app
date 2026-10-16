import { test } from "node:test";
import assert from "node:assert/strict";
import { listSummary, missingFrom, sameRecords, danglingReferences, introducedDangling, restoreRehearsal, rehearsalNoWorse, describeMissing } from "./snapshotIntegrity.js";

const full = () => ({
  version: 1, savedAt: "x", syncMeta: { writeId: "w" },
  txns: [{ id: 1 }, { id: 2 }, { id: 3 }],
  accounts: [{ id: "a1" }],
  bills: [{ id: "b1", paidByTxnId: 2 }, { id: "b2" }],
  contributions: [{ id: "c1", obligationType: "bill", obligationId: "b1", txnId: 2 }],
  memberships: [{ id: "m1", linkedTxnId: 3 }],
  membershipRelationships: [{ id: "r1", billerAccountId: "ba1" }],
  billerAccounts: [{ id: "ba1" }],
  feeSchedules: [{ id: "s1" }], feePeriods: [{ id: "p1", scheduleId: "s1" }],
  planNudges: { "2026-11": { status: "dismissed" } },
  hiddenCards: ["x", "y"],
});

test("summary lists every record list and map with ids, ignoring volatile fields", () => {
  const s = listSummary(full());
  assert.equal(s.txns.count, 3); assert.deepEqual(s.txns.ids, ["1", "2", "3"]);
  assert.deepEqual(s.planNudges.ids, ["2026-11"]);
  assert.equal(s.hiddenCards.ids, null, "id-less lists are compared by count");
  assert.ok(!("savedAt" in s) && !("syncMeta" in s) && !("version" in s));
});

test("a result missing ANY record of ANY list is reported (transactions, bills, payments, relationships, schedules, nudges)", () => {
  for (const [key, drop] of [["txns", s => s.txns.pop()], ["bills", s => s.bills.shift()], ["contributions", s => s.contributions.pop()], ["membershipRelationships", s => s.membershipRelationships.pop()], ["feePeriods", s => s.feePeriods.pop()], ["planNudges", s => { delete s.planNudges["2026-11"]; }], ["hiddenCards", s => s.hiddenCards.pop()]]) {
    const result = full(); drop(result);
    const r = missingFrom(result, full());
    assert.equal(r.ok, false, key);
    assert.equal(r.missing[0].key, key);
  }
  assert.equal(missingFrom(full(), full()).ok, true);
});

test("additions (e.g. defaults added by normalisation) are fine; a swapped id is not", () => {
  const more = full(); more.accounts.push({ id: "a2" }); more.txns.push({ id: 4 });
  assert.equal(missingFrom(more, full()).ok, true);
  const swapped = full(); swapped.txns[0] = { id: 99 };
  assert.deepEqual(missingFrom(swapped, full()).missing[0].ids, ["1"]);
});

test("exact comparison (used for backups) rejects additions too", () => {
  const more = full(); more.txns.push({ id: 4 });
  const r = sameRecords(more, full());
  assert.equal(r.ok, false); assert.equal(r.missingInB[0].key, "txns");
});

test("dangling references are found per relation; sync must not introduce new ones", () => {
  assert.deepEqual(danglingReferences(full()), []);
  const broken = full(); broken.txns = broken.txns.filter(t => t.id !== 2);
  const d = danglingReferences(broken).map(x => x.relation).sort();
  assert.deepEqual(d, ["bills.paidByTxnId -> txns", "contributions.txnId -> txns"]);
  assert.deepEqual(introducedDangling(broken, broken), [], "pre-existing dangling references are not blamed on the sync");
  assert.equal(introducedDangling(broken, full()).length, 2, "but ones the result gained are");
  const rel = full(); rel.billerAccounts = [];
  assert.equal(danglingReferences(rel)[0].relation, "membershipRelationships.billerAccountId -> billerAccounts");
});

test("restore rehearsal: records the restore path drops are reported; a backup is recoverable if restoring it is no worse than the source", () => {
  const dropOdd = list => list.filter(t => t.id % 2 === 0);              // a restore path that loses odd ids
  const src = full();
  const r = restoreRehearsal(src, { txns: dropOdd });
  assert.equal(r.ok, false); assert.deepEqual(r.dropped[0].ids, ["1", "3"]);
  assert.equal(restoreRehearsal(src, { txns: l => l }).ok, true);
  assert.equal(rehearsalNoWorse(src, src, { txns: dropOdd }).ok, true, "same loss as the source: pre-existing normalisation, not the backup's fault");
  const worse = full(); worse.bills = [];
  assert.equal(rehearsalNoWorse(worse, src, { txns: l => l, bills: l => l.slice(1) }).ok, true);
  assert.equal(rehearsalNoWorse(src, src, { txns: l => l }).ok, true);
  assert.match(describeMissing(r.dropped), /txns: 2 missing/);
});
