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
