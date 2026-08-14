// domain/allocations/person.characterization.test.js
//
// Priority 1 (Person Budget consumer migration) — characterization pass.
// Proves getPersonPlanningAllocation() produces byte-identical output to
// the inline formula duplicated at 4 live call sites in App.jsx, BEFORE
// any repoint. Same discipline as household.characterization.test.js.
//
// The 4 sites, confirmed by direct read this session:
//   1. App.jsx ~1744 — budgetAlerts (person-overspend notification)
//   2. App.jsx ~12774 — Budgets sub-tab, Month view
//   3. App.jsx ~12869 — Budgets sub-tab, Year view, annual sum (months.reduce)
//   4. App.jsx ~12873 — Budgets sub-tab, Year view, per-month value (monthSpends.map)
//
// All 4 use the exact same expression:
//   Number(p.spendBudgetOverrides?.[monthKey] ?? p.spendBudget ?? 0)
// — differing only in which monthKey is passed (viewMonth for sites 1-2,
// each month's own key for sites 3-4, called once per month in a loop).
//
// This test suite does not touch App.jsx. It exists to make the repoint
// in Step 2 a verified no-op on behavior, not an assumed one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { getPersonPlanningAllocation } from "./adapter.js";

// The exact inline formula as it appears at all 4 sites — reproduced
// here ONLY as the "legacy" comparison target for this test file, not
// as production code. If App.jsx's formula ever changes, this line must
// be updated to match before trusting this suite again.
function legacyInlineFormula(person, monthKey) {
  return Number(person?.spendBudgetOverrides?.[monthKey] ?? person?.spendBudget ?? 0);
}

// Representative fixture covering every branch the real people array can hit
const FIXTURE_PEOPLE = [
  { id: "p1", name: "Has override for target month", spendBudget: 10000, spendBudgetOverrides: { "2026-08": 8000 } },
  { id: "p2", name: "No override, flat only", spendBudget: 5000, spendBudgetOverrides: {} },
  { id: "p3", name: "No spendBudgetOverrides key at all", spendBudget: 3000 },
  { id: "p4", name: "Explicit 0 override (real zero, not fallback)", spendBudget: 10000, spendBudgetOverrides: { "2026-08": 0 } },
  { id: "p5", name: "No spendBudget, no override — everything undefined", spendBudgetOverrides: {} },
  { id: "p6", name: "Override exists but for a different month", spendBudget: 7000, spendBudgetOverrides: { "2026-07": 6000 } },
  { id: "p7", name: "spendBudget is 0, no override", spendBudget: 0, spendBudgetOverrides: {} },
];

const TARGET_MONTH = "2026-08";

test("characterization: adapter matches legacy inline formula for every fixture person, target month", () => {
  for (const person of FIXTURE_PEOPLE) {
    const legacy = legacyInlineFormula(person, TARGET_MONTH);
    const adapter = getPersonPlanningAllocation(person, TARGET_MONTH);
    assert.equal(
      adapter,
      legacy,
      `Mismatch for "${person.name}" (${person.id}): legacy=${legacy}, adapter=${adapter}`
    );
  }
});

test("characterization: matches across a full 12-month loop (site 3/4 shape — months.reduce / monthSpends.map)", () => {
  const person = FIXTURE_PEOPLE[0]; // has an override only for 2026-08
  const months = [
    "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03",
  ];
  for (const monthKey of months) {
    const legacy = legacyInlineFormula(person, monthKey);
    const adapter = getPersonPlanningAllocation(person, monthKey);
    assert.equal(adapter, legacy, `Mismatch for month ${monthKey}: legacy=${legacy}, adapter=${adapter}`);
  }
});

test("characterization: site-3-shape — sum across 12 months matches (personAnnualBudget pattern)", () => {
  const person = FIXTURE_PEOPLE[0];
  const months = [
    { key: "2026-04" }, { key: "2026-05" }, { key: "2026-06" }, { key: "2026-07" },
    { key: "2026-08" }, { key: "2026-09" }, { key: "2026-10" }, { key: "2026-11" },
    { key: "2026-12" }, { key: "2027-01" }, { key: "2027-02" }, { key: "2027-03" },
  ];
  const legacySum = months.reduce((s, m) => s + legacyInlineFormula(person, m.key), 0);
  const adapterSum = months.reduce((s, m) => s + getPersonPlanningAllocation(person, m.key), 0);
  assert.equal(adapterSum, legacySum);
});

test("characterization: null/undefined person object does not throw (defensive — matches optional-chaining behavior)", () => {
  assert.equal(getPersonPlanningAllocation(null, TARGET_MONTH), legacyInlineFormula(null, TARGET_MONTH));
  assert.equal(getPersonPlanningAllocation(undefined, TARGET_MONTH), legacyInlineFormula(undefined, TARGET_MONTH));
});
