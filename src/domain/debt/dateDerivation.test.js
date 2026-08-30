import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNextOccurrenceOfDay } from "./dateDerivation.js";

test("returns this month's occurrence when the day hasn't passed yet", () => {
  const today = new Date(2026, 7, 10); // 10 Aug 2026 (month is 0-indexed)
  assert.equal(computeNextOccurrenceOfDay(today, 15), "2026-08-15");
});

test("rolls to next month when the day has already passed", () => {
  const today = new Date(2026, 7, 20); // 20 Aug 2026
  assert.equal(computeNextOccurrenceOfDay(today, 15), "2026-09-15");
});

test("boundary: the day IS today — counts as this occurrence, not rolled forward", () => {
  const today = new Date(2026, 7, 15); // exactly 15 Aug 2026
  assert.equal(computeNextOccurrenceOfDay(today, 15), "2026-08-15");
});

test("boundary: day 31 requested in a 30-day month rolls into the next month (mirrors existing app date-math convention)", () => {
  const today = new Date(2026, 8, 5); // 5 Sep 2026 — September has 30 days
  // new Date(2026, 8, 31) in JS rolls over to Oct 1 automatically — this is
  // the exact behavior the app's own CC-EMI-purchase code already relies on
  // elsewhere; this function must match it, not diverge from it.
  assert.equal(computeNextOccurrenceOfDay(today, 31), "2026-10-01");
});

test("boundary: day 29 in a non-leap February", () => {
  const today = new Date(2027, 1, 5); // 5 Feb 2027, not a leap year
  // Feb 2027 has 28 days — day 29 rolls to Mar 1
  assert.equal(computeNextOccurrenceOfDay(today, 29), "2027-03-01");
});

test("boundary: year rollover — December to January", () => {
  const today = new Date(2026, 11, 20); // 20 Dec 2026
  assert.equal(computeNextOccurrenceOfDay(today, 10), "2027-01-10");
});

test("returns null for an invalid day (0, negative, >31, non-integer)", () => {
  const today = new Date(2026, 7, 10);
  assert.equal(computeNextOccurrenceOfDay(today, 0), null);
  assert.equal(computeNextOccurrenceOfDay(today, -5), null);
  assert.equal(computeNextOccurrenceOfDay(today, 32), null);
  assert.equal(computeNextOccurrenceOfDay(today, 15.5), null);
  assert.equal(computeNextOccurrenceOfDay(today, null), null);
  assert.equal(computeNextOccurrenceOfDay(today, undefined), null);
});

test("returns null for an invalid reference date", () => {
  assert.equal(computeNextOccurrenceOfDay(new Date("not a date"), 15), null);
  assert.equal(computeNextOccurrenceOfDay(null, 15), null);
});

test("never returns a UTC-shifted date near local midnight — stays in local calendar terms", () => {
  // A reference date constructed via local Date(y,m,d) components, checked
  // against the same local components in the output — proves this function
  // never round-trips through toISOString()'s UTC conversion.
  const today = new Date(2026, 7, 15, 23, 45); // 11:45pm local time
  assert.equal(computeNextOccurrenceOfDay(today, 15), "2026-08-15");
});
