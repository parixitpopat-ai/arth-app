// TRX-002C4 (CR-001 Step 2) — Equivalence test for SettleModal's plain-transaction
// branch. Confirms settlePersonShareOnTransaction (already proven equivalent for
// applyRepaymentAllocations in TRX-002C3) produces identical output to
// SettleModal.settle()'s own inline person-share math — same formula, same
// fields, just a second call site. No new adapter needed for this step.

import test from "node:test";
import assert from "node:assert/strict";
import { settleCharacterization as legacySettle } from "../settleCharacterization.js";
import { settlePersonShareOnTransaction as adapterSettle } from "../applyRepaymentAllocationsAdapter.js";

const todayStr = () => "2026-08-03";

function makeTxn(overrides = {}) {
  return {
    id: "t1", desc: "Dinner", type: "expense",
    people: { p1: { amount: 500, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 500 } },
    ...overrides,
  };
}

test("equivalence (SettleModal branch): plain settle — adapter matches legacy person-share fields exactly", () => {
  const legacyTxn = makeTxn();
  const t = { id: "t1", desc: "Dinner", people: legacyTxn.people };

  const legacyResult = legacySettle({
    t, pid: "p1", requestedAmt: 300, bills: [], txns: [legacyTxn],
    accId: "acc-1", settleDate: "2026-08-03", todayStr,
  }).txns.find(x => x.id === "t1");

  const adapterTxn = makeTxn();
  const adapterResult = adapterSettle({ txn: adapterTxn, personId: "p1", amount: 300, todayStr });

  assert.deepEqual(adapterResult.people.p1, legacyResult.people.p1);
});

test("equivalence (SettleModal branch): group-collective advances identically via the same adapter", () => {
  const withGroup = () => makeTxn({ groupCollectiveAmount: 1000, groupCollectiveSettledAmt: 100 });
  const legacyTxn = withGroup();
  const t = { id: "t1", desc: "Dinner", people: legacyTxn.people };

  const legacyResult = legacySettle({
    t, pid: "p1", requestedAmt: 300, bills: [], txns: [legacyTxn],
    accId: "acc-1", settleDate: "2026-08-03", todayStr,
  }).txns.find(x => x.id === "t1");

  const adapterTxn = withGroup();
  const adapterResult = adapterSettle({ txn: adapterTxn, personId: "p1", amount: 300, todayStr });

  assert.equal(adapterResult.groupCollectiveSettledAmt, legacyResult.groupCollectiveSettledAmt);
  assert.equal(adapterResult.groupCollectiveSettledAmt, 400);
});

test("equivalence (SettleModal branch): full settlement flips settled identically", () => {
  const legacyTxn = makeTxn();
  const t = { id: "t1", desc: "Dinner", people: legacyTxn.people };

  const legacyResult = legacySettle({
    t, pid: "p1", requestedAmt: 500, bills: [], txns: [legacyTxn],
    accId: "acc-1", settleDate: "2026-08-03", todayStr,
  }).txns.find(x => x.id === "t1");

  const adapterTxn = makeTxn();
  const adapterResult = adapterSettle({ txn: adapterTxn, personId: "p1", amount: 500, todayStr });

  assert.equal(adapterResult.people.p1.settled, true);
  assert.equal(legacyResult.people.p1.settled, true);
  assert.deepEqual(adapterResult.people.p1, legacyResult.people.p1);
});
