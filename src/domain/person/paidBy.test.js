import { test } from "node:test";
import assert from "node:assert/strict";
import { isPaidByOther, getPaidByPayable, getPaidByPayableTotal, getPaidByPayablesByPerson } from "./paidBy.js";
import { buildPaybackTxn, getPaybackTotalsByPerson, applyPaybacks } from "./payback.js";
import { getFinancialPositionBreakdown, getFinancialPositionLabel } from "./financialPosition.js";
import { getGroupMemberIOwe } from "../group/balances.js";
import { computeAccountBalance } from "../accounts/accountBalance.js";
import { getHouseholdAttributedTotal, buildRefundTotalsByExpense } from "../../../domain/allocations/adapter.js";
import { buildMonthCalendar } from "../transactions/calendarSummary.js";

const bank = { id: "b1", type: "bank", openingBalance: 10000, openingBalanceDate: "2026-01-01" };
const inRange = () => true;
const cash = txns => computeAccountBalance({ accId: "b1", accounts: [bank], txns, isDateInRange: inRange });
const mine = (id, amount, date = "2026-10-03") => ({ id, type: "expense", amount, date, accId: "b1", catId: "food", catIds: ["food"] });
const paidBy = (id, amount, date = "2026-10-03", extra = {}) => ({ id, type: "expense", amount, date, accId: null, paidByPersonId: "p1", catId: "groceries", catIds: ["groceries"], ...extra });
const pay = (id, amount, extra = {}) => buildPaybackTxn({ personId: "p1", personName: "Ravi", fromAccId: "b1", amount, date: "2026-10-11", id, now: 1, ...extra });
const spend = txns => getHouseholdAttributedTotal({ periodTransactions: txns, allTransactions: txns });
const position = txns => {
  const owed = getPaidByPayableTotal(txns, "p1", buildRefundTotalsByExpense(txns));
  return applyPaybacks({ owesMe: 0, iOwe: owed }, getPaybackTotalsByPerson(txns).p1 || 0);
};

test("paid by me versus by another person: only the payer's expense creates a payable and leaves my account alone", () => {
  const a = mine("a", 1200), b = paidBy("b", 1200);
  assert.equal(isPaidByOther(a), false);
  assert.equal(isPaidByOther(b), true);
  assert.equal(getPaidByPayable(a, {}), 0);
  assert.equal(getPaidByPayable(b, {}), 1200);
  assert.equal(cash([a]), 8800);
  assert.equal(cash([b]), 10000); // my account was not used
});

test("spending counts once, on the purchase date, whoever paid", () => {
  assert.equal(spend([paidBy("b", 1200)]), 1200);
  assert.equal(spend([paidBy("b", 1200), pay("p", 1200)]), 1200); // the reimbursement is not spending
  const cal = buildMonthCalendar({ txns: [paidBy("b", 1200, "2026-10-03"), pay("p", 1200)], monthKey: "2026-10", today: "2026-10-11" });
  const day3 = cal.days.find(d => d.date === "2026-10-03"), day11 = cal.days.find(d => d.date === "2026-10-11");
  assert.equal(day3.spent, 1200);  // on the purchase date
  assert.equal(day11.spent, 0);    // not on the reimbursement date
});

test("partial reimbursement, full settlement, overpayment: balance and cash", () => {
  const e = paidBy("b", 2000);
  const partial = [e, pay("p1x", 1500)];
  assert.deepEqual([position(partial).iOwe, position(partial).owesMe], [500, 0]);
  assert.equal(cash(partial), 8500); // debited once, by the payment
  const full = [e, pay("p1x", 1500), pay("p2x", 500)];
  assert.deepEqual([position(full).iOwe, position(full).owesMe], [0, 0]);
  assert.equal(getFinancialPositionLabel(position(full)).state, "balanced");
  assert.equal(cash(full), 8000);
  const over = [e, pay("p1x", 2300)];
  assert.deepEqual([position(over).iOwe, position(over).owesMe], [0, 300]);
  const label = getFinancialPositionLabel(position(over));
  assert.deepEqual([label.state, label.amount], ["owed_to_me", 300]);
  assert.equal(cash(over), 7700);
  assert.equal(spend(over), 2000); // spending never changes with the payments
});

test("the person's breakdown lists the purchase and adds up to the total", () => {
  const txns = [paidBy("b", 2000, "2026-10-03", { desc: "Groceries" }), pay("p1x", 500)];
  const items = getFinancialPositionBreakdown("p1", txns, [], "me");
  assert.equal(items.filter(i => i.mode === "iOwe").reduce((s, i) => s + i.amount, 0), 1500);
  assert.ok(items.some(i => i.desc === "Groceries" && i.amount === 2000));
});

test("personal items: attributed to the payer (A) they count in my spending and payable; left out of the entry they count in neither", () => {
  const withPersonal = paidBy("b", 1500, "2026-10-03", { people: { p1: { mode: "spent_on", amount: 300, settled: false } } });
  assert.equal(spend([withPersonal]), 1500);
  assert.equal(getPaidByPayable(withPersonal, {}), 1500);
  const without = paidBy("b", 1200);
  assert.equal(spend([without]), 1200);
  assert.equal(getPaidByPayable(without, {}), 1200);
});

test("a refund against a paid-by expense lowers both my spending and what I owe", () => {
  const e = paidBy("b", 1000);
  const refund = { id: "r", type: "settlement_in", isRefund: true, againstTxnId: "b", amount: 200, date: "2026-10-05", accId: null };
  const map = buildRefundTotalsByExpense([e, refund]);
  assert.equal(getPaidByPayable(e, map), 800);
  assert.equal(spend([e, refund]), 800);
  assert.equal(getPaidByPayableTotal([e, refund], "p1", map), 800);
  assert.equal(getPaidByPayable(paidBy("c", 100), buildRefundTotalsByExpense([paidBy("c", 100), { id: "r2", type: "settlement_in", isRefund: true, againstTxnId: "c", amount: 500 }])), 0); // never negative
});

test("no duplicate spending or cash: paid-by + my own expense + payback each count once", () => {
  const txns = [mine("a", 400), paidBy("b", 1000), pay("p1x", 1000)];
  assert.equal(spend(txns), 1400);
  assert.equal(cash(txns), 10000 - 400 - 1000);
});

test("person and group attribution: a group-tagged purchase shows in that group's 'I owe'; a payback made from the group lowers it", () => {
  const g = paidBy("b", 1000, "2026-10-03", { groupId: "g1" });
  assert.equal(getGroupMemberIOwe([g], "g1", "p1"), 1000);
  assert.equal(getGroupMemberIOwe([g], "g2", "p1"), 0);
  assert.equal(getGroupMemberIOwe([g, pay("p1x", 400, { groupId: "g1" })], "g1", "p1"), 600);
  assert.deepEqual(getPaidByPayablesByPerson([g, paidBy("c", 50, "2026-10-04", { paidByPersonId: "p2" })]), { p1: 1000, p2: 50 });
});
