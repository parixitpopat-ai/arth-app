import test from "node:test";
import assert from "node:assert/strict";
import { daysLeft as legacyDaysLeft } from "../../helpers/dateHelpers.js";
import { getSafeToSpendPerDay } from "../../../domain/allocations/adapter.js";
import { daysLeftInclusive, getBudgetLeft } from "./budgetLeft.js";

const at = (iso) => new Date(`${iso}T10:00:00`);
const OCT12 = at("2026-10-12");

// Characterization: the two formulas the app used before this module (frozen, so the change is visible).
const homeBefore = (budget, spent, today) => {
  const left = budget - spent;
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1;
  return { left, perDay: Math.round(days > 0 ? left / days : left) };
};
test("before: Home ₹900 vs Budget ₹947 for the same ₹18,000 on 12 Oct", () => {
  assert.equal(homeBefore(50000, 32000, OCT12).perDay, 900);
  assert.equal(getSafeToSpendPerDay(18000, 19, 50000), 947);
});
test("before: over budget showed ₹-250/day on Home and ₹0 on Budget", () => {
  assert.equal(homeBefore(50000, 55000, OCT12).perDay, -250);
  assert.equal(getSafeToSpendPerDay(-5000, 19, 50000), 0);
});

test("days left counts today; current, past and future months", () => {
  assert.equal(daysLeftInclusive(OCT12, "2026-10"), 20);
  assert.equal(daysLeftInclusive(OCT12, undefined), 20);
  assert.equal(daysLeftInclusive(at("2026-10-31"), "2026-10"), 1);
  assert.equal(daysLeftInclusive(at("2026-10-01"), "2026-10"), 31);
  assert.equal(daysLeftInclusive(OCT12, "2026-09"), 0);
  assert.equal(daysLeftInclusive(OCT12, "2026-11"), 30);
  assert.equal(daysLeftInclusive(at("2028-02-10"), "2028-02"), 20); // leap year
});
test("days left is the old Budget count plus today", () => {
  for (const d of ["2026-10-01", "2026-10-12", "2026-10-30"]) {
    const today = at(d);
    const realNow = Date; // legacy daysLeft reads the clock; compare through a stubbed Date
    globalThis.Date = class extends realNow { constructor(...a) { return a.length ? new realNow(...a) : new realNow(today); } };
    try { assert.equal(daysLeftInclusive(today, "2026-10"), legacyDaysLeft("2026-10") + 1); } finally { globalThis.Date = realNow; }
  }
});

test("mid-month: ₹18,000 left over 20 days is ₹900 a day", () => {
  assert.deepEqual(getBudgetLeft({ budget: 50000, spent: 32000, today: OCT12, monthKey: "2026-10" }),
    { budget: 50000, spent: 32000, remaining: 18000, overBy: 0, perDay: 900, daysLeft: 20, state: "left" });
});
test("over budget: Overspent by ₹5,000 and ₹0 a day, never negative", () => {
  const r = getBudgetLeft({ budget: 50000, spent: 55000, today: OCT12, monthKey: "2026-10" });
  assert.equal(r.state, "over"); assert.equal(r.overBy, 5000); assert.equal(r.perDay, 0);
});
test("exactly on budget is left, ₹0", () => {
  const r = getBudgetLeft({ budget: 50000, spent: 50000, today: OCT12, monthKey: "2026-10" });
  assert.equal(r.state, "left"); assert.equal(r.remaining, 0); assert.equal(r.perDay, 0);
});
test("last day and first day", () => {
  assert.equal(getBudgetLeft({ budget: 50000, spent: 32000, today: at("2026-10-31"), monthKey: "2026-10" }).perDay, 18000);
  assert.equal(getBudgetLeft({ budget: 50000, spent: 2000, today: at("2026-10-01"), monthKey: "2026-10" }).perDay, 1548);
});
test("past month has no per-day figure (old Budget tab showed the whole remaining as 'a day')", () => {
  assert.equal(getBudgetLeft({ budget: 50000, spent: 0, today: OCT12, monthKey: "2026-09" }).perDay, null);
  assert.equal(getBudgetLeft({ budget: 50000, spent: 60000, today: OCT12, monthKey: "2026-09" }).perDay, null);
});
test("no budget: state none, no per-day", () => {
  for (const budget of [0, null, undefined, -5]) {
    const r = getBudgetLeft({ budget, spent: 100, today: OCT12, monthKey: "2026-10" });
    assert.equal(r.state, "none"); assert.equal(r.perDay, null);
  }
});
