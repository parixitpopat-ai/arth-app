import test from "node:test";
import assert from "node:assert/strict";
import { getHouseholdFiscalYearSummary, getPersonFiscalYearReport } from "./fiscalYear.js";
import { getMonthlyCashFlow, fyMonthKeys } from "../cashflow/monthlyCashFlow.js";

const cats = [{ id: "food", name: "Food", icon: "F" }, { id: "rent", name: "Rent", icon: "R" }, { id: "fun", name: "Fun", icon: "U" }];
const t = (id, type, amount, date, x = {}) => ({ id, type, amount, date, accId: "b1", catIds: [], ...x });
const txns = [
  t(1, "income", 90000, "2026-04-01", { incomeType: "salary" }),
  t(2, "income", 90000, "2026-10-01", { incomeType: "salary" }),
  t(3, "income", 5000, "2027-03-20", { incomeType: "interest" }),
  t(4, "expense", 20000, "2026-04-05", { catId: "rent", catIds: ["rent"] }),
  t(5, "expense", 3000, "2026-10-05", { catId: "food", catIds: ["food"] }),
  t(6, "expense", 1000, "2027-03-10", { catId: "food", catIds: ["food"] }),
  t(7, "expense", 700, "2026-03-31", { catId: "food", catIds: ["food"] }),   // previous FY
  t(8, "income", 400, "2027-04-02", { incomeType: "salary" }),                // next FY
  t(9, "transfer", 5000, "2026-06-01", { fromAccId: "b1", toAccId: "b2" }),
];

test("FY runs April to March: only that year's transactions count", () => {
  const s = getHouseholdFiscalYearSummary({ txns, cats, fyStartYear: 2026 });
  assert.equal(s.cameIn, 185000);
  assert.equal(s.wentOut, 24000);
  assert.equal(s.leftOver.amount, 161000);
  assert.equal(s.keptPercent, 87);
  assert.equal(s.months.length, 12);
  assert.equal(s.months[0].monthKey, "2026-04");
  assert.equal(s.months[11].monthKey, "2027-03");
});

test("the year reconciles with its months", () => {
  const s = getHouseholdFiscalYearSummary({ txns, cats, fyStartYear: 2026 });
  const months = fyMonthKeys(2026).map(monthKey => getMonthlyCashFlow({ txns, cats, monthKey }));
  assert.equal(s.cameIn, months.reduce((a, m) => a + m.cameIn, 0));
  assert.equal(s.wentOut, months.reduce((a, m) => a + m.wentOut, 0));
  assert.equal(Math.round(s.wentOutByCategory.reduce((a, r) => a + r.amount, 0) * 100) / 100, s.wentOut);
});

test("category and income-source totals are summed across months, largest first", () => {
  const s = getHouseholdFiscalYearSummary({ txns, cats, fyStartYear: 2026 });
  assert.deepEqual(s.wentOutByCategory.map(r => [r.id, r.amount]), [["rent", 20000], ["food", 4000]]);
  assert.deepEqual(s.incomeBySource.map(r => [r.key, r.amount]), [["salary", 180000], ["interest", 5000]]);
});

test("a transfer is not counted as came in or went out; it is listed as not counted", () => {
  const s = getHouseholdFiscalYearSummary({ txns, cats, fyStartYear: 2026 });
  assert.equal(s.notCounted.find(r => r.type === "transfer").amount, 5000);
});

test("an empty year has no activity and no percentage", () => {
  const s = getHouseholdFiscalYearSummary({ txns, cats, fyStartYear: 2030 });
  assert.equal(s.hasActivity, false);
  assert.equal(s.keptPercent, null);
  assert.equal(s.cameIn, 0);
});

test("a year where more went out than came in reads as negative left over", () => {
  const s = getHouseholdFiscalYearSummary({ txns: [t(1, "income", 100, "2026-05-01"), t(2, "expense", 300, "2026-05-02", { catId: "food", catIds: ["food"] })], cats, fyStartYear: 2026 });
  assert.equal(s.leftOver.kind, "negative");
  assert.equal(s.keptPercent, -200);
});

// ---- per person: the injected attribution function is the Budget one ----
const people = [{ id: "__me__", name: "Me", isMe: true }, { id: "p1", name: "Aarav" }, { id: "p2", name: "Meera" }, { id: "p3", name: "Idle" }];
const attr = (tx, pid) => {
  if (tx.type !== "expense") return 0;
  if (tx.people?.[pid]?.mode === "spent_on" && !tx.groupId) return Number(tx.people[pid].amount || 0);
  const item = (tx.tagItems || []).find(i => i.targetType === "person" && i.targetId === pid);
  if (item) return Number(item.amount || 0);
  if (tx.forPerson === pid) return Number(tx.tagPersonAmount || tx.amount || 0);
  return 0;
};
const plan = (p, mk) => (p.id === "p1" ? 2000 : p.id === "p2" ? 0 : 0);
const ptx = [
  t(1, "expense", 1500, "2026-04-10", { catIds: ["food"], people: { p1: { mode: "spent_on", amount: 1500 } } }),
  t(2, "expense", 900, "2026-10-10", { catIds: ["food", "fun"], tagItems: [{ targetType: "person", targetId: "p1", amount: 900 }] }), // a different field than the people map
  t(3, "expense", 400, "2026-11-10", { catIds: ["fun"], forPerson: "p2" }),
  t(4, "expense", 999, "2026-03-10", { catIds: ["food"], people: { p1: { mode: "spent_on", amount: 999 } } }),   // previous FY
  t(5, "income", 5000, "2026-06-01", { forPerson: "p1" }),
];

test("per person FY: counts attribution from every field the Budget view reads, once per transaction", () => {
  const r = getPersonFiscalYearReport({ people, txns: ptx, cats, fyStartYear: 2026, getPersonAttributedAmount: attr, getPersonPlanningAllocation: plan });
  const p1 = r.rows.find(x => x.person.id === "p1");
  assert.equal(p1.spent, 2400);
  assert.equal(p1.budget, 24000);
  assert.equal(p1.remaining, 21600);
  assert.equal(p1.usedPercent, 10);
  assert.equal(p1.txnCount, 2);
  assert.equal(r.rows.find(x => x.person.id === "p2").spent, 400);
});

test("per person FY: previous-year spend and income are excluded; the household member and idle people are not rows", () => {
  const r = getPersonFiscalYearReport({ people, txns: ptx, cats, fyStartYear: 2026, getPersonAttributedAmount: attr, getPersonPlanningAllocation: plan });
  assert.deepEqual(r.rows.map(x => x.person.id), ["p1", "p2"]);
  assert.equal(r.totalSpent, 2800);
  assert.equal(r.totalBudget, 24000);
});

test("per person FY: a multi-category transaction splits equally; months and categories add back to spent", () => {
  const r = getPersonFiscalYearReport({ people, txns: ptx, cats, fyStartYear: 2026, getPersonAttributedAmount: attr, getPersonPlanningAllocation: plan });
  const p1 = r.rows.find(x => x.person.id === "p1");
  assert.deepEqual(p1.categories.map(c => [c.id, c.amount]), [["food", 1950], ["fun", 450]]);
  assert.equal(p1.months.length, 12);
  assert.equal(Math.round(p1.months.reduce((s, m) => s + m.spend, 0) * 100) / 100, p1.spent);
  assert.equal(Math.round(p1.categories.reduce((s, c) => s + c.amount, 0) * 100) / 100, p1.spent);
  assert.equal(p1.months.find(m => m.monthKey === "2026-10").spend, 900);
});

test("per person FY: no budget gives a null percentage, not 0 or Infinity", () => {
  const r = getPersonFiscalYearReport({ people, txns: ptx, cats, fyStartYear: 2026, getPersonAttributedAmount: attr, getPersonPlanningAllocation: plan });
  assert.equal(r.rows.find(x => x.person.id === "p2").usedPercent, null);
});
