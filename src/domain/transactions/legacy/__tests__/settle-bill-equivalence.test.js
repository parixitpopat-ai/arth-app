// TRX-002C4b — Equivalence test for the bill-kind settlement adapter.
// Same discipline as TRX-002C3/C4a: prove the new composed path matches the
// legacy function's output exactly, before touching App.jsx.

import test from "node:test";
import assert from "node:assert/strict";
import { applyRepaymentAllocationsCharacterization as legacyApply } from "../applyRepaymentAllocationsCharacterization.js";
import { settlePersonShareOnBill as adapterSettle, mirrorSettlementOntoTransaction } from "../settlePersonShareOnBill.js";

const todayStr = () => "2026-08-03";

function makeBill(overrides = {}) {
  return {
    id: "b1", status: "unpaid",
    splitPeople: { p1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 } },
    ...overrides,
  };
}

test("equivalence (bill-kind): settling a bill share matches legacy exactly", () => {
  const legacyBill = makeBill();
  const adapterBill = makeBill();

  const legacyResult = legacyApply({
    txns: [], bills: [legacyBill], personId: "p1",
    settlementLinks: [{ kind: "bill", id: "b1", amount: 858.40 }],
    todayStr,
  }).bills[0];

  const { bill: adapterResult } = adapterSettle({ bill: adapterBill, personId: "p1", amount: 858.40, todayStr });

  assert.deepEqual(adapterResult.splitPeople.p1, legacyResult.splitPeople.p1);
  assert.equal(adapterResult.status, legacyResult.status);
  assert.equal(adapterResult.status, "paid");
});

test("equivalence (bill-kind): partial settlement with other unsettled shares does NOT flip status, matches legacy", () => {
  const withTwo = () => makeBill({
    splitPeople: {
      p1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 },
      p2: { amount: 1716.80, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 1716.80 },
    },
  });
  const legacyBill = withTwo();
  const adapterBill = withTwo();

  const legacyResult = legacyApply({
    txns: [], bills: [legacyBill], personId: "p1",
    settlementLinks: [{ kind: "bill", id: "b1", amount: 858.40 }],
    todayStr,
  }).bills[0];

  const { bill: adapterResult } = adapterSettle({ bill: adapterBill, personId: "p1", amount: 858.40, todayStr });

  assert.equal(adapterResult.status, legacyResult.status);
  assert.equal(adapterResult.status, "unpaid", "p2 still unsettled — must match legacy in staying unpaid");
});

test("equivalence (bill-kind): mirror instruction matches legacy mirroring behavior exactly", () => {
  const legacyBill = makeBill({ paidByTxnId: "t1" });
  const legacyTxn = { id: "t1", type: "expense", people: { p1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 } } };

  const legacyResultTxns = legacyApply({
    txns: [legacyTxn], bills: [legacyBill], personId: "p1",
    settlementLinks: [{ kind: "bill", id: "b1", amount: 858.40 }],
    todayStr,
  }).txns;

  const adapterBill = makeBill({ paidByTxnId: "t1" });
  const adapterTxn = { id: "t1", type: "expense", people: { p1: { amount: 858.40, mode: "owes", settled: false, settledAmt: 0, remainingAmt: 858.40 } } };

  const { mirror } = adapterSettle({ bill: adapterBill, personId: "p1", amount: 858.40, todayStr });
  assert.ok(mirror, "mirror instruction must be produced when paidByTxnId is set");

  const mirroredTxn = mirrorSettlementOntoTransaction({ txn: adapterTxn, personId: "p1", addedAmt: mirror.addedAmt });

  assert.deepEqual(mirroredTxn.people.p1, legacyResultTxns[0].people.p1, "mirrored transaction share must match legacy exactly");
});

test("equivalence (bill-kind): no mirror produced when paidByTxnId is not set", () => {
  const adapterBill = makeBill(); // no paidByTxnId
  const { mirror } = adapterSettle({ bill: adapterBill, personId: "p1", amount: 858.40, todayStr });
  assert.equal(mirror, null);
});

test("equivalence (bill-kind): group-collective advances identically to legacy", () => {
  const withGroup = () => makeBill({ groupCollectiveAmount: 1000, groupCollectiveSettledAmt: 200 });
  const legacyBill = withGroup();
  const adapterBill = withGroup();

  const legacyResult = legacyApply({
    txns: [], bills: [legacyBill], personId: "p1",
    settlementLinks: [{ kind: "bill", id: "b1", amount: 300 }],
    todayStr,
  }).bills[0];

  const { bill: adapterResult } = adapterSettle({ bill: adapterBill, personId: "p1", amount: 300, todayStr });

  assert.equal(adapterResult.groupCollectiveSettledAmt, legacyResult.groupCollectiveSettledAmt);
  assert.equal(adapterResult.groupCollectiveSettledAmt, 500);
});
