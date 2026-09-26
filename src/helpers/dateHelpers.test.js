import { test } from "node:test";
import assert from "node:assert/strict";
import { toLocalDateStr, todayStr } from "./dateHelpers.js";
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
