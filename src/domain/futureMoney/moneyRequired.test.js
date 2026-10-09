import { test } from "node:test";
import assert from "node:assert/strict";
import { getMoneyRequiredForPeriod, classifyCashBuffer } from "./moneyRequired.js";

const ev = (category, amount, extra = {}) => ({ sourceType: "x", sourceId: String(Math.random()), category, amount, status: "upcoming", ...extra });
const fm = {
  committedSpending: [ev("committedSpending", 1000, { date: "2026-10-14" }), ev("committedSpending", 30000, { date: "2026-06-01" }), ev("committedSpending", 700, { status: "paid" })],
  committedSaving: [ev("committedSaving", 2000, { date: "2026-10-25" })],
  debtService: [ev("debtService", 5000, { date: "2026-10-20" })],
};

test("includes unpaid spending, saving and loan EMIs; excludes paid items", () => {
  const r = getMoneyRequiredForPeriod({ futureMoney: fm });
  assert.equal(r.spendingTotal, 31000);
  assert.equal(r.savingTotal, 2000);
  assert.equal(r.debtServiceTotal, 5000);
  assert.equal(r.total, 38000);
  assert.equal(r.count, 4);
});

test("same inputs give the same answer for any caller (Home and Outlook cannot differ)", () => {
  assert.deepEqual(getMoneyRequiredForPeriod({ futureMoney: fm }), getMoneyRequiredForPeriod({ futureMoney: fm }));
});

test("a horizon counts overdue and due-within-window items only", () => {
  const r = getMoneyRequiredForPeriod({ futureMoney: fm, today: "2026-10-09", horizonDays: 3 });
  assert.equal(r.spendingTotal, 30000); // overdue school fee counts; the 14 Oct bill is 5 days away -> outside a 3-day window
  assert.equal(getMoneyRequiredForPeriod({ futureMoney: fm, today: "2026-10-09", horizonDays: 7 }).spendingTotal, 31000);
  assert.equal(r.total, r.spendingTotal + r.savingTotal + r.debtServiceTotal);
});

test("empty / missing sections are zero, never NaN", () => {
  assert.equal(getMoneyRequiredForPeriod({}).total, 0);
  assert.equal(getMoneyRequiredForPeriod({ futureMoney: { committedSpending: [{ amount: "x" }] } }).total, 0);
});

test("buffer classification uses one set of thresholds", () => {
  assert.equal(classifyCashBuffer({ available: 0, required: 36000 }).level, "risk");
  assert.equal(classifyCashBuffer({ available: 38000, required: 36000 }).level, "tight");
  assert.equal(classifyCashBuffer({ available: 45000, required: 36000 }).level, "watchful");
  assert.equal(classifyCashBuffer({ available: 100000, required: 36000 }).level, "comfortable");
  assert.equal(classifyCashBuffer({ available: 100000, required: 36000, forecastNegative: true }).level, "risk");
  assert.equal(classifyCashBuffer({ available: 100, required: 36000 }).buffer, -35900);
});
