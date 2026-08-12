import test from "node:test";
import assert from "node:assert/strict";
import { getCalendarMonthBounds } from "../calendarMonth.js";

test("standard month: August 2026", () => {
  const result = getCalendarMonthBounds("2026-08");
  assert.equal(result.start, "2026-08-01");
  assert.equal(result.end, "2026-08-31");
  assert.equal(result.label, "August 2026");
});

test("February in a leap year: 2024", () => {
  const result = getCalendarMonthBounds("2024-02");
  assert.equal(result.start, "2024-02-01");
  assert.equal(result.end, "2024-02-29");
  assert.equal(result.label, "February 2024");
});

test("February in a non-leap year: 2026", () => {
  const result = getCalendarMonthBounds("2026-02");
  assert.equal(result.start, "2026-02-01");
  assert.equal(result.end, "2026-02-28");
  assert.equal(result.label, "February 2026");
});

test("December / year boundary: December 2026", () => {
  const result = getCalendarMonthBounds("2026-12");
  assert.equal(result.start, "2026-12-01");
  assert.equal(result.end, "2026-12-31");
  assert.equal(result.label, "December 2026");
});

test("January immediately after a December, in a fresh year: January 2027", () => {
  const result = getCalendarMonthBounds("2027-01");
  assert.equal(result.start, "2027-01-01");
  assert.equal(result.end, "2027-01-31");
  assert.equal(result.label, "January 2027");
});

test("label formatting: single-digit month key is parsed correctly, not read literally", () => {
  const result = getCalendarMonthBounds("2026-01");
  assert.equal(result.label, "January 2026");
  assert.equal(result.start, "2026-01-01");
});