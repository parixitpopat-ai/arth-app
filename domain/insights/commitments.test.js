// domain/insights/commitments.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { getRecurringCostsSummary, getRecurringCostsOver12Months, getCommitmentHistory } from "./commitments.js";

test("getRecurringCostsSummary: groups committedSpending/committedSaving/debtService by sourceType, sums totals and counts", () => {
  const futureMoney = {
    committedSpending: [
      { sourceType: "bill", amount: 1000 },
      { sourceType: "bill", amount: 500 },
      { sourceType: "membership", amount: 800 },
    ],
    committedSaving: [
      { sourceType: "recurringSchedule", amount: 5000 },
    ],
    debtService: [
      { sourceType: "debt", amount: 3000 },
    ],
  };
  const rows = getRecurringCostsSummary(futureMoney);
  assert.equal(rows.length, 4);
  const bills = rows.find(r => r.sourceType === "bill");
  assert.equal(bills.count, 2);
  assert.equal(bills.total, 1500);
  assert.equal(bills.label, "Bills");
  // sorted descending by total
  assert.equal(rows[0].sourceType, "recurringSchedule");
});

test("getRecurringCostsSummary: empty futureMoney is a safe empty array", () => {
  assert.deepEqual(getRecurringCostsSummary({ committedSpending: [], committedSaving: [], debtService: [] }), []);
  assert.deepEqual(getRecurringCostsSummary({}), []);
  assert.deepEqual(getRecurringCostsSummary(null), []);
});

test("getRecurringCostsSummary: unknown sourceType falls back to its own key as the label", () => {
  const rows = getRecurringCostsSummary({ committedSpending: [{ sourceType: "somethingNew", amount: 100 }] });
  assert.equal(rows[0].label, "somethingNew");
});

// getRecurringCostsOver12Months reuses Outlook's own groupFutureMoneyByRhythm (WP10) — this
// test reuses the exact same fixture shape as src/domain/futureMoney/rhythm.test.js's own
// worked example, so a passing result here is checked against real monthly-rhythm math, not
// just internal consistency.
const FROM = "2026-09-28";
function buildFutureMoneyFixture() {
  return {
    committedSpending: [
      { sourceType: "bill", sourceId: "airtel", category: "committedSpending", name: "Airtel", amount: 799, date: "2026-10-03", recurs: true },
      { sourceType: "ccStatement", sourceId: "hdfc", category: "committedSpending", name: "HDFC", amount: 8765, date: "2026-10-05", recurs: true },
      { sourceType: "membership", sourceId: "cultfit", category: "committedSpending", name: "Cult.fit", amount: 1500, date: "2026-10-05", recurs: true },
      { sourceType: "insurancePolicy", sourceId: "icici_car", category: "committedSpending", name: "ICICI Car", amount: 14200, date: "2026-11-12", recurs: true },
    ],
    committedSaving: [
      { sourceType: "recurringSchedule", sourceId: "ppfc", category: "committedSaving", name: "SIP", amount: 5000, date: "2026-10-10", recurs: true },
    ],
    debtService: [
      { sourceType: "debt", sourceId: "sbi_home", category: "debtService", name: "SBI EMI", amount: 22400, date: "2026-10-07", recurs: true },
    ],
  };
}

test("getRecurringCostsOver12Months: monthly-rhythm items are annualised (x12), one-off items counted once, grouped into the handoff's four display buckets", () => {
  const { total, groups } = getRecurringCostsOver12Months(buildFutureMoneyFixture(), FROM);
  const byLabel = Object.fromEntries(groups.map(g => [g.label, g.total]));
  assert.equal(byLabel["Loans"], 22400 * 12);
  assert.equal(byLabel["SIPs"], 5000 * 12);
  assert.equal(byLabel["Insurance"], 14200, "a one-off annual renewal is counted once, not x12");
  assert.equal(byLabel["Bills, cards, fees, memberships"], (799 + 8765 + 1500) * 12);
  assert.equal(total, byLabel["Loans"] + byLabel["SIPs"] + byLabel["Insurance"] + byLabel["Bills, cards, fees, memberships"]);
});

test("getCommitmentHistory: a skipped month is excluded from both the average and the within-budget count", () => {
  const commitment = { categoryId: "cat_groceries", amount: 10000, skippedMonths: ["2026-07"] };
  const txns = [
    { date: "2026-06-15", catIds: ["cat_groceries"], type: "expense", amount: 9500 },
    { date: "2026-08-15", catIds: ["cat_groceries"], type: "expense", amount: 11000 },
  ];
  const h = getCommitmentHistory(commitment, txns, ["2026-06", "2026-07", "2026-08"]);
  assert.equal(h.totalMonths, 3);
  assert.equal(h.skippedCount, 1);
  assert.equal(h.consideredMonths, 2);
  assert.equal(h.withinCount, 1, "only June (9500 <= 10000) is within budget; August (11000) is not");
  assert.equal(h.average, (9500 + 11000) / 2);
});

test("getCommitmentHistory: all months skipped is a safe zero average, not NaN or a throw", () => {
  const commitment = { categoryId: "cat_x", amount: 5000, skippedMonths: ["2026-06", "2026-07"] };
  const h = getCommitmentHistory(commitment, [], ["2026-06", "2026-07"]);
  assert.equal(h.average, 0);
  assert.equal(h.consideredMonths, 0);
});
