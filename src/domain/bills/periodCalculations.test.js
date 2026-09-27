import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNextDueDate, computeNextPeriod } from "./periodCalculations.js";

// --- computeNextDueDate ------------------------------------------------------

test("monthly: a plain mid-month date just advances one month", () => {
  assert.equal(computeNextDueDate({ frequency: "monthly", dueDate: "2026-06-15" }), "2026-07-15");
});

test("BUG FIX: a day-31 due date stepping monthly lands on the short month's last day, not 2-3 days into the month after (Date.setMonth's silent overflow)", () => {
  assert.equal(computeNextDueDate({ frequency: "monthly", dueDate: "2026-01-31" }), "2026-02-28");
  assert.equal(computeNextDueDate({ frequency: "monthly", dueDate: "2026-03-31" }), "2026-04-30");
  assert.equal(computeNextDueDate({ frequency: "monthly", dueDate: "2026-08-31" }), "2026-09-30");
});

test("BUG FIX: a day-30 due date stepping monthly into February clamps to Feb's last day (28 or 29)", () => {
  assert.equal(computeNextDueDate({ frequency: "monthly", dueDate: "2026-01-30" }), "2026-02-28");
  assert.equal(computeNextDueDate({ frequency: "monthly", dueDate: "2027-01-30" }), "2027-02-28");
});

test("quarterly/halfyearly also clamp correctly across a day-31 boundary", () => {
  assert.equal(computeNextDueDate({ frequency: "quarterly", dueDate: "2026-11-30" }), "2027-02-28");
  assert.equal(computeNextDueDate({ frequency: "halfyearly", dueDate: "2026-08-31" }), "2027-02-28");
});

test("yearly: 29 Feb in a leap year clamps to 28 Feb the following (non-leap) year", () => {
  assert.equal(computeNextDueDate({ frequency: "annual", dueDate: "2028-02-29" }), "2029-02-28");
  assert.equal(computeNextDueDate({ frequency: "yearly", dueDate: "2028-02-29" }), "2029-02-28");
});

test("prorata billingModel bases the step on paidDate, not periodEnd/dueDate", () => {
  assert.equal(computeNextDueDate({ billingModel: "prorata", frequency: "monthly", dueDate: "2026-01-05" }, "2026-01-31"), "2026-02-28");
});

test("custom frequency with validityDays adds days directly, unaffected by the month-stepping fix", () => {
  assert.equal(computeNextDueDate({ frequency: "custom", validityDays: 45, dueDate: "2026-01-31" }), "2026-03-17");
});

test("an unrecognized frequency is a no-op, exactly as before (returns the same date)", () => {
  assert.equal(computeNextDueDate({ frequency: "biweekly", dueDate: "2026-06-15" }), "2026-06-15");
});

test("periodEnd is preferred over dueDate for a non-prorata bill", () => {
  assert.equal(computeNextDueDate({ frequency: "monthly", periodEnd: "2026-01-31", dueDate: "2026-01-15" }), "2026-02-28");
});

// --- computeNextPeriod --------------------------------------------------------

test("computeNextPeriod returns null unless billingModel is \"calendar\" with both period fields", () => {
  assert.equal(computeNextPeriod({ billingModel: "calendar", periodStart: "2026-01-01" }), null);
  assert.equal(computeNextPeriod({ frequency: "monthly", periodStart: "2026-01-01", periodEnd: "2026-01-31" }), null);
});

test("computeNextPeriod: the next calendar month, starting the day after periodEnd", () => {
  const p = computeNextPeriod({ billingModel: "calendar", frequency: "monthly", periodStart: "2026-01-01", periodEnd: "2026-01-31" });
  assert.deepEqual(p, { periodStart: "2026-02-01", periodEnd: "2026-02-28" });
});

test("BUG FIX: computeNextPeriod never overflows past a short month when the period boundary itself falls on a late day", () => {
  // periodEnd 27 Jan -> start 28 Jan; stepping monthly from the 28th must land safely in Feb/Mar,
  // not silently roll further because of the day-of-month arithmetic.
  const p = computeNextPeriod({ billingModel: "calendar", frequency: "monthly", periodStart: "2025-12-28", periodEnd: "2026-01-27" });
  assert.deepEqual(p, { periodStart: "2026-01-28", periodEnd: "2026-02-27" });
});

test("computeNextPeriod quarterly/yearly step the same safe way", () => {
  const q = computeNextPeriod({ billingModel: "calendar", frequency: "quarterly", periodStart: "2026-01-01", periodEnd: "2026-03-31" });
  assert.deepEqual(q, { periodStart: "2026-04-01", periodEnd: "2026-06-30" });
  const y = computeNextPeriod({ billingModel: "calendar", frequency: "yearly", periodStart: "2028-01-01", periodEnd: "2028-12-31" });
  assert.deepEqual(y, { periodStart: "2029-01-01", periodEnd: "2029-12-31" });
});
