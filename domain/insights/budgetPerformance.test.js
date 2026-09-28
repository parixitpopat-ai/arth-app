// domain/insights/budgetPerformance.test.js
// Characterization + unit tests for classifyPersonStatus and buildPersonRows, promoted here
// from src/screens/BudgetInsights.test.js (WP8), plus new coverage for
// getHouseholdForecastSummary.

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyPersonStatus, buildPersonRows, getHouseholdForecastSummary } from "./budgetPerformance.js";

test("person status: zero budget — distinct 'no budget set' state, not run through health thresholds", () => {
  const r = classifyPersonStatus(0, 500);
  assert.equal(r.hasBudget, false);
  assert.equal(r.status, "no_budget");
});

test("person status: zero spend, real budget — within budget", () => {
  const r = classifyPersonStatus(10000, 0);
  assert.equal(r.hasBudget, true);
  assert.equal(r.status, "onTrack");
  assert.equal(r.variance, 10000);
});

test("person status: partial spend, comfortably under — within budget", () => {
  const r = classifyPersonStatus(10000, 4000);
  assert.equal(r.status, "onTrack");
  assert.equal(r.variance, 6000);
});

test("person status: partial spend, close to threshold — approaching budget", () => {
  const r = classifyPersonStatus(10000, 9200);
  assert.equal(r.status, "close");
});

test("person status: exactly at budget — 0% margin falls under the <10 'close' rule", () => {
  const r = classifyPersonStatus(10000, 10000);
  assert.equal(r.variance, 0);
  assert.equal(r.isOver, false);
  assert.equal(r.status, "close");
});

test("person status: over budget — over budget", () => {
  const r = classifyPersonStatus(10000, 13000);
  assert.equal(r.isOver, true);
  assert.equal(r.status, "over");
});

test("buildPersonRows: uses canonical adapter functions only, filters to relevant people, sorts by spend desc", () => {
  const people = [
    { id: "p1", name: "Alice", spendBudget: 10000, spendBudgetOverrides: {} },
    { id: "p2", name: "Bob", spendBudget: 5000, spendBudgetOverrides: {} },
    { id: "p3", name: "Carol", spendBudget: 0, spendBudgetOverrides: {} },
  ];
  const periodTxns = [
    { type: "expense", date: "2026-08-05", people: { p1: { amount: 3000, mode: "spent_on" } } },
    { type: "expense", date: "2026-08-06", people: { p2: { amount: 6000, mode: "spent_on" } } },
  ];
  const rows = buildPersonRows(people, periodTxns, "2026-08");
  assert.equal(rows.length, 2, "Carol excluded — zero budget AND zero spend");
  assert.equal(rows[0].person.id, "p2", "Bob spent more (₹6000), sorted first");
  assert.equal(rows[0].actual, 6000);
  assert.equal(rows[0].status, "over");
  assert.equal(rows[1].person.id, "p1");
  assert.equal(rows[1].actual, 3000);
  assert.equal(rows[1].status, "onTrack");
});

test("buildPersonRows: respects mode:spent_on vs mode:owes exclusion (CR-ACC-BUD-001)", () => {
  const people = [{ id: "p1", name: "Alice", spendBudget: 10000, spendBudgetOverrides: {} }];
  const periodTxns = [
    { type: "expense", date: "2026-08-05", people: { p1: { amount: 3000, mode: "spent_on" } } },
    { type: "expense", date: "2026-08-06", people: { p1: { amount: 9000, mode: "owes" } } },
  ];
  const rows = buildPersonRows(people, periodTxns, "2026-08");
  assert.equal(rows[0].actual, 3000, "the mode:owes 9000 must NOT be counted — receivable, not spend");
});

test("getHouseholdForecastSummary: worked example — pace extrapolation vs budget", () => {
  // 10 days elapsed of 30, spent 4000 so far, budget 15000 -> pace 400/day * 30 = 12000
  const r = getHouseholdForecastSummary(4000, 10, 30, 15000);
  assert.equal(r.projectedMonthEnd, 12000);
  assert.equal(r.isProjectedOver, false);
  assert.equal(r.status, "onTrack");
});

test("getHouseholdForecastSummary: projected over budget", () => {
  const r = getHouseholdForecastSummary(8000, 10, 30, 15000); // pace 800/day * 30 = 24000
  assert.equal(r.projectedMonthEnd, 24000);
  assert.equal(r.isProjectedOver, true);
  assert.equal(r.status, "over");
});
