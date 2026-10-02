import { test } from "node:test";
import assert from "node:assert/strict";
import { getMonthlyCashFlow, getFiscalYearSeries, describeLeftOver, fyMonthKeys, fyStartYearOf, shiftMonth, sumFyToDate, getMonthState } from "./monthlyCashFlow.js";

const cats = [{ id: "home", name: "Home" }, { id: "education", name: "Education" }, { id: "food", name: "Food" }];
let n = 0;
const t = (over) => ({ id: `t${++n}`, date: "2026-10-02", ...over });
const txns = [
  t({ type: "income", amount: 82000, incomeType: "salary" }),
  t({ type: "income", amount: 30000, incomeType: "freelance" }),
  t({ type: "income", amount: 8000 }),
  t({ type: "expense", amount: 20000, catId: "home", catIds: ["home"] }),
  t({ type: "expense", amount: 12500, catId: "food", catIds: ["food"] }),
  // mixed multi-line payment: 12,000 Education + 3,000 Food, aggregated per line category
  t({ type: "expense", amount: 15000, catId: "education", catIds: ["education", "food"], catAllocations: { education: 12000, food: 3000 } }),
  // not income / not spending
  t({ type: "transfer", amount: 25000, fromAccId: "a", toAccId: "b" }),
  t({ type: "cc_payment", amount: 18400, fromAccId: "a", toAccId: "cc" }),
  t({ type: "investment", amount: 5000 }),
  t({ type: "cc_emi", amount: 2000 }),
  t({ type: "settlement_in", amount: 700 }),
  // other months must not leak in
  t({ type: "income", amount: 99999, date: "2026-09-30" }),
  t({ type: "expense", amount: 99999, date: "2026-11-01", catId: "home", catIds: ["home"] }),
];

test("came in = income txns only; transfers, card-bill payments, investments, EMIs and settlements never count", () => {
  const cf = getMonthlyCashFlow({ txns, cats, monthKey: "2026-10" });
  assert.equal(cf.cameIn, 120000);
  assert.equal(cf.wentOut, 47500);
  assert.equal(cf.leftOver.amount, 72500);
  assert.deepEqual(cf.notCounted.map(r => [r.type, r.amount]), [["transfer", 25000], ["cc_payment", 18400], ["investment", 5000], ["cc_emi", 2000], ["settlement_in", 700]]);
});

test("income grouped by the existing incomeType; a missing type is its own '' bucket (shown as plain Income)", () => {
  const cf = getMonthlyCashFlow({ txns, cats, monthKey: "2026-10" });
  assert.deepEqual(cf.incomeBySource, [{ key: "salary", amount: 82000 }, { key: "freelance", amount: 30000 }, { key: "", amount: 8000 }]);
});

test("a multi-line transaction counts each line under its own category; rows add up to Went out", () => {
  const cf = getMonthlyCashFlow({ txns, cats, monthKey: "2026-10" });
  const by = Object.fromEntries(cf.wentOutByCategory.map(r => [r.id, r.amount]));
  assert.equal(by.education, 12000);
  assert.equal(by.food, 15500);
  assert.equal(by.home, 20000);
  assert.equal(cf.wentOutByCategory.reduce((s, r) => s + r.amount, 0), cf.wentOut);
});

test("an expense with no category shows as Uncategorised so totals still reconcile", () => {
  const cf = getMonthlyCashFlow({ txns: [t({ type: "expense", amount: 700 })], cats, monthKey: "2026-10" });
  assert.equal(cf.wentOut, 700);
  assert.deepEqual(cf.wentOutByCategory.map(r => [r.name, r.amount]), [["Uncategorised", 700]]);
});

test("refunds net off Went out (existing household-spend rule)", () => {
  const e = t({ type: "expense", amount: 1000, catId: "food", catIds: ["food"] });
  const r = t({ type: "settlement_in", amount: 300, againstTxnId: e.id });
  assert.equal(getMonthlyCashFlow({ txns: [e, r], cats, monthKey: "2026-10" }).wentOut, 700);
});

test("positive / zero / negative Left over", () => {
  assert.deepEqual(describeLeftOver(120000, 78500), { kind: "positive", label: "Left over", amount: 41500 });
  assert.deepEqual(describeLeftOver(118000, 118000), { kind: "zero", label: "Left over", amount: 0 });
  assert.deepEqual(describeLeftOver(115000, 131400), { kind: "negative", label: "Went out more", amount: -16400 });
});

test("FY helpers: Apr-Mar keys, FY of a month, month stepping across boundaries", () => {
  assert.deepEqual([fyMonthKeys(2026)[0], fyMonthKeys(2026)[11]], ["2026-04", "2027-03"]);
  assert.equal(fyStartYearOf("2026-10"), 2026);
  assert.equal(fyStartYearOf("2027-02"), 2026);
  assert.equal(shiftMonth("2026-04", -1), "2026-03");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("FY series covers 12 months; FY-to-date nets only months up to the cut-off", () => {
  const s = getFiscalYearSeries({ txns, cats, fyStartYear: 2026 });
  assert.equal(s.length, 12);
  assert.equal(s.find(x => x.monthKey === "2026-10").leftOver.amount, 72500);
  assert.equal(sumFyToDate(s, "2026-10"), 99999 + 72500);
});

test("month state: future never reads as activity; empty past month; normal", () => {
  const cf = m => getMonthlyCashFlow({ txns, cats, monthKey: m });
  assert.equal(getMonthState(cf("2026-12"), "2026-10"), "future");
  assert.equal(getMonthState(cf("2026-06"), "2026-10"), "empty");
  assert.equal(getMonthState(cf("2026-10"), "2026-10"), "normal");
});
