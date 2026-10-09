// D1 (FIN-TRUTH-001): only a refund lowers what an expense cost me. A person's or group's repayment of
// their share does not - the split already took that share out of my spend.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getHouseholdAttributedTotal, buildRefundTotalsByExpense, isRefundAgainstExpense } from "./adapter.js";

const dinner = (settled = false) => ({ id: "e1", type: "expense", amount: 1000, date: "2026-10-03", people: { p1: { mode: "owes", amount: 400, settled } } });
const total = all => getHouseholdAttributedTotal({ periodTransactions: all.filter(t => t.type === "expense"), allTransactions: all });
const repay = (amount, extra = {}) => ({ id: "s" + amount, type: "settlement_in", amount, date: "2026-10-05", fromPersonId: "p1", againstTxnId: "e1", ...extra });
const refund = (amount, extra = {}) => ({ id: "r" + amount, type: "settlement_in", amount, date: "2026-10-05", isRefund: true, againstTxnId: "e1", ...extra });

test("friend owes 400 of 1000: my spend is 600, and stays 600 when they repay", () => {
  assert.equal(total([dinner()]), 600);
  assert.equal(total([dinner(true), repay(400)]), 600);
});

test("a partial repayment does not change my spend", () => {
  assert.equal(total([dinner(), repay(150)]), 600);
});

test("a group's repayment does not change my spend", () => {
  const e = { id: "e1", type: "expense", amount: 1000, date: "2026-10-03", groupId: "g1", trackingMode: "split", groupAllocations: [{ groupId: "g1", mode: "owes", amount: 600 }] };
  const rep = { id: "gr", type: "settlement_in", amount: 600, date: "2026-10-05", fromGroupId: "g1", againstTxnId: "e1" };
  assert.equal(total([e]), 400);
  assert.equal(total([e, rep]), 400);
});

test("a refund still lowers the expense", () => {
  assert.equal(total([dinner(), refund(100)]), 500);
});

test("a legacy refund (no isRefund flag, no person/group) still lowers the expense", () => {
  const legacy = { id: "l", type: "settlement_in", amount: 100, date: "2026-10-05", againstTxnId: "e1" };
  assert.equal(total([dinner(), legacy]), 500);
});

test("refund and repayment on the same expense: only the refund counts", () => {
  assert.equal(total([dinner(true), repay(400), refund(100)]), 500);
});

test("loan repayments (no againstTxnId) never reach the refund map", () => {
  const loanRepay = { id: "lr", type: "settlement_in", amount: 5000, date: "2026-10-05", fromPersonId: "p1", linkedLoanId: "L1" };
  assert.deepEqual(buildRefundTotalsByExpense([dinner(), loanRepay]), {});
  assert.equal(isRefundAgainstExpense(loanRepay), false);
});

test("the refund map is the one used by both totals: map and total agree", () => {
  const all = [dinner(true), repay(400), refund(100)];
  assert.deepEqual(buildRefundTotalsByExpense(all), { e1: 100 });
});
