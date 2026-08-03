// TRX-002C3 — Adapter equivalence test.
//
// Not testing Transaction.applySettlement() in isolation (already covered,
// TRX-002B). Not testing applyRepaymentAllocations in isolation (already
// covered, TRX-002C2's characterization suite). This test proves the NEW
// composed path (adapter -> canonical Transaction + legacy groupCollective
// pass-through) produces IDENTICAL externally observable output to the OLD
// legacy function, for the same inputs. This is the actual safety net for
// the repoint — if this test passes, the repoint is behavior-preserving for
// the scope it covers; if it doesn't, that's a real difference to resolve
// before touching production, not something to discover after.

import test from "node:test";
import assert from "node:assert/strict";
import { applyRepaymentAllocationsCharacterization as legacyApply } from "../applyRepaymentAllocationsCharacterization.js";
import { settlePersonShareOnTransaction as adapterSettle } from "../applyRepaymentAllocationsAdapter.js";

const todayStr = () => "2026-08-03";

function makeTxn(overrides = {}) {
  return {
    id: "t1", type: "expense",
    people: { p1: { amount: 500, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 500 } },
    ...overrides,
  };
}

test("equivalence: plain settlement (no group-collective) — adapter matches legacy exactly", () => {
  const legacyTxn = makeTxn();
  const adapterTxn = makeTxn();

  const legacyResult = legacyApply({
    txns: [legacyTxn], bills: [], personId: "p1",
    settlementLinks: [{ kind: "txn", id: "t1", amount: 300 }],
    todayStr,
  }).txns[0];

  const adapterResult = adapterSettle({ txn: adapterTxn, personId: "p1", amount: 300, todayStr });

  assert.deepEqual(adapterResult.people.p1, legacyResult.people.p1, "person-share fields must match exactly");
});

test("equivalence: full settlement — settled flips true in both paths identically", () => {
  const legacyTxn = makeTxn();
  const adapterTxn = makeTxn();

  const legacyResult = legacyApply({
    txns: [legacyTxn], bills: [], personId: "p1",
    settlementLinks: [{ kind: "txn", id: "t1", amount: 500 }],
    todayStr,
  }).txns[0];

  const adapterResult = adapterSettle({ txn: adapterTxn, personId: "p1", amount: 500, todayStr });

  assert.deepEqual(adapterResult.people.p1, legacyResult.people.p1);
  assert.equal(adapterResult.people.p1.settled, true);
});

test("equivalence: group-collective tracking advances identically in both paths (CR-006 pass-through)", () => {
  const withGroup = () => makeTxn({ groupCollectiveAmount: 1000, groupCollectiveSettledAmt: 200 });
  const legacyTxn = withGroup();
  const adapterTxn = withGroup();

  const legacyResult = legacyApply({
    txns: [legacyTxn], bills: [], personId: "p1",
    settlementLinks: [{ kind: "txn", id: "t1", amount: 300 }],
    todayStr,
  }).txns[0];

  const adapterResult = adapterSettle({ txn: adapterTxn, personId: "p1", amount: 300, todayStr });

  assert.equal(adapterResult.groupCollectiveSettledAmt, legacyResult.groupCollectiveSettledAmt, "group-collective advancement must match exactly — this is CR-006's whole point");
  assert.equal(adapterResult.groupCollectiveSettledAmt, 500); // 200 prior + 300 this settlement
});

test("equivalence: group-collective respects its cap identically in both paths", () => {
  const withGroup = () => makeTxn({ groupCollectiveAmount: 400, groupCollectiveSettledAmt: 300 });
  const legacyTxn = withGroup();
  const adapterTxn = withGroup();

  const legacyResult = legacyApply({
    txns: [legacyTxn], bills: [], personId: "p1",
    settlementLinks: [{ kind: "txn", id: "t1", amount: 500 }], // would push past the 400 cap if uncapped
    todayStr,
  }).txns[0];

  const adapterResult = adapterSettle({ txn: adapterTxn, personId: "p1", amount: 500, todayStr });

  assert.equal(legacyResult.groupCollectiveSettledAmt, 400, "legacy caps at groupCollectiveAmount");
  assert.equal(adapterResult.groupCollectiveSettledAmt, 400, "adapter must cap identically");
});

test("equivalence: settling a person with no share on the transaction is a no-op in both paths", () => {
  const legacyTxn = makeTxn();
  const adapterTxn = makeTxn();

  const legacyResult = legacyApply({
    txns: [legacyTxn], bills: [], personId: "someone-else",
    settlementLinks: [{ kind: "txn", id: "t1", amount: 300 }],
    todayStr,
  }).txns[0];

  const adapterResult = adapterSettle({ txn: adapterTxn, personId: "someone-else", amount: 300, todayStr });

  assert.deepEqual(adapterResult, legacyResult);
});
