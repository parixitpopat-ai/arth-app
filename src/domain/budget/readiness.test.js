import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReadiness } from "./readiness.js";

const today = "2026-10-03";
const ev = (o) => ({ category: "committedSpending", status: "unpaid", recurs: false, ...o });
const base = { monthKey: "2026-11", monthBudget: 65000, today };

test("cash needed = spending + investments, and investments never count against the budget", () => {
  const r = buildReadiness({
    ...base, commitments: [],
    events: [
      ev({ sourceType: "feePeriod", sourceId: "f1", name: "Nov tuition", amount: 15000, date: "2026-11-10" }),
      ev({ sourceType: "recurringSchedule", sourceId: "s1", category: "committedSaving", name: "Nifty SIP", amount: 35000, date: "2026-11-05", recurs: true }),
    ],
  });
  assert.equal(r.spendingCash, 15000);
  assert.equal(r.investments, 35000);
  assert.equal(r.cashNeeded, 50000);
  assert.equal(r.budgetUsed, 15000);
  assert.equal(r.investmentRows[0].budget, null);
  assert.equal(r.over, 0);
});

test("a monthly item dated earlier recurs into the month as an estimate; a one-off in another month does not", () => {
  const r = buildReadiness({
    ...base, commitments: [],
    events: [
      ev({ sourceType: "bill", sourceId: "b1", name: "Electricity", amount: 3400, date: "2026-10-10", recurs: true }),
      ev({ sourceType: "insurancePolicy", sourceId: "i1", name: "HDFC Ergo", amount: 24600, date: "2026-12-20" }),
    ],
  });
  assert.equal(r.spendingCash, 3400);
  assert.equal(r.spendingRows[0].estimate, true);
  assert.equal(r.spendingEstimated, true);
});

test("paid and zero-amount events never count", () => {
  const r = buildReadiness({ ...base, commitments: [], events: [
    ev({ sourceType: "bill", sourceId: "b1", amount: 500, date: "2026-11-02", status: "paid" }),
    ev({ sourceType: "bill", sourceId: "b2", amount: 0, date: "2026-11-02" }),
  ] });
  assert.equal(r.empty, true);
});

test("a bill in a commitment's category is covered by it, not planned twice", () => {
  const events = [ev({ sourceType: "bill", sourceId: "b1", name: "Rent", amount: 8000, date: "2026-11-01" })];
  const commitments = [{ id: "c1", name: "House", amount: 10000, categoryId: "housing", skippedMonths: [] }];
  const r = buildReadiness({ ...base, commitments, events, catIdOf: () => "housing" });
  assert.equal(r.spendingCash, 10000);
  assert.equal(r.spendingRows.length, 1);
  // a covered bill larger than the envelope shows the larger figure
  const big = buildReadiness({ ...base, commitments, events: [{ ...events[0], amount: 12000 }], catIdOf: () => "housing" });
  assert.equal(big.spendingCash, 12000);
  // skipped for the month: the envelope stops reserving and the bill counts on its own
  const skipped = buildReadiness({ ...base, commitments: [{ ...commitments[0], skippedMonths: ["2026-11"] }], events, catIdOf: () => "housing" });
  assert.equal(skipped.spendingCash, 8000);
});

test("planned spending above the month budget is flagged (investments excluded)", () => {
  const r = buildReadiness({ ...base, monthKey: "2026-12", monthBudget: 65000, commitments: [{ id: "c1", name: "Household", amount: 90000, skippedMonths: [] }],
    events: [ev({ sourceType: "recurringSchedule", sourceId: "s1", category: "committedSaving", amount: 35000, date: "2026-12-05", recurs: true })] });
  assert.equal(r.budgetUsed, 90000);
  assert.equal(r.over, 25000);
  assert.equal(r.cashNeeded, 125000);
});

test("no budget set -> never reports over; an event may carry a different budget share", () => {
  const r = buildReadiness({ ...base, monthBudget: 0, commitments: [], events: [
    ev({ sourceType: "membership", sourceId: "m1", name: "Gym", amount: 9000, budgetAmount: 3000, date: "2026-11-15" }),
  ] });
  assert.equal(r.over, 0);
  assert.equal(r.spendingRows[0].cash, 9000);
  assert.equal(r.spendingRows[0].budget, 3000);
});

test("nothing planned -> empty", () => {
  assert.equal(buildReadiness({ ...base, commitments: [], events: [] }).empty, true);
});

import { shiftMonthKey } from "./readiness.js";
test("shiftMonthKey crosses year boundaries", () => {
  assert.equal(shiftMonthKey("2026-12", 1), "2027-01");
  assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
});

const fee = (id, date, amount = 5000) => ({ category: "committedSpending", status: "unpaid", recurs: false, sourceType: "feePeriod", sourceId: id, name: id, amount, date });
const feeEvents = [fee("nov", "2026-11-10"), fee("dec", "2026-12-10"), fee("jan", "2027-01-10"), fee("feb", "2027-02-10"), fee("mar", "2027-03-10")];
const grp = { id: "g1", date: "2026-11-10", items: feeEvents.map(e => ({ sourceType: "feePeriod", sourceId: e.sourceId })) };
const month = (monthKey, groups) => buildReadiness({ events: feeEvents, commitments: [], monthKey, monthBudget: 65000, today, groups });

test("PA12: grouped instalments are one CASH line in the group's month; BUDGET keeps only that month's own share", () => {
  const r = month("2026-11", [grp]);
  assert.equal(r.spendingRows.length, 1);
  const row = r.spendingRows[0];
  assert.equal(row.label, "School fees ×5");
  assert.equal(row.cash, 25000);
  assert.equal(row.budget, 5000);
  assert.match(row.sub, /Paid together 10 Nov/);
  assert.equal(r.cashNeeded, 25000);
  assert.equal(r.budgetUsed, 5000);
});

test("PA12: later months drop the grouped instalments from CASH but still count their own BUDGET share", () => {
  const dec = month("2026-12", [grp]);
  assert.equal(dec.spendingCash, 0);
  assert.equal(dec.budgetUsed, 5000);
  assert.equal(dec.spendingRows[0].cash, 0);
  assert.match(dec.spendingRows[0].sub, /Paid together 10 Nov/);
  assert.equal(month("2027-03", [grp]).spendingCash, 0);
});

test("without the group nothing changes: each month carries its own instalment", () => {
  assert.equal(month("2026-12", []).spendingCash, 5000);
  assert.equal(month("2026-11", []).cashNeeded, 5000);
});

test("a group paid later than due: cash in the payment month, budget in the due month", () => {
  const late = { id: "g2", date: "2026-12-20", items: [{ sourceType: "feePeriod", sourceId: "nov" }, { sourceType: "feePeriod", sourceId: "dec" }] };
  const nov = month("2026-11", [late]);
  assert.equal(nov.spendingCash, 0);
  assert.equal(nov.budgetUsed, 5000);
  const dec = month("2026-12", [late]);
  assert.equal(dec.spendingCash, 10000);
  assert.equal(dec.budgetUsed, 5000);
});

test("a grouped instalment that is paid leaves the group's total", () => {
  const paidNov = feeEvents.map(e => e.sourceId === "nov" ? { ...e, status: "paid" } : e);
  const r = buildReadiness({ events: paidNov, commitments: [], monthKey: "2026-11", monthBudget: 65000, today, groups: [grp] });
  assert.equal(r.spendingRows[0].cash, 20000);
  assert.equal(r.spendingRows[0].budget, 0);
});

import { createSpread } from "./spread.js";
const gymEvent = { category: "committedSpending", status: "unpaid", recurs: true, sourceType: "membership", sourceId: "gym", name: "Gym XYZ", amount: 9000, date: "2026-11-15" };
const gymSpread = createSpread({ key: "membership:gym", label: "Gym XYZ", amount: 9000, startMonth: "2026-11", months: 3, cashDate: "2026-11-15", genId: () => "sp1" }).spread;
const withSpread = (monthKey, spreads = [gymSpread]) => buildReadiness({ events: [gymEvent], commitments: [], monthKey, monthBudget: 65000, today, spreads });

test("PA6/PA14: in the cash month the full ₹9,000 is CASH and only the ₹3,000 share is BUDGET", () => {
  const r = withSpread("2026-11");
  assert.equal(r.spendingCash, 9000);
  assert.equal(r.budgetUsed, 3000);
  assert.equal(r.spendingRows.length, 1);
});

test("PA15: later months show CASH ₹0 and the ₹3,000 BUDGET share, with 'Spread 2 of 3'", () => {
  const dec = withSpread("2026-12");
  assert.equal(dec.spendingCash, 0);
  assert.equal(dec.budgetUsed, 3000);
  assert.equal(dec.spendingRows.length, 1, "the recurring projection must not also count");
  assert.match(dec.spendingRows[0].sub, /Spread 2 of 3/);
  assert.match(dec.spendingRows[0].sub, /15 Nov/);
  assert.equal(withSpread("2027-01").spendingRows[0].sub.startsWith("Spread 3 of 3"), true);
});

test("after the spread ends the item is an ordinary monthly estimate again; without a spread nothing changes", () => {
  assert.equal(withSpread("2027-02").spendingCash, 9000);
  assert.equal(withSpread("2026-12", []).spendingCash, 9000);
  assert.equal(withSpread("2026-11", []).budgetUsed, 9000);
});

test("a spread of an already-paid payment (no event) still shows its budget share, with CASH 0", () => {
  const paid = createSpread({ label: "Insurance", amount: 24600, startMonth: "2026-10", months: 12, cashDate: "2026-10-01", genId: () => "sp2" }).spread;
  const r = buildReadiness({ events: [], commitments: [], monthKey: "2026-11", monthBudget: 65000, today, spreads: [paid] });
  assert.equal(r.spendingCash, 0);
  assert.equal(r.budgetUsed, 2050);
  assert.match(r.spendingRows[0].sub, /Spread 2 of 12 · paid 1 Oct/);
});
