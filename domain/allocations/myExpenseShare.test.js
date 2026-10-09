import { test } from "node:test";
import assert from "node:assert/strict";
import { getMyExpenseShare, getHouseholdAttributedTotal, buildRefundTotalsByExpense } from "./adapter.js";

const e = (extra = {}) => ({ id: "e1", type: "expense", amount: 1000, ...extra });
const share = (exp, all = [exp]) => getMyExpenseShare(exp, buildRefundTotalsByExpense(all));

test("plain expense is fully mine", () => assert.equal(share(e()), 1000));

test("excludeFromSpend counts nothing", () => assert.equal(share(e({ excludeFromSpend: true })), 0));

test("refund / reimbursement settled against the expense reduces it, never below zero", () => {
  const exp = e();
  assert.equal(share(exp, [exp, { id: "r", type: "settlement_in", againstTxnId: "e1", amount: 300 }]), 700);
  assert.equal(share(exp, [exp, { id: "r", type: "settlement_in", againstTxnId: "e1", amount: 1500 }]), 0);
});

test("what a person owes me (receivable) is not my spend; what I spent on them is", () => {
  assert.equal(share(e({ people: { p1: { mode: "owes", amount: 400 } } })), 600);
  assert.equal(share(e({ people: { p1: { mode: "spent_on", amount: 400 } } })), 1000);
  assert.equal(share(e({ people: { __me__: { mode: "owes", amount: 400 } } })), 1000);
});

test("group allocation 'owes' is deducted; group collective only when there is no allocation list", () => {
  assert.equal(share(e({ groupAllocations: [{ groupId: "g", mode: "owes", amount: 250 }] })), 750);
  assert.equal(share(e({ trackingMode: "split", groupCollectiveAmount: 200 })), 800);
  assert.equal(share(e({ trackingMode: "split", groupCollectiveAmount: 200, groupAllocations: [{ groupId: "g", mode: "spent_on", amount: 50 }] })), 1000);
  assert.equal(share(e({ trackingMode: "tag", groupCollectiveAmount: 200 })), 1000);
});

test("refund is applied before receivables are deducted", () => {
  const exp = e({ people: { p1: { mode: "owes", amount: 400 } } });
  assert.equal(share(exp, [exp, { id: "r", type: "settlement_in", againstTxnId: "e1", amount: 300 }]), 300);
});

test("the period total is the sum of the per-expense share, expenses only", () => {
  const a = e({ id: "a", amount: 500 });
  const b = e({ id: "b", amount: 200, excludeFromSpend: true });
  const c = e({ id: "c", amount: 800, people: { p1: { mode: "owes", amount: 300 } } });
  const inc = { id: "i", type: "income", amount: 9999 };
  const all = [a, b, c, inc];
  assert.equal(getHouseholdAttributedTotal({ periodTransactions: all, allTransactions: all }), 500 + 0 + 500);
});
