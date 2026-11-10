import test from "node:test";
import assert from "node:assert/strict";
import { defaultCategoryForBillerType, findMatchingExpenseForBill } from "./billExpenseMatch.js";

test("category defaults: clear types get Utilities + sub; unclear types get nothing", () => {
  assert.deepEqual(defaultCategoryForBillerType("Mobile Postpaid"), { catId: "utilities", subId: "u5" });
  assert.deepEqual(defaultCategoryForBillerType("Electricity"), { catId: "utilities", subId: "u1" });
  assert.equal(defaultCategoryForBillerType("Rental"), null);
  assert.equal(defaultCategoryForBillerType("Gym / Fitness"), null);
  assert.equal(defaultCategoryForBillerType(undefined), null);
  const a = defaultCategoryForBillerType("Water"); a.catId = "x"; assert.equal(defaultCategoryForBillerType("Water").catId, "utilities");   // a copy
});

const ex = (id, amount, date, extra = {}) => ({ id, type: "expense", amount, date, catIds: [], ...extra });
test("match: same amount, close in time, unlinked", () => {
  const bill = { amount: 1200, dueDate: "2026-11-20", catIds: [] };
  assert.equal(findMatchingExpenseForBill({ bill, txns: [ex("a", 1200, "2026-11-18")], today: "2026-11-10" }).id, "a");
  assert.equal(findMatchingExpenseForBill({ bill, txns: [ex("a", 1200.004, "2026-11-10")], today: "2026-11-10" }).id, "a");
});
test("match: the reported case — a Housing expense of the same amount from months ago is NOT offered as the payment", () => {
  const bill = { amount: 1200, dueDate: "2026-11-20", catIds: [] };
  assert.equal(findMatchingExpenseForBill({ bill, txns: [ex("old", 1200, "2026-06-03", { catIds: ["housing"] })], today: "2026-11-10" }), null);
});
test("match: category must agree when both have one; linked or non-expense entries and other amounts never match; the closest date wins", () => {
  const bill = { amount: 1200, dueDate: "2026-11-20", catIds: ["utilities"] };
  const txns = [ex("h", 1200, "2026-11-19", { catIds: ["housing"] }), ex("lnk", 1200, "2026-11-19", { paidBillId: "b" }), ex("bp", 1200, "2026-11-19", { isBillPayment: true }),
    { id: "inc", type: "income", amount: 1200, date: "2026-11-19" }, ex("amt", 1100, "2026-11-19"), ex("far", 1200, "2026-11-01", { catIds: ["utilities"] }), ex("near", 1200, "2026-11-21", { catIds: ["utilities"] }), ex("nocat", 1200, "2026-11-22")];
  assert.equal(findMatchingExpenseForBill({ bill, txns, today: "2026-11-10" }).id, "near");
  assert.equal(findMatchingExpenseForBill({ bill: { ...bill, catIds: [] }, txns: [ex("h", 1200, "2026-11-19", { catIds: ["housing"] })], today: "2026-11-10" }).id, "h");   // a bill with no category still matches by amount+date
  assert.equal(findMatchingExpenseForBill({ bill: null, txns }), null);
});
