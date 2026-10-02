import { test } from "node:test";
import assert from "node:assert/strict";
import { getPolicyYearRange, getPolicyYearLabel } from "./policyYear.js";

test("getPolicyYearRange: annual policy — F2's own example (renews 12 Nov 2026 -> policy year 12 Nov 2025 - 11 Nov 2026)", () => {
  const range = getPolicyYearRange("2026-11-12", "annual");
  assert.deepEqual(range, { start: "2025-11-12", end: "2026-11-11" });
});

test("getPolicyYearRange: halfyearly steps back 6 months", () => {
  assert.deepEqual(getPolicyYearRange("2026-11-12", "halfyearly"), { start: "2026-05-12", end: "2026-11-11" });
});

test("getPolicyYearRange: quarterly steps back 3 months", () => {
  assert.deepEqual(getPolicyYearRange("2026-11-12", "quarterly"), { start: "2026-08-12", end: "2026-11-11" });
});

test("getPolicyYearRange: monthly steps back 1 month", () => {
  assert.deepEqual(getPolicyYearRange("2026-11-12", "monthly"), { start: "2026-10-12", end: "2026-11-11" });
});

test("getPolicyYearRange: unknown/missing frequency defaults to annual", () => {
  assert.deepEqual(getPolicyYearRange("2026-11-12", undefined), { start: "2025-11-12", end: "2026-11-11" });
});

test("getPolicyYearRange: day-31 start clamps into a shorter month, never overflows", () => {
  // 31 Mar, annual back 12 months -> 31 Mar of the previous year, no overflow risk; exercise a
  // genuinely short-month case instead: 31 Jan renewal, quarterly back 3 months -> 31 Oct (fine),
  // but halfyearly back 6 months from 31 Mar lands on 30 Sep (Sep has 30 days).
  assert.deepEqual(getPolicyYearRange("2027-03-31", "halfyearly"), { start: "2026-09-30", end: "2027-03-30" });
});

test("getPolicyYearRange: null/empty renewalDate returns null", () => {
  assert.equal(getPolicyYearRange(null, "annual"), null);
  assert.equal(getPolicyYearRange("", "annual"), null);
});

test("getPolicyYearLabel: formats as start-year–end-year-2-digit", () => {
  assert.equal(getPolicyYearLabel({ start: "2025-11-12", end: "2026-11-11" }), "2025–26");
  assert.equal(getPolicyYearLabel({ start: "2099-11-12", end: "2100-11-11" }), "2099–00");
});

test("getPolicyYearLabel: empty/missing range returns empty string", () => {
  assert.equal(getPolicyYearLabel(null), "");
  assert.equal(getPolicyYearLabel({}), "");
});
