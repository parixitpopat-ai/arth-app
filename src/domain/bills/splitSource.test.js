import { test } from "node:test";
import assert from "node:assert/strict";
import { getBillSplitSource } from "./splitSource.js";

test("no linked transaction: falls back to the bill's own splitPeople", () => {
  const bill = { id: "b1", splitPeople: { p1: { amount: 100, mode: "owes", settled: false } } };
  const result = getBillSplitSource(bill, []);
  assert.equal(result.kind, "bill");
  assert.equal(result.id, "b1");
  assert.deepEqual(result.people, bill.splitPeople);
});

test("paidByTxnId points at a transaction with no people: still falls back to the bill's own splitPeople", () => {
  const bill = { id: "b1", paidByTxnId: "t1", splitPeople: { p1: { amount: 100, mode: "owes", settled: false } } };
  const txns = [{ id: "t1", people: {} }];
  const result = getBillSplitSource(bill, txns);
  assert.equal(result.kind, "bill");
  assert.deepEqual(result.people, bill.splitPeople);
});

test("reported scenario: linked payment transaction carries the real, up-to-date settled state — used instead of the bill's stale copy", () => {
  const bill = {
    id: "b1", paidByTxnId: "t1", status: "paid",
    // Stale: still shows everyone unsettled, because the actual settlement happened
    // against the transaction below, never written back here.
    splitPeople: {
      nizam: { amount: 7450.25, mode: "owes", settled: false },
      sachin: { amount: 438.25, mode: "owes", settled: false },
      ug1: { amount: 438.25, mode: "owes", settled: false },
    },
  };
  const txns = [{
    id: "t1",
    people: {
      nizam: { amount: 7450.25, mode: "owes", settled: true, settledAmt: 7450.25, remainingAmt: 0 },
      sachin: { amount: 438.25, mode: "owes", settled: true, settledAmt: 438.25, remainingAmt: 0 },
      ug1: { amount: 438.25, mode: "owes", settled: false },
    },
  }];
  const result = getBillSplitSource(bill, txns);
  assert.equal(result.kind, "txn");
  assert.equal(result.id, "t1");
  assert.equal(result.people.nizam.settled, true, "Nizam's real, settled state is used, not the bill's stale false");
  assert.equal(result.people.ug1.settled, false, "UG1 genuinely still owes, and that's still reflected");
});

test("no paidByTxnId at all: falls back to the bill's own splitPeople", () => {
  const bill = { id: "b1", splitPeople: { p1: { amount: 50, mode: "owes", settled: true } } };
  const result = getBillSplitSource(bill, [{ id: "other", people: { p1: { amount: 50 } } }]);
  assert.equal(result.kind, "bill");
  assert.deepEqual(result.people, bill.splitPeople);
});
