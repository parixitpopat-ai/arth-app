import { test } from "node:test";
import assert from "node:assert/strict";
import { isWithinPaymentsHorizon } from "./horizon.js";

test("isWithinPaymentsHorizon: an overdue event (past date) stays in Payments regardless of age", () => {
  assert.equal(isWithinPaymentsHorizon({ date: "2026-01-01" }, "2026-09-28"), true);
});

test("isWithinPaymentsHorizon: exactly at the 30-day boundary is still Payments", () => {
  assert.equal(isWithinPaymentsHorizon({ date: "2026-10-28" }, "2026-09-28"), true);
});

test("isWithinPaymentsHorizon: 31 days out is Outlook, not Payments", () => {
  assert.equal(isWithinPaymentsHorizon({ date: "2026-10-29" }, "2026-09-28"), false);
});

test("isWithinPaymentsHorizon: due today is Payments", () => {
  assert.equal(isWithinPaymentsHorizon({ date: "2026-09-28" }, "2026-09-28"), true);
});

test("isWithinPaymentsHorizon: an event with no date at all stays in Payments, never silently in Outlook", () => {
  assert.equal(isWithinPaymentsHorizon({ date: null }, "2026-09-28"), true);
  assert.equal(isWithinPaymentsHorizon({}, "2026-09-28"), true);
});

test("isWithinPaymentsHorizon: a custom horizonDays is honored", () => {
  assert.equal(isWithinPaymentsHorizon({ date: "2026-10-05" }, "2026-09-28", 7), true);
  assert.equal(isWithinPaymentsHorizon({ date: "2026-10-06" }, "2026-09-28", 7), false);
});
