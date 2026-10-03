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
