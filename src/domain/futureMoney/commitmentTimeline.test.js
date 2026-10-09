import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCommitmentTimeline } from "./commitmentTimeline.js";

let n = 0;
const ev = (category, amount, date, extra = {}) => ({ sourceType: "x", sourceId: String(++n), category, amount, date, status: "upcoming", name: "e" + n, ...extra });
// Designer's worked example, today = 9 Oct 2026, available 1,12,000
const futureMoney = {
  committedSpending: [
    ev("committedSpending", 12000, "2026-09-28"), // credit card bill, overdue
    ev("committedSpending", 45000, "2026-10-12"), ev("committedSpending", 30000, "2026-10-15"), ev("committedSpending", 28000, "2026-10-22"),
    ev("committedSpending", 999, "2026-10-01", { status: "paid" }), // paid: never listed
  ],
  committedSaving: [ev("committedSaving", 15000, "2026-11-01")],
  debtService: [ev("debtService", 5000, "2026-10-18")],
};
const tl = args => buildCommitmentTimeline({ futureMoney, openingBalance: 112000, today: "2026-10-09", ...args });

test("overdue first, then by date, with the balance left after each", () => {
  const t = tl({});
  assert.deepEqual(t.rows.map(r => r.amount), [12000, 45000, 30000, 5000, 28000, 15000]);
  assert.deepEqual(t.rows.map(r => r.balanceAfter), [100000, 55000, 25000, 20000, -8000, -23000]);
  assert.equal(t.rows[0].overdue, true);
  assert.equal(t.rows[1].overdue, false);
});

test("the loan EMI is in the list, and the last balance equals the Buffer", () => {
  const t = tl({});
  assert.ok(t.rows.some(r => r.amount === 5000 && r.event.category === "debtService"));
  assert.equal(t.buffer, -23000);
  assert.equal(t.rows[t.rows.length - 1].balanceAfter, t.buffer);
});

test("overdue + upcoming = Needed; paid items are never counted", () => {
  const t = tl({});
  assert.equal(t.neededTotal, 135000);
  assert.equal(t.overdueTotal, 12000);
  assert.equal(t.upcomingTotal, 123000);
  assert.equal(t.overdueTotal + t.upcomingTotal, t.neededTotal);
});

test("items beyond the horizon are summed as 'later', so available - shown - later = Buffer", () => {
  const t = tl({ horizonDays: 15 }); // 1 Nov (23 days) and 22 Oct (13 days -> shown) ... 1 Nov is later
  assert.equal(t.laterCount, 1);
  assert.equal(t.laterTotal, 15000);
  const shownTotal = t.rows.reduce((s, r) => s + r.amount, 0);
  assert.equal(112000 - shownTotal - t.laterTotal, t.buffer);
});

test("undated commitments count as due now and sort right after overdue", () => {
  const fm = { committedSpending: [ev("committedSpending", 700, null), ev("committedSpending", 100, "2026-09-01"), ev("committedSpending", 200, "2026-10-10")], committedSaving: [], debtService: [] };
  const t = buildCommitmentTimeline({ futureMoney: fm, openingBalance: 5000, today: "2026-10-09" });
  assert.deepEqual(t.rows.map(r => r.amount), [100, 700, 200]);
});

test("nothing open: empty list, buffer = available", () => {
  const t = buildCommitmentTimeline({ futureMoney: {}, openingBalance: 500, today: "2026-10-09" });
  assert.equal(t.rows.length, 0);
  assert.equal(t.buffer, 500);
});
