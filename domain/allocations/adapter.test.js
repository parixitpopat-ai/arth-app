// domain/allocations/adapter.test.js
// Run with: node --test domain/allocations/adapter.test.js

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getHouseholdPlanningAllocation,
  getCategoryPlanningAllocation,
  getPersonPlanningAllocation,
  getGroupPlanningAllocation,
  getCategoryAttributedTotal,
  getPersonAttributedTotal,
  buildRefundTotalsByExpense,
  getHouseholdAttributedTotal,
  getMandatoryCommitmentsTotal,
  getMandatoryCommitmentRemaining,
  getDiscretionaryPool,
  getDiscretionaryAllocatedTotal,
  getUnallocatedDiscretionary,
  getAllocationHierarchyWarning,
  getMandatoryCommitmentsConfirmationId,
  isMandatoryCommitmentsConfirmed,
} from "./adapter.js";

// --- Household: WP6 unified onto `??` semantics (explicit 0 is respected) ---

test("household: uses month override when present", () => {
  const result = getHouseholdPlanningAllocation(600000, { "2026-08": 65000 }, "2026-08");
  assert.equal(result, 65000);
});

test("household: falls back to annualBudget/12 when no override", () => {
  const result = getHouseholdPlanningAllocation(600000, {}, "2026-08");
  assert.equal(result, 50000);
});

test("household: WP6 — an explicit 0 override is now respected, matching Person/Group (unified, not the old || behavior)", () => {
  const result = getHouseholdPlanningAllocation(600000, { "2026-08": 0 }, "2026-08");
  assert.equal(result, 0);
});

// --- Category: flat only, no override layer ---

test("category: returns the flat budget field", () => {
  const result = getCategoryPlanningAllocation({ id: "cat_food", budget: 12000 });
  assert.equal(result, 12000);
});

test("category: missing budget field defaults to 0, not undefined", () => {
  const result = getCategoryPlanningAllocation({ id: "cat_food" });
  assert.equal(result, 0);
});

// --- Person: `??` semantics (explicit 0 override is respected) ---

test("person: uses month override when present", () => {
  const person = { spendBudget: 10000, spendBudgetOverrides: { "2026-08": 8000 } };
  assert.equal(getPersonPlanningAllocation(person, "2026-08"), 8000);
});

test("person: an explicit 0 override is respected, unlike household's || behavior", () => {
  const person = { spendBudget: 10000, spendBudgetOverrides: { "2026-08": 0 } };
  assert.equal(getPersonPlanningAllocation(person, "2026-08"), 0);
});

test("person: falls back to spendBudget when no override exists for the month", () => {
  const person = { spendBudget: 10000, spendBudgetOverrides: {} };
  assert.equal(getPersonPlanningAllocation(person, "2026-08"), 10000);
});

// --- Group: same `??` semantics as Person — full override/fallback parity ---

test("group: uses month override when present", () => {
  const group = { manualLimit: 5000, manualLimitOverrides: { "2026-08": 4200 } };
  assert.equal(getGroupPlanningAllocation(group, "2026-08"), 4200);
});

test("group: an explicit 0 override is respected", () => {
  const group = { manualLimit: 5000, manualLimitOverrides: { "2026-08": 0 } };
  assert.equal(getGroupPlanningAllocation(group, "2026-08"), 0);
});

test("group: falls back to manualLimit when no override exists for the month", () => {
  const group = { manualLimit: 5000, manualLimitOverrides: {} };
  assert.equal(getGroupPlanningAllocation(group, "2026-08"), 5000);
});

// --- Category Attribution: catAllocations with legacy catId fallback ---

test("category attribution: sums catAllocations across matching transactions", () => {
  const txns = [
    { type: "expense", catAllocations: { cat_food: 300, cat_transport: 200 } },
    { type: "expense", catAllocations: { cat_food: 150 } },
    { type: "expense", catAllocations: { cat_transport: 500 } },
  ];
  assert.equal(getCategoryAttributedTotal(txns, "cat_food"), 450);
});

test("category attribution: falls back to legacy catId for transactions without catAllocations", () => {
  const txns = [
    { type: "expense", catId: "cat_food", amount: 300 },
    { type: "expense", catId: "cat_transport", amount: 200 },
  ];
  assert.equal(getCategoryAttributedTotal(txns, "cat_food"), 300);
});

test("category attribution: does not double-count when both catAllocations and catId are present", () => {
  const txns = [{ type: "expense", catId: "cat_food", catAllocations: { cat_food: 300 } }];
  assert.equal(getCategoryAttributedTotal(txns, "cat_food"), 300);
});

test("category attribution: ignores non-expense transactions", () => {
  const txns = [{ type: "income", catId: "cat_food", amount: 300 }];
  assert.equal(getCategoryAttributedTotal(txns, "cat_food"), 0);
});

// --- Person Attribution: t.people, mode-filtered per CR-ACC-BUD-001 ---

test("person attribution: sums only mode:spent_on entries across matching transactions", () => {
  const txns = [
    { type: "expense", people: { p1: { amount: 200, mode: "spent_on" }, p2: { amount: 100, mode: "spent_on" } } },
    { type: "expense", people: { p1: { amount: 50, mode: "spent_on" } } },
  ];
  assert.equal(getPersonAttributedTotal(txns, "p1"), 250);
});

test("person attribution: mode:owes entries are excluded (receivable, not spend) — confirmed via App.jsx's own myShare formula", () => {
  const txns = [
    { type: "expense", people: { p1: { amount: 300, mode: "owes" } } },
    { type: "expense", people: { p1: { amount: 50, mode: "spent_on" } } },
  ];
  assert.equal(getPersonAttributedTotal(txns, "p1"), 50);
});

test("person attribution: a transaction with no entry for this person contributes 0", () => {
  const txns = [{ type: "expense", people: { p2: { amount: 100, mode: "spent_on" } } }];
  assert.equal(getPersonAttributedTotal(txns, "p1"), 0);
});

test("person attribution: ignores non-expense transactions", () => {
  const txns = [{ type: "income", people: { p1: { amount: 300, mode: "spent_on" } } }];
  assert.equal(getPersonAttributedTotal(txns, "p1"), 0);
});

// --- buildRefundTotalsByExpense: settlement_in matched via againstTxnId ---

test("buildRefundTotalsByExpense: sums settlement_in amounts against the matching expense id", () => {
  const txns = [
    { id: "t1", type: "expense", amount: 1000 },
    { id: "r1", type: "settlement_in", amount: 300, againstTxnId: "t1" },
    { id: "r2", type: "settlement_in", amount: 100, againstTxnId: "t1" },
  ];
  const map = buildRefundTotalsByExpense(txns);
  assert.equal(map["t1"], 400);
});

test("buildRefundTotalsByExpense: ignores settlement_in transactions with no againstTxnId", () => {
  const txns = [{ id: "r1", type: "settlement_in", amount: 300 }];
  const map = buildRefundTotalsByExpense(txns);
  assert.deepEqual(map, {});
});

// --- Household Attribution: mirrors getMyExpenseAmount + getNetExpenseAmount ---

test("household attribution: nets a simple expense with no splits or refunds", () => {
  const jan = [{ id: "t1", type: "expense", amount: 1000 }];
  const result = getHouseholdAttributedTotal({ periodTransactions: jan, allTransactions: jan });
  assert.equal(result, 1000);
});

test("household attribution: subtracts amounts attributed away via people mode:owes", () => {
  const txns = [
    { id: "t1", type: "expense", amount: 1000, people: { p1: { amount: 400, mode: "owes" } } },
  ];
  const result = getHouseholdAttributedTotal({ periodTransactions: txns, allTransactions: txns });
  assert.equal(result, 600);
});

test("household attribution: does not subtract people entries with mode:spent_on", () => {
  const txns = [
    { id: "t1", type: "expense", amount: 1000, people: { p1: { amount: 400, mode: "spent_on" } } },
  ];
  const result = getHouseholdAttributedTotal({ periodTransactions: txns, allTransactions: txns });
  assert.equal(result, 1000);
});

test("household attribution: excludeFromSpend transactions contribute 0", () => {
  const txns = [{ id: "t1", type: "expense", amount: 1000, excludeFromSpend: true }];
  const result = getHouseholdAttributedTotal({ periodTransactions: txns, allTransactions: txns });
  assert.equal(result, 0);
});

test("household attribution: refunds are resolved from full transaction history, even when the refund transaction itself falls outside the summed period", () => {
  const januaryExpense = { id: "t_jan", type: "expense", amount: 1000, date: "2026-01-15" };
  const februaryRefund = {
    id: "t_feb_refund",
    type: "settlement_in",
    amount: 300,
    againstTxnId: "t_jan",
    date: "2026-02-03",
  };

  const januarySpend = getHouseholdAttributedTotal({
    periodTransactions: [januaryExpense],
    allTransactions: [januaryExpense, februaryRefund],
  });

  assert.equal(januarySpend, 700);
});

test("household attribution: accepts a precomputed refundTotalsByExpense instead of allTransactions", () => {
  const januaryExpense = { id: "t_jan", type: "expense", amount: 1000 };
  const precomputedMap = { t_jan: 300 };

  const result = getHouseholdAttributedTotal({
    periodTransactions: [januaryExpense],
    refundTotalsByExpense: precomputedMap,
  });

  assert.equal(result, 700);
});

// --- WP6: Budget Core Model — Mandatory Commitments / Discretionary Pool ---
// The IA's own worked example, used throughout: Monthly Budget 30,000 ->
// Mandatory Commitments 10,000 (Household 5,000 + Spouse support 3,000 +
// Pocket money 2,000) -> Discretionary Pool 20,000 -> Rohan/Group A 8,000 +
// Family/Group B 7,000 -> Unallocated 5,000.

const WORKED_COMMITMENTS = [
  { id: "c1", name: "Household", amount: 5000, categoryId: "cat_household" },
  { id: "c2", name: "Spouse support", amount: 3000, categoryId: "cat_spouse" },
  { id: "c3", name: "Pocket money", amount: 2000, categoryId: "cat_pocket" },
];

test("getMandatoryCommitmentsTotal: sums the worked example to 10,000", () => {
  assert.equal(getMandatoryCommitmentsTotal(WORKED_COMMITMENTS), 10000);
});

test("getMandatoryCommitmentsTotal: no commitments is a safe 0, not a crash", () => {
  assert.equal(getMandatoryCommitmentsTotal([]), 0);
  assert.equal(getMandatoryCommitmentsTotal(null), 0);
});

test("getMandatoryCommitmentRemaining: partially spent commitment", () => {
  const result = getMandatoryCommitmentRemaining({ amount: 3000 }, 1200);
  assert.equal(result.spent, 1200);
  assert.equal(result.remaining, 1800);
  assert.equal(result.isOver, false);
});

test("getMandatoryCommitmentRemaining: overspent commitment is flagged, not floored", () => {
  const result = getMandatoryCommitmentRemaining({ amount: 2000 }, 2500);
  assert.equal(result.remaining, -500);
  assert.equal(result.isOver, true);
});

test("getDiscretionaryPool: worked example — 30,000 budget minus 10,000 mandatory = 20,000", () => {
  assert.equal(getDiscretionaryPool(30000, 10000), 20000);
});

test("getDiscretionaryPool: over-committed (mandatory exceeds budget) goes negative, not floored to 0", () => {
  assert.equal(getDiscretionaryPool(10000, 15000), -5000);
});

test("getDiscretionaryAllocatedTotal: worked example — Rohan/Group A 8,000 + Family/Group B 7,000 = 15,000", () => {
  assert.equal(getDiscretionaryAllocatedTotal([8000, 7000]), 15000);
});

test("getDiscretionaryAllocatedTotal: no allocations is a safe 0", () => {
  assert.equal(getDiscretionaryAllocatedTotal([]), 0);
  assert.equal(getDiscretionaryAllocatedTotal(null), 0);
});

test("getUnallocatedDiscretionary: worked example — 20,000 pool minus 15,000 allocated = 5,000", () => {
  assert.equal(getUnallocatedDiscretionary(20000, 15000), 5000);
});

test("getUnallocatedDiscretionary: over-allocated goes negative, not floored to 0", () => {
  assert.equal(getUnallocatedDiscretionary(20000, 25000), -5000);
});

test("getAllocationHierarchyWarning: worked example allocations fit inside the pool — null, no warning", () => {
  assert.equal(getAllocationHierarchyWarning(20000, 15000), null);
});

test("getAllocationHierarchyWarning: allocations exceeding the pool — Sigma(children) > parent — returns overBy", () => {
  const result = getAllocationHierarchyWarning(20000, 25000);
  assert.deepEqual(result, { overBy: 5000 });
});

test("getAllocationHierarchyWarning: allocations exactly matching the pool is not a warning", () => {
  assert.equal(getAllocationHierarchyWarning(20000, 20000), null);
});

test("getMandatoryCommitmentsConfirmationId: month-scoped id, matching the existing budget-alert id shape", () => {
  assert.equal(getMandatoryCommitmentsConfirmationId("2026-09"), "mandatory_confirm_2026-09");
});

test("isMandatoryCommitmentsConfirmed: true once the id is in dismissedAlerts", () => {
  assert.equal(isMandatoryCommitmentsConfirmed(["mandatory_confirm_2026-09"], "2026-09"), true);
});

test("isMandatoryCommitmentsConfirmed: false for a month not yet confirmed, or an empty/missing array", () => {
  assert.equal(isMandatoryCommitmentsConfirmed(["mandatory_confirm_2026-08"], "2026-09"), false);
  assert.equal(isMandatoryCommitmentsConfirmed([], "2026-09"), false);
  assert.equal(isMandatoryCommitmentsConfirmed(null, "2026-09"), false);
});
