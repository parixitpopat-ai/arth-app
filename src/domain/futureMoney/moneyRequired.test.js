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

test("Home's 30-day range: overdue and day 30 included, day 31 excluded, undated counted as due now", () => {
  const f = {
    committedSpending: [
      ev("committedSpending", 100, { date: "2026-09-01" }), // overdue
      ev("committedSpending", 200, { date: "2026-11-08" }), // exactly 30 days after 9 Oct
      ev("committedSpending", 400, { date: "2026-11-09" }), // day 31
      ev("committedSpending", 800, {}), // no date
    ],
    committedSaving: [], debtService: [ev("debtService", 1600, { date: "2026-11-20" })],
  };
  const r = getMoneyRequiredForPeriod({ futureMoney: f, today: "2026-10-09", horizonDays: 30 });
  assert.equal(r.total, 100 + 200 + 800);
  assert.equal(getMoneyRequiredForPeriod({ futureMoney: f }).total, 100 + 200 + 400 + 800 + 1600); // broader (Outlook) period
});

test("a zero-amount entry (an empty card statement) is not a commitment and does not appear in the count", () => {
  const f = { committedSpending: [ev("committedSpending", 0, "2026-10-05"), ev("committedSpending", 500, "2026-10-14")], committedSaving: [], debtService: [] };
  const r = getMoneyRequiredForPeriod({ futureMoney: f });
  assert.equal(r.count, 1);
  assert.equal(r.total, 500);
});
