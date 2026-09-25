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

test("overpayment: a payment larger than the only outstanding bill still closes it, excess unconsumed (no other bill to apply it to)", () => {
  const bills = [{ id: "b1", isCcStatement: true, accId: "cc1", periodTo: "2026-09-15", amount: 35000, status: "unpaid" }];
  const txns = [{ id: "t1", type: "cc_payment", toAccId: "cc1", date: "2026-09-20", amount: 50000 }];
  const out = allocateCcPaymentsToStatements(card, bills, txns);
  assert.deepEqual(out, [{ billId: "b1", paidByTxnId: "t1", paidDate: "2026-09-20" }]);
});

test("overpayment across multiple bills: one large payment closes every outstanding bill, oldest first, with genuine excess left over", () => {
  const bills = [
    { id: "b1", isCcStatement: true, accId: "cc1", periodTo: "2026-07-15", amount: 5000, status: "unpaid" },
    { id: "b2", isCcStatement: true, accId: "cc1", periodTo: "2026-08-15", amount: 8000, status: "unpaid" },
  ];
  const txns = [{ id: "t1", type: "cc_payment", toAccId: "cc1", date: "2026-09-20", amount: 100000 }];
  const out = allocateCcPaymentsToStatements(card, bills, txns);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map(o => o.billId), ["b1", "b2"]);
  assert.ok(out.every(o => o.paidByTxnId === "t1"));
});

test("multiple separate payments, each exact, close their own bill independently", () => {
  const bills = [
    { id: "b1", isCcStatement: true, accId: "cc1", periodTo: "2026-07-15", amount: 5000, status: "unpaid" },
    { id: "b2", isCcStatement: true, accId: "cc1", periodTo: "2026-08-15", amount: 8000, status: "unpaid" },
  ];
  const txns = [
    { id: "t1", type: "cc_payment", toAccId: "cc1", date: "2026-07-20", amount: 5000 },
    { id: "t2", type: "cc_payment", toAccId: "cc1", date: "2026-08-20", amount: 8000 },
  ];
  const out = allocateCcPaymentsToStatements(card, bills, txns);
  assert.equal(out.length, 2);
  assert.deepEqual(out.find(o => o.billId === "b1"), { billId: "b1", paidByTxnId: "t1", paidDate: "2026-07-20" });
  assert.deepEqual(out.find(o => o.billId === "b2"), { billId: "b2", paidByTxnId: "t2", paidDate: "2026-08-20" });
});

test("a payment to a different card is never allocated here", () => {
  const bills = [{ id: "b1", isCcStatement: true, accId: "cc1", periodTo: "2026-09-15", amount: 35000, status: "unpaid" }];
  const txns = [{ id: "t1", type: "cc_payment", toAccId: "cc2", date: "2026-09-20", amount: 35000 }];
  assert.deepEqual(allocateCcPaymentsToStatements(card, bills, txns), []);
});
