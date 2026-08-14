// Characterization tests — WP-4 Home extraction candidates.
// Proves each proposed function matches BudgetPage's legacy inline
// formula (reproduced verbatim as the comparison target) BEFORE any
// repoint. Same discipline as person.characterization.test.js.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCarryForwardMonthly,
  getSpentPercentage,
  getSafeToSpendPerDay,
  getMonthEndForecast,
  getBudgetHealthStatus,
} from "./adapter.js";

// --- Legacy formulas, reproduced verbatim from the confirmed App.jsx read ---

function legacyCarryForward(enabled, baseMonthly, prevBudget, prevSpend) {
  if (!enabled) return baseMonthly;
  return Math.max(0, baseMonthly + (prevBudget - prevSpend));
}

function legacySpentPct(spend, budget) {
  return budget > 0 ? Math.min(100, Math.round((spend / budget) * 100)) : (spend > 0 ? 100 : 0);
}

function legacySafePerDay(remaining, daysLeft, monthly) {
  return monthly > 0 ? Math.max(0, Math.round(remaining / Math.max(1, daysLeft))) : null;
}

function legacyForecast(spend, daysElapsed, daysInMonth, budget) {
  const dailyPace = daysElapsed > 0 ? spend / daysElapsed : 0;
  const projectedMonthEnd = Math.round(dailyPace * daysInMonth);
  const isProjectedOver = budget > 0 && projectedMonthEnd > budget;
  const projectedMarginPct = budget > 0 ? Math.round(((budget - projectedMonthEnd) / budget) * 100) : 0;
  return { projectedMonthEnd, isProjectedOver, projectedMarginPct };
}

function legacyHealth(isProjectedOver, projectedMarginPct) {
  return isProjectedOver ? "Over Budget" : projectedMarginPct < 10 ? "Cutting It Close" : "On Track";
}

// --- Carry-forward ---

test("carry-forward: disabled returns base unchanged", () => {
  assert.equal(resolveCarryForwardMonthly(false, 10000, 12000, 8000), legacyCarryForward(false, 10000, 12000, 8000));
});

test("carry-forward: enabled, previous month underspent — adds surplus", () => {
  assert.equal(resolveCarryForwardMonthly(true, 10000, 12000, 8000), legacyCarryForward(true, 10000, 12000, 8000));
  assert.equal(resolveCarryForwardMonthly(true, 10000, 12000, 8000), 14000);
});

test("carry-forward: enabled, previous month overspent — floors at 0, never negative", () => {
  assert.equal(resolveCarryForwardMonthly(true, 5000, 8000, 20000), legacyCarryForward(true, 5000, 8000, 20000));
  assert.equal(resolveCarryForwardMonthly(true, 5000, 8000, 20000), 0);
});

// --- Spent percentage ---

test("spent%: under budget", () => {
  assert.equal(getSpentPercentage(4000, 10000), legacySpentPct(4000, 10000));
});

test("spent%: exactly at budget", () => {
  assert.equal(getSpentPercentage(10000, 10000), legacySpentPct(10000, 10000));
});

test("spent%: over budget — clamped at 100, not 150", () => {
  assert.equal(getSpentPercentage(15000, 10000), legacySpentPct(15000, 10000));
  assert.equal(getSpentPercentage(15000, 10000), 100);
});

test("spent%: zero budget, some spend — 100%, not divide-by-zero", () => {
  assert.equal(getSpentPercentage(500, 0), legacySpentPct(500, 0));
  assert.equal(getSpentPercentage(500, 0), 100);
});

test("spent%: zero budget, zero spend — 0%", () => {
  assert.equal(getSpentPercentage(0, 0), legacySpentPct(0, 0));
});

// --- Safe-to-spend per day ---

test("safe/day: positive remaining, days left", () => {
  assert.equal(getSafeToSpendPerDay(6000, 15, 10000), legacySafePerDay(6000, 15, 10000));
});

test("safe/day: negative remaining (over budget) — floors at 0", () => {
  assert.equal(getSafeToSpendPerDay(-2000, 10, 10000), legacySafePerDay(-2000, 10, 10000));
  assert.equal(getSafeToSpendPerDay(-2000, 10, 10000), 0);
});

test("safe/day: zero budget — returns null, not a number", () => {
  assert.equal(getSafeToSpendPerDay(0, 10, 0), legacySafePerDay(0, 10, 0));
  assert.equal(getSafeToSpendPerDay(0, 10, 0), null);
});

test("safe/day: zero days left — divides by 1, not 0", () => {
  assert.equal(getSafeToSpendPerDay(3000, 0, 10000), legacySafePerDay(3000, 0, 10000));
});

// --- Forecast ---

test("forecast: on pace, under budget", () => {
  const legacy = legacyForecast(4000, 10, 30, 12000);
  const proposed = getMonthEndForecast(4000, 10, 30, 12000);
  assert.deepEqual(proposed, legacy);
});

test("forecast: pace projects over budget", () => {
  const legacy = legacyForecast(6000, 10, 30, 12000);
  const proposed = getMonthEndForecast(6000, 10, 30, 12000);
  assert.deepEqual(proposed, legacy);
  assert.equal(proposed.isProjectedOver, true);
});

test("forecast: zero days elapsed — no divide-by-zero, dailyPace treated as 0", () => {
  const legacy = legacyForecast(0, 0, 30, 12000);
  const proposed = getMonthEndForecast(0, 0, 30, 12000);
  assert.deepEqual(proposed, legacy);
});

test("forecast: zero budget — isProjectedOver false, marginPct 0, not NaN", () => {
  const legacy = legacyForecast(1000, 10, 30, 0);
  const proposed = getMonthEndForecast(1000, 10, 30, 0);
  assert.deepEqual(proposed, legacy);
});

// --- Health status ---

test("health: over budget", () => {
  assert.equal(getBudgetHealthStatus(true, -5).status, "over");
  assert.equal(legacyHealth(true, -5), "Over Budget");
});

test("health: under budget but margin below 10% — cutting it close", () => {
  assert.equal(getBudgetHealthStatus(false, 5).status, "close");
  assert.equal(legacyHealth(false, 5), "Cutting It Close");
});

test("health: comfortably under budget — on track", () => {
  assert.equal(getBudgetHealthStatus(false, 25).status, "onTrack");
  assert.equal(legacyHealth(false, 25), "On Track");
});

test("health: boundary at exactly 10% margin — matches legacy's strict < 10 check", () => {
  assert.equal(getBudgetHealthStatus(false, 10).status, "onTrack");
  assert.equal(legacyHealth(false, 10), "On Track");
});
