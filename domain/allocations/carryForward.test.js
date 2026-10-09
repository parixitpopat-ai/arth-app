// Carry-forward uses the one attributed household-spend definition (getHouseholdAttributedTotal) for
// "what did I spend last month" - no separate gross-expense rule. Cases come from the WP-D evidence tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCarryForwardPrevSpend, getHouseholdAttributedTotal, resolveCarryForwardMonthly } from "./adapter.js";

const PREV = "2026-09";
const exp = (id, amount, extra = {}) => ({ id, type: "expense", amount, date: "2026-09-10", ...extra });
const refund = (againstTxnId, amount) => ({ id: "r" + againstTxnId, type: "settlement_in", isRefund: true, againstTxnId, amount, date: "2026-09-12" });

test("plain expenses are summed", () => {
  assert.equal(getCarryForwardPrevSpend([exp("a", 1000), exp("b", 500)], PREV), 1500);
});

test("a refund reduces last month's spend", () => {
  assert.equal(getCarryForwardPrevSpend([exp("a", 1000), refund("a", 300)], PREV), 700);
});

test("an expense excluded from spend is not counted", () => {
  assert.equal(getCarryForwardPrevSpend([exp("a", 1000), exp("x", 400, { excludeFromSpend: true })], PREV), 1000);
});

test("money a friend owes me (receivable) is not my spend", () => {
  assert.equal(getCarryForwardPrevSpend([exp("a", 1000, { people: { p1: { mode: "owes", amount: 400 } } })], PREV), 600);
});

test("a group-tagged expense contributes my share, not zero and not the gross", () => {
  const g = exp("g", 1000, { groupId: "grp1", trackingMode: "split", groupAllocations: [{ groupId: "grp1", mode: "owes", amount: 600 }] });
  assert.equal(getCarryForwardPrevSpend([g], PREV), 400);
});

test("only the requested month counts; other months and non-expenses are ignored", () => {
  const t = [exp("a", 1000), { ...exp("b", 700), date: "2026-10-02" }, { id: "i", type: "income", amount: 9999, date: "2026-09-03" }];
  assert.equal(getCarryForwardPrevSpend(t, PREV), 1000);
});

test("it is exactly the figure the app shows as that month's Spent", () => {
  const t = [
    exp("a", 1000), refund("a", 300), exp("x", 400, { excludeFromSpend: true }),
    exp("p", 900, { people: { p1: { mode: "owes", amount: 300 } } }),
    exp("g", 1000, { groupId: "g1", trackingMode: "split", groupAllocations: [{ groupId: "g1", mode: "owes", amount: 600 }] }),
  ];
  const shown = getHouseholdAttributedTotal({ periodTransactions: t.filter((x) => x.date.startsWith(PREV)), allTransactions: t });
  assert.equal(getCarryForwardPrevSpend(t, PREV), shown);
  assert.equal(shown, 700 + 600 + 400);
});

test("effect on the carried amount: budget 10,000, base 10,000, with a ₹300 refund", () => {
  const spend = getCarryForwardPrevSpend([exp("a", 1000), refund("a", 300)], PREV);
  assert.equal(resolveCarryForwardMonthly(true, 10000, 10000, spend), 19300);
});

test("carry-forward off: the previous month's spend has no effect (default unchanged)", () => {
  assert.equal(resolveCarryForwardMonthly(false, 10000, 10000, 12345), 10000);
});

// ---- getEffectiveMonthlyBudget: the one entry point for Home, Budget and Insights (D4) ----
import { getEffectiveMonthlyBudget } from "./adapter.js";

const oct = (over = {}) => ({ annualBudget: 120000, monthOverrides: {}, monthKey: "2026-10", transactions: [exp("a", 1000), refund("a", 300)], ...over });

test("carry-forward off (the default): effective = base; prev spend is still reported", () => {
  const r = getEffectiveMonthlyBudget(oct());
  assert.equal(r.base, 10000);
  assert.equal(r.effective, 10000);
  assert.equal(r.carry, 0);
  assert.equal(r.prevMonthKey, "2026-09");
  assert.equal(r.prevSpend, 700);
});

test("carry-forward on: last month's allocation less its attributed spend is added", () => {
  const r = getEffectiveMonthlyBudget(oct({ carryForwardEnabled: true }));
  assert.equal(r.carry, 9300);
  assert.equal(r.effective, 19300);
});

test("carry uses last month's own override; an overspent month carries a negative amount", () => {
  const r = getEffectiveMonthlyBudget(oct({ carryForwardEnabled: true, monthOverrides: { "2026-09": 500 } }));
  assert.equal(r.carry, -200); // 500 planned - 700 spent
  assert.equal(r.effective, 9800);
});

test("the effective budget never goes below zero", () => {
  assert.equal(getEffectiveMonthlyBudget(oct({ carryForwardEnabled: true, annualBudget: 1200 })).effective, 0); // base 100, carry 100 - 700
});

test("January looks back to December of the previous year", () => {
  const r = getEffectiveMonthlyBudget({ annualBudget: 120000, monthOverrides: {}, monthKey: "2027-01", carryForwardEnabled: true, transactions: [{ id: "d", type: "expense", amount: 4000, date: "2026-12-05" }] });
  assert.equal(r.prevMonthKey, "2026-12");
  assert.equal(r.effective, 16000);
});

test("every screen calling it with the same inputs gets the same budget", () => {
  const a = getEffectiveMonthlyBudget(oct({ carryForwardEnabled: true }));
  const b = getEffectiveMonthlyBudget(oct({ carryForwardEnabled: true }));
  assert.deepEqual(a, b);
});
