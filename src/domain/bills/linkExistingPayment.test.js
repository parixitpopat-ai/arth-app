import { test } from "node:test";
import assert from "node:assert/strict";
import { getLinkablePayments, planLinkExistingPayment, isLinkableExpense } from "./linkExistingPayment.js";

const bill = { id: "b1", name: "Jio", amount: 299, catId: "c_mobile", validFrom: "2026-10-01", status: "unpaid" };
const exp = (id, over = {}) => ({ id, type: "expense", amount: 299, catId: "c_mobile", date: "2026-10-01", ...over });

test("only plain, unlinked expenses are offered", () => {
  assert.equal(isLinkableExpense(exp(1)), true);
  assert.equal(isLinkableExpense(exp(2, { type: "income" })), false);
  assert.equal(isLinkableExpense(exp(3, { type: "transfer" })), false);
  assert.equal(isLinkableExpense(exp(4, { paidBillId: "other" })), false);
  assert.equal(isLinkableExpense(exp(5, { isBillPayment: true })), false);
  assert.equal(isLinkableExpense(exp(6, { amount: 0 })), false);
  const ids = getLinkablePayments([exp(1), exp(2, { type: "income" }), exp(4, { paidBillId: "x" })], bill).map(t => t.id);
  assert.deepEqual(ids, [1]);
});

test("same amount ranks first, then same category, then the closest date", () => {
  const txns = [
    exp("far", { date: "2026-08-01" }),
    exp("near-other-amt", { amount: 100, date: "2026-10-02" }),
    exp("other-cat", { catId: "c_food", date: "2026-10-01" }),
    exp("near", { date: "2026-10-03" }),
  ];
  assert.deepEqual(getLinkablePayments(txns, bill).map(t => t.id), ["near", "far", "other-cat", "near-other-amt"]);
});

test("limit and no bill", () => {
  const txns = Array.from({ length: 12 }, (_, i) => exp(i));
  assert.equal(getLinkablePayments(txns, bill).length, 8);
  assert.equal(getLinkablePayments(txns, bill, { limit: 3 }).length, 3);
  assert.deepEqual(getLinkablePayments(txns, null), []);
  assert.deepEqual(getLinkablePayments(null, bill), []);
});

test("a full-amount payment clears the bill and is the first payment", () => {
  const p = planLinkExistingPayment(bill, exp(1), []);
  assert.deepEqual(p, { applied: 299, unallocated: 0, becomesPaid: true, isFirst: true });
});

test("a smaller payment is partial; a larger one leaves the extra Unallocated", () => {
  const partial = planLinkExistingPayment(bill, exp(1, { amount: 100 }), []);
  assert.equal(partial.applied, 100);
  assert.equal(partial.becomesPaid, false);
  const over = planLinkExistingPayment(bill, exp(1, { amount: 350 }), []);
  assert.equal(over.applied, 299);
  assert.equal(over.unallocated, 51);
  assert.equal(over.becomesPaid, true);
});

test("a later payment is not the first", () => {
  const prior = [{ obligationType: "bill", obligationId: "b1", txnId: 9, amount: 100 }];
  const p = planLinkExistingPayment(bill, exp(1, { amount: 199 }), prior);
  assert.equal(p.isFirst, false);
  assert.equal(p.applied, 199);
  assert.equal(p.becomesPaid, true);
});
