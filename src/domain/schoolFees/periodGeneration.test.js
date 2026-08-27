import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFeePeriods } from "./periodGeneration.js";

// Test 1 — normal June–April school year, single rate.
test("generates 11 periods for a June-to-April school year at a single rate", () => {
  const periods = generateFeePeriods("2026-06-01", "2027-04-30", [
    { from: "2026-06", to: "2027-04", monthlyRate: 4500 },
  ]);
  assert.equal(periods.length, 11);
  assert.equal(periods[0].label, "June 2026");
  assert.equal(periods[0].periodStart, "2026-06-01");
  assert.equal(periods[0].periodEnd, "2026-06-30");
  assert.equal(periods[10].label, "April 2027");
  assert.equal(periods.every(p => p.obligationAmount === 4500), true);
  const total = periods.reduce((s, p) => s + p.obligationAmount, 0);
  assert.equal(total, 49500); // matches the locked example exactly
});

// Test 2 — multiple rate rules within one school year.
test("applies different rates to different months within the same school year", () => {
  const periods = generateFeePeriods("2026-06-01", "2027-04-30", [
    { from: "2026-06", to: "2026-12", monthlyRate: 4500 },
    { from: "2027-01", to: "2027-04", monthlyRate: 5000 },
  ]);
  const dec = periods.find(p => p.label === "December 2026");
  const jan = periods.find(p => p.label === "January 2027");
  assert.equal(dec.obligationAmount, 4500);
  assert.equal(jan.obligationAmount, 5000);
});

// Test 3 — individual month override does not affect other months.
// generateFeePeriods has no update path at all (by design, see file header),
// so this test proves the *shape* supports independent override: mutating
// one returned period's obligationAmount must not affect any sibling.
test("overriding one generated period's amount does not affect sibling periods", () => {
  const periods = generateFeePeriods("2026-06-01", "2026-08-31", [
    { from: "2026-06", to: "2026-08", monthlyRate: 4500 },
  ]);
  const sep = periods.find(p => p.label === "July 2026");
  sep.obligationAmount = 5000; // simulates a WP-4 edit on the returned record
  const june = periods.find(p => p.label === "June 2026");
  const aug = periods.find(p => p.label === "August 2026");
  assert.equal(june.obligationAmount, 4500);
  assert.equal(aug.obligationAmount, 4500);
  assert.equal(periods.find(p => p.label === "July 2026").obligationAmount, 5000);
});

// Test 4 — new school year does not mutate a previous year's periods.
// generateFeePeriods takes no reference to any prior schedule/periods at
// all, so two independent calls are, by construction, fully independent
// arrays with fully independent (new) ids and objects.
test("generating a new school year never touches a previous year's period objects", () => {
  const yearOne = generateFeePeriods("2025-06-01", "2026-04-30", [
    { from: "2025-06", to: "2026-04", monthlyRate: 4200 },
  ]);
  const yearOneSnapshot = JSON.parse(JSON.stringify(yearOne));

  const yearTwo = generateFeePeriods("2026-06-01", "2027-04-30", [
    { from: "2026-06", to: "2027-04", monthlyRate: 4500 },
  ]);
  yearTwo[0].obligationAmount = 999999; // mutate year two aggressively

  assert.deepEqual(yearOne, yearOneSnapshot); // year one, untouched
  const yearOneIds = new Set(yearOne.map(p => p.id));
  const yearTwoIds = new Set(yearTwo.map(p => p.id));
  const overlap = [...yearOneIds].filter(id => yearTwoIds.has(id));
  assert.equal(overlap.length, 0); // no shared identity between years
});

// Test 5 — missing rate-rule coverage is rejected, not guessed.
test("throws when a month in range has no covering rate rule", () => {
  assert.throws(
    () => generateFeePeriods("2026-06-01", "2027-04-30", [
      { from: "2026-06", to: "2026-08", monthlyRate: 4500 },
      // gap: no rule for Sept 2026 – April 2027
    ]),
    /no rate rule covers 2026-09/
  );
});

// Test 6 — persistence round-trip (JSON serialize/deserialize preserves shape).
// A full localStorage round-trip requires the real App.jsx runtime; this
// test verifies the one thing periodGeneration.js is responsible for that
// persistence depends on — every field survives JSON.stringify/parse
// losslessly, with no functions, undefined, or non-serializable values.
test("generated periods survive a JSON round-trip losslessly", () => {
  const periods = generateFeePeriods("2026-06-01", "2026-08-31", [
    { from: "2026-06", to: "2026-08", monthlyRate: 4500 },
  ]);
  const roundTripped = JSON.parse(JSON.stringify(periods));
  assert.deepEqual(roundTripped, periods);
  for (const p of roundTripped) {
    assert.equal(typeof p.id, "string");
    assert.equal(typeof p.obligationAmount, "number");
    assert.equal(Array.isArray(p.settlementLinks), true);
    assert.equal(p.startingStateDeclared, false);
  }
});

// Extra: schedule/rate vs. individual obligation period distinction —
// confirms rateRules themselves are never mutated or embedded by reference
// into the generated periods (each period only carries a resolved amount).
test("generated periods do not retain any reference back to the rateRules array", () => {
  const rateRules = [{ from: "2026-06", to: "2026-08", monthlyRate: 4500 }];
  const periods = generateFeePeriods("2026-06-01", "2026-08-31", rateRules);
  rateRules[0].monthlyRate = 999999; // mutate the rule after generation
  assert.equal(periods[0].obligationAmount, 4500); // periods unaffected
});
