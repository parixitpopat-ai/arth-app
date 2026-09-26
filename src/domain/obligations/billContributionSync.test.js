import { test } from "node:test";
import assert from "node:assert/strict";
import { withBillContributionForTxn, withoutBillContributionsForTxn } from "./billContributionSync.js";

let n = 0;
const genId = () => `c${++n}`;

test("first save writes one bill Contribution with string ids", () => {
  const next = withBillContributionForTxn([], { billId: "b1", txnId: 101, amount: 699, txnAmount: 699 }, genId);
  assert.equal(next.length, 1);
  assert.deepEqual(
    { obligationType: next[0].obligationType, obligationId: next[0].obligationId, txnId: next[0].txnId, amount: next[0].amount },
    { obligationType: "bill", obligationId: "b1", txnId: "101", amount: 699 }
  );
});

test("re-saving the same transaction replaces, never duplicates (the edit bug)", () => {
  let list = withBillContributionForTxn([], { billId: "b1", txnId: "101", amount: 699, txnAmount: 699 }, genId);
  list = withBillContributionForTxn(list, { billId: "b1", txnId: "101", amount: 699, txnAmount: 699 }, genId);
  list = withBillContributionForTxn(list, { billId: "b1", txnId: 101, amount: 699, txnAmount: 699 }, genId);
  assert.equal(list.length, 1);
});

test("other transactions' and other obligations' Contributions are untouched", () => {
  const prior = [
    { id: "x1", obligationType: "bill", obligationId: "b1", txnId: "202", amount: 100 },
    { id: "x2", obligationType: "schoolFeePeriod", obligationId: "p1", txnId: "101", amount: 50 },
  ];
  const next = withBillContributionForTxn(prior, { billId: "b1", txnId: "101", amount: 699, txnAmount: 699 }, genId);
  assert.equal(next.length, 3);
  assert.ok(next.some(c => c.id === "x1") && next.some(c => c.id === "x2"));
});

test("a zero or missing amount writes nothing and does not throw", () => {
  const prior = [{ id: "old", obligationType: "bill", obligationId: "b1", txnId: "101", amount: 699 }];
  assert.deepEqual(withBillContributionForTxn(prior, { billId: "b1", txnId: "101", amount: 0, txnAmount: 0 }, genId), []);
  assert.deepEqual(withBillContributionForTxn([], { billId: "b1", txnId: "101", amount: undefined, txnAmount: 5 }, genId), []);
});

test("delete/unlink removes only this transaction's bill Contributions", () => {
  const prior = [
    { id: "a", obligationType: "bill", obligationId: "b1", txnId: "101", amount: 699 },
    { id: "b", obligationType: "bill", obligationId: "b2", txnId: "101", amount: 50 },
    { id: "c", obligationType: "bill", obligationId: "b1", txnId: "202", amount: 699 },
    { id: "d", obligationType: "schoolFeePeriod", obligationId: "p1", txnId: "101", amount: 10 },
  ];
  assert.deepEqual(withoutBillContributionsForTxn(prior, 101).map(c => c.id), ["c", "d"]);
  assert.deepEqual(withoutBillContributionsForTxn(undefined, "101"), []);
});

import { withoutBillContributionsForTxns, reopenBillsPaidByDeletedTxns } from "./billContributionSync.js";

test("bulk delete removes bill Contributions of every deleted transaction", () => {
  const prior = [
    { id: "a", obligationType: "bill", obligationId: "b1", txnId: "1" },
    { id: "b", obligationType: "bill", obligationId: "b2", txnId: "2" },
    { id: "c", obligationType: "bill", obligationId: "b3", txnId: "3" },
  ];
  assert.deepEqual(withoutBillContributionsForTxns(prior, [1, "2"]).map(c => c.id), ["c"]);
});

test("bulk delete reopens only bills that point back at a deleted transaction", () => {
  const bills = [
    { id: "b1", status: "paid", paidDate: "2026-09-03", paidByTxnId: 1, amount: 699 },
    { id: "b2", status: "paid", paidDate: "2026-09-04", paidByTxnId: 99 },   // paid by another txn
    { id: "b3", status: "unpaid", paidByTxnId: null },
  ];
  const next = reopenBillsPaidByDeletedTxns(bills, [{ id: 1, paidBillId: "b1" }, { id: 2, paidBillId: "b2" }, { id: 3 }]);
  assert.deepEqual(next[0], { id: "b1", status: "unpaid", paidDate: null, paidByTxnId: null, amount: 699 });
  assert.equal(next[1], bills[1]);
  assert.equal(next[2], bills[2]);
});

test("no bill-paying transactions deleted → bills array returned as-is", () => {
  const bills = [{ id: "b1", status: "paid", paidByTxnId: 1 }];
  assert.equal(reopenBillsPaidByDeletedTxns(bills, [{ id: 5 }]), bills);
});
