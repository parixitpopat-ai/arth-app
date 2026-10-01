import { test } from "node:test";
import assert from "node:assert/strict";
import { getSavingRateSummary } from "./savingRate.js";

test("matches the handoff's own worked example exactly: income 1,20,000, forecast 39,100, EMI 22,400 -> 49%", () => {
  const r = getSavingRateSummary(120000, 39100, 22400, 5000);
  assert.equal(r.kept, 58500);
  assert.equal(r.rate, 49);
  assert.equal(r.sipAmount, 5000, "SIP is a caption only, never subtracted a second time");
});

test("rate is null (not a fabricated 0%) when income is zero", () => {
  const r = getSavingRateSummary(0, 1000, 500);
  assert.equal(r.rate, null);
  assert.equal(r.kept, -1500, "kept is still a real (negative) number even when rate can't be expressed as a percentage");
});

test("a negative kept amount (spending + EMI exceed income) produces a negative rate, not clamped", () => {
  const r = getSavingRateSummary(10000, 9000, 3000);
  assert.equal(r.kept, -2000);
  assert.equal(r.rate, -20);
});
