import test from "node:test";
import assert from "node:assert/strict";
import { txnAvailable, isUsableExpense, findUsableExpenses, planCover, applyAllocations, spread } from "./billAllocation.js";
import { getBillBalance, getBillBadge } from "../obligations/billBalance.js";
import { reopenBillsPaidByDeletedTxns, withoutBillContributionsForTxn } from "../obligations/billContributionSync.js";

// The user's case: one ₹13,056 payment on a card for the common-meter electricity connection; two open bills of that connection.
const AUG = { id: "b-aug", name: "Common Meter · August", amount: 6017, dueDate: "2026-10-12", status: "unpaid", billerAccountId: "ba1", catId: "utilities" };
const SEP = { id: "b-sep", name: "Common Meter Electricity Bill · September", amount: 7039.46, dueDate: "2026-11-13", status: "unpaid", billerAccountId: "ba1", catId: "utilities" };
const PAY = { id: "t1", type: "expense", amount: 13056, date: "2026-11-13", accId: "card", billerLinkId: "ba1", catId: "utilities", catIds: ["utilities"] };
let n = 0; const genId = () => `g${++n}`;

test("a payment that nothing was applied from has all its money available; a fully applied one has none; a legacy link counts as fully applied", () => {
  assert.equal(txnAvailable(PAY, []), 13056);
  assert.equal(txnAvailable(PAY, [{ obligationType: "bill", obligationId: "b-aug", txnId: "t1", amount: 6017, txnAmount: 13056 }]), 7039);
  assert.equal(txnAvailable({ ...PAY, paidBillId: "x" }, []), 0);                // legacy: points at a bill, no Contribution = a full payment from before
  assert.equal(isUsableExpense({ ...PAY, type: "transfer" }, []), false);
});
test("the expense is offered first for the September bill: same connection, covers it", () => {
  const other = { id: "t2", type: "expense", amount: 500, date: "2026-11-01", catId: "food", catIds: ["food"] };
  const found = findUsableExpenses([other, PAY], [], SEP);
  assert.equal(found[0].txn.id, "t1"); assert.equal(found[0].sameConnection, true); assert.equal(found[0].covers, true); assert.equal(found[0].available, 13056);
  assert.equal(findUsableExpenses([PAY], [{ obligationType: "bill", obligationId: "b-aug", txnId: "t1", amount: 13056, txnAmount: 13056 }], SEP).length, 0);   // nothing left to give
});
test("cover plan: oldest due first (August, then September); the 46 paise gap stays on September, NOT rounded", () => {
  const p = planCover(PAY, SEP, [AUG, SEP], []);
  assert.equal(p.thisOnly.allocations.length, 1); assert.equal(p.thisOnly.allocations[0].applied, 7039.46); assert.equal(p.thisOnly.unallocatedAfter, 6016.54);
  assert.deepEqual(p.cover.allocations.map(a => [a.billId, a.applied, a.remainingAfter, a.becomesPaid]), [["b-aug", 6017, 0, true], ["b-sep", 7039, 0.46, false]]);
  assert.equal(p.cover.unallocatedAfter, 0);
});
test("applying the cover plan: contributions per bill, August paid, September partly paid with ₹0.46 due, the expense becomes a bill payment", () => {
  const p = planCover(PAY, SEP, [AUG, SEP], []);
  const r = applyAllocations({ txn: PAY, allocations: p.cover.allocations, bills: [AUG, SEP], contributions: [], genId });
  const aug = r.bills.find(b => b.id === "b-aug"), sep = r.bills.find(b => b.id === "b-sep");
  assert.equal(aug.status, "paid"); assert.equal(aug.paidDate, "2026-11-13"); assert.equal(aug.paidByTxnId, "t1");
  assert.equal(sep.status, "unpaid"); assert.equal(sep.paidByTxnId, "t1");
  assert.deepEqual(r.contributions.map(c => [c.obligationId, c.amount, c.txnId]).sort(), [["b-aug", 6017, "t1"], ["b-sep", 7039, "t1"]]);
  assert.equal(getBillBalance(sep, r.contributions).status, "partial"); assert.equal(getBillBalance(sep, r.contributions).remaining, 0.46);
  assert.equal(getBillBadge({ ...sep }, r.contributions, new Date("2026-11-14")).kind, "overdue");               // still due: it is overdue by its date, with ₹0.46 left
  assert.equal(r.txnPatch.isBillPayment, true); assert.equal(r.txnPatch.paidBillId, "b-aug"); assert.equal(r.applied, 13056);
  assert.equal(txnAvailable({ ...PAY, ...r.txnPatch }, r.contributions), 0);                                    // cannot be used a second time
});
test("this bill only: the rest of the expense stays available for the other bill", () => {
  const p = planCover(PAY, SEP, [AUG, SEP], []);
  const r = applyAllocations({ txn: PAY, allocations: p.thisOnly.allocations, bills: [AUG, SEP], contributions: [], genId });
  assert.equal(r.bills.find(b => b.id === "b-sep").status, "paid");
  assert.equal(txnAvailable({ ...PAY, ...r.txnPatch }, r.contributions), 6016.54);
  assert.equal(findUsableExpenses([{ ...PAY, ...r.txnPatch }], r.contributions, AUG)[0].available, 6016.54);   // still offered for August, with what is left
});
test("a smaller payment than the bill: partly paid, nothing invented; an expense bigger than all bills leaves the rest unallocated", () => {
  const small = { ...PAY, id: "t3", amount: 1000 };
  const r = applyAllocations({ txn: small, allocations: planCover(small, SEP, [AUG, SEP], []).thisOnly.allocations, bills: [AUG, SEP], contributions: [], genId });
  assert.equal(getBillBalance(r.bills.find(b => b.id === "b-sep"), r.contributions).remaining, 6039.46);
  const big = { ...PAY, id: "t4", amount: 20000 };
  const p = planCover(big, SEP, [AUG, SEP], []);
  assert.equal(p.cover.unallocatedAfter, 20000 - 6017 - 7039.46);
});
test("deleting the payment reopens EVERY bill it paid (they point back at it) and removes its contributions", () => {
  const p = planCover(PAY, SEP, [AUG, SEP], []);
  const r = applyAllocations({ txn: PAY, allocations: p.cover.allocations, bills: [AUG, SEP], contributions: [], genId });
  const reopened = reopenBillsPaidByDeletedTxns(r.bills, [{ ...PAY, ...r.txnPatch }]);
  assert.deepEqual(reopened.map(b => [b.id, b.status, b.paidByTxnId]), [["b-aug", "unpaid", null], ["b-sep", "unpaid", null]]);
  assert.equal(withoutBillContributionsForTxn(r.contributions, "t1").length, 0);
});
test("spread never gives a bill more than it owes and skips cancelled/paid ones", () => {
  const s = spread(100000, [AUG, { ...SEP, status: "cancelled" }], []);
  assert.deepEqual(s.map(x => [x.billId, x.applied]), [["b-aug", 6017]]);
});
