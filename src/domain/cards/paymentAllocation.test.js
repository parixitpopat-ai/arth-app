import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateCcPaymentsToStatements } from "./paymentAllocation.js";

const card = { id: "cc1" };

test("a full payment after the statement closes marks it paid", () => {
  const bills = [{ id: "b1", isCcStatement: true, accId: "cc1", periodTo: "2026-09-15", amount: 35000, status: "unpaid" }];
  const txns = [{ id: "t1", type: "cc_payment", toAccId: "cc1", date: "2026-09-20", amount: 35000 }];
  const out = allocateCcPaymentsToStatements(card, bills, txns);
  assert.deepEqual(out, [{ billId: "b1", paidByTxnId: "t1", paidDate: "2026-09-20" }]);
});

test("a partial payment never marks the bill paid", () => {
  const bills = [{ id: "b1", isCcStatement: true, accId: "cc1", periodTo: "2026-09-15", amount: 35000, status: "unpaid" }];
  const txns = [{ id: "t1", type: "cc_payment", toAccId: "cc1", date: "2026-09-20", amount: 20000 }];
  assert.deepEqual(allocateCcPaymentsToStatements(card, bills, txns), []);
});

test("a payment dated before the statement closes doesn't count toward it", () => {
  const bills = [{ id: "b1", isCcStatement: true, accId: "cc1", periodTo: "2026-09-15", amount: 35000, status: "unpaid" }];
  const txns = [{ id: "t1", type: "cc_payment", toAccId: "cc1", date: "2026-09-01", amount: 35000 }];
  assert.deepEqual(allocateCcPaymentsToStatements(card, bills, txns), []);
});

test("one payment can close two smaller oldest-first bills, in order", () => {
  const bills = [
    { id: "b1", isCcStatement: true, accId: "cc1", periodTo: "2026-08-15", amount: 10000, status: "unpaid" },
    { id: "b2", isCcStatement: true, accId: "cc1", periodTo: "2026-09-15", amount: 15000, status: "unpaid" },
  ];
  const txns = [{ id: "t1", type: "cc_payment", toAccId: "cc1", date: "2026-09-20", amount: 25000 }];
  const out = allocateCcPaymentsToStatements(card, bills, txns);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(o => o.billId), ["b1", "b2"]);
});

test("already-paid bills are ignored", () => {
  const bills = [{ id: "b1", isCcStatement: true, accId: "cc1", periodTo: "2026-09-15", amount: 35000, status: "paid" }];
  const txns = [{ id: "t1", type: "cc_payment", toAccId: "cc1", date: "2026-09-20", amount: 35000 }];
  assert.deepEqual(allocateCcPaymentsToStatements(card, bills, txns), []);
});
