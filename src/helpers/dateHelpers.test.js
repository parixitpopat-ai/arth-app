import { test } from "node:test";
import assert from "node:assert/strict";
import { toLocalDateStr, todayStr, addMonthsClamped } from "./dateHelpers.js";
import { getNextRecurringOccurrence } from "../domain/bills/commitments.js";

test("toLocalDateStr is the local calendar day, including just after midnight", () => {
  assert.equal(toLocalDateStr(new Date(2026, 8, 26, 0, 30)), "2026-09-26");
  assert.equal(toLocalDateStr(new Date(2026, 8, 26, 23, 59)), "2026-09-26");
  assert.equal(toLocalDateStr(new Date(2026, 0, 1, 0, 5)), "2026-01-01");
});

test("todayStr matches the local date now", () => {
  const n = new Date();
  assert.equal(todayStr(), `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
});

test("a recurring due date is the local day it falls on", () => {
  assert.equal(getNextRecurringOccurrence({ day: 5 }, new Date(2026, 8, 26, 0, 30)), "2026-10-05");
  assert.equal(getNextRecurringOccurrence({ day: 26 }, new Date(2026, 8, 26, 0, 30)), "2026-09-26");
});

test("addMonthsClamped keeps the day-of-month when it exists in the target month", () => {
  assert.equal(addMonthsClamped("2026-06-15", 1), "2026-07-15");
  assert.equal(addMonthsClamped("2026-06-15", 3), "2026-09-15");
});

test("addMonthsClamped clamps a day-29/30/31 start into a shorter target month, not overflowing past it", () => {
  assert.equal(addMonthsClamped("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonthsClamped("2026-08-31", 1), "2026-09-30");
  assert.equal(addMonthsClamped("2028-02-29", 12), "2029-02-28");
});

test("addMonthsClamped with 0 or no dateStr is a safe no-op", () => {
  assert.equal(addMonthsClamped("2026-06-15", 0), "2026-06-15");
  assert.equal(addMonthsClamped("", 3), "");
  assert.equal(addMonthsClamped(null, 3), null);
});
