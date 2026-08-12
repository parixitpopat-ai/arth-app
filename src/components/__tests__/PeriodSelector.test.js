// WP-2 — PeriodSelector logic tests.
//
// Imports only plain .js modules (shiftMonthKey.js, calendarMonth.js) — no
// JSX parsing required, so this runs under plain `node --test` without any
// build/loader step. shiftMonthKey was extracted out of PeriodSelector.jsx
// specifically to make this possible.

import test from "node:test";
import assert from "node:assert/strict";
import { shiftMonthKey } from "../shiftMonthKey.js";
import { getCalendarMonthBounds } from "../../domain/financialCalendar/calendarMonth.js";

test("label source: PeriodSelector's displayed label comes from getCalendarMonthBounds, not local formatting", () => {
  const { label } = getCalendarMonthBounds("2026-08");
  assert.equal(label, "August 2026");
});

test("previous month: standard case", () => {
  assert.equal(shiftMonthKey("2026-08", -1), "2026-07");
});

test("next month: standard case", () => {
  assert.equal(shiftMonthKey("2026-08", 1), "2026-09");
});

test("December -> January rollover (next)", () => {
  assert.equal(shiftMonthKey("2026-12", 1), "2027-01");
});

test("January -> December rollover (previous)", () => {
  assert.equal(shiftMonthKey("2027-01", -1), "2026-12");
});