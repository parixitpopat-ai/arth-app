// domain/insights/commitments.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import { getRecurringCostsSummary } from "./commitments.js";

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
