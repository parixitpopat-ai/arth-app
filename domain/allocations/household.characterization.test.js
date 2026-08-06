// domain/allocations/household.characterization.test.js
//
// PR-2A, Commit 1 — characterization test. No production code changes
// happen in this commit; this exists purely to prove that
// getHouseholdAttributedTotal() produces IDENTICAL output to the
// current inline Home Household calculation, before that inline
// calculation is touched.
//
// Follows the same pattern as the existing
// src/domain/transactions/legacy/*.characterization.test.js files.
//
// IMPORTANT — this is a hand-extracted copy, not an import:
// legacyGetMyExpenseAmount / legacyGetNetExpenseAmount /
// legacyBuildRefundTotalsByExpense below are manually mirrored from
// App.jsx's getMyExpenseAmount (~L1240), getNetExpenseAmount (~L1224),
// and the inline refundTotalsByExpense reduce (~L1219) — copied as
// plain functions with no React/hook dependencies, so this test can run
// in Node without mounting the app. They are DELIBERATELY NOT imported
// from adapter.js, so this test compares two independent
// implementations rather than the adapter against itself. If the real
// inline logic in App.jsx changes, these must be updated in lockstep or
// this test silently stops characterizing anything real.

import { test } from "node:test";
import assert from "node:assert/strict";
import { getHouseholdAttributedTotal } from "./adapter.js";
import {
  PERIOD_MONTH_KEY,
  HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS,
  EXPECTED_JANUARY_HOUSEHOLD_SPEND,
  EXPECTED_CONTRIBUTIONS_BY_ID,
} from "./household.fixture.js";

// --- Hand-mirrored legacy logic (App.jsx, current inline implementation) ---

function legacyBuildRefundTotalsByExpense(allTransactions) {
  return allTransactions.reduce((map, txn) => {
    if (txn.type !== "settlement_in" || !txn.againstTxnId) return map;
    const key = String(txn.againstTxnId);
    map[key] = (map[key] || 0) + Number(txn.amount || 0);
    return map;
  }, {});
}

function legacyGetNetExpenseAmount(expense, refundTotalsByExpense) {
  return Math.max(
    0,
    Number(expense?.amount || 0) - Number(refundTotalsByExpense[String(expense?.id)] || 0)
  );
}

function legacyGetMyExpenseAmount(expense, refundTotalsByExpense) {
  if (expense?.excludeFromSpend) return 0;
  const netAmount = legacyGetNetExpenseAmount(expense, refundTotalsByExpense);
  if (!(netAmount > 0)) return 0;

  const trackingMode =
    expense?.trackingMode ||
    (Object.keys(expense?.people || {}).some((pid) => pid !== "__me__")
      ? "split"
      : expense?.forPerson || expense?.groupId
      ? "tag"
      : "none");

  let attributedAway = 0;
  Object.entries(expense?.people || {}).forEach(([pid, info]) => {
    if (pid === "__me__") return;
    const mode = info?.mode;
    const part = Number(info?.amount || 0);
    if (!(part > 0)) return;
    if (mode === "owes") attributedAway += part;
  });

  const groupAllocations = Array.isArray(expense?.groupAllocations) ? expense.groupAllocations : [];
  groupAllocations.forEach((groupPart) => {
    const mode = groupPart?.mode;
    const part = Number(groupPart?.amount || 0);
    if (!(part > 0)) return;
    if (mode === "owes") attributedAway += part;
  });

  if ((trackingMode === "split" || trackingMode === "allocate") && groupAllocations.length === 0) {
    const collectivePart = Number(expense?.groupCollectiveAmount || 0);
    if (collectivePart > 0) attributedAway += collectivePart;
  }

  return Math.max(0, netAmount - attributedAway);
}

// Mirrors Home's actual line: homeThisMonthTxns.filter(t=>t.type==="expense").reduce((s,t)=>s+getMyExpenseAmount(t),0)
function legacyHomeHouseholdSpend(periodTransactions, allTransactions) {
  const refundTotalsByExpense = legacyBuildRefundTotalsByExpense(allTransactions);
  return periodTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + legacyGetMyExpenseAmount(t, refundTotalsByExpense), 0);
}

// --- Fixture setup ---

const periodTransactions = HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS.filter((t) =>
  (t.date || "").startsWith(PERIOD_MONTH_KEY)
);

// --- Characterization: legacy vs adapter, on the full fixture ---

test("characterization: legacy Home calculation matches getHouseholdAttributedTotal on the full fixture", () => {
  const legacyResult = legacyHomeHouseholdSpend(periodTransactions, HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS);
  const adapterResult = getHouseholdAttributedTotal({
    periodTransactions,
    allTransactions: HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS,
  });

  assert.equal(legacyResult, adapterResult);
});

test("characterization: the fixture's known-correct total is what both implementations produce", () => {
  const adapterResult = getHouseholdAttributedTotal({
    periodTransactions,
    allTransactions: HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS,
  });

  assert.equal(adapterResult, EXPECTED_JANUARY_HOUSEHOLD_SPEND);
});

// --- Characterization: legacy vs adapter, per individual case ---
// Isolates each fixture expense to its own single-transaction period, so
// a mismatch points at the exact edge case that broke, not just the
// aggregate total.

for (const [id, expectedContribution] of Object.entries(EXPECTED_CONTRIBUTIONS_BY_ID)) {
  test(`characterization: case "${id}" — legacy and adapter agree, both equal the documented expected value (${expectedContribution})`, () => {
    const expense = HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS.find((t) => t.id === id);
    const isolatedPeriod = [expense];

    const legacyResult = legacyHomeHouseholdSpend(isolatedPeriod, HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS);
    const adapterResult = getHouseholdAttributedTotal({
      periodTransactions: isolatedPeriod,
      allTransactions: HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS,
    });

    assert.equal(legacyResult, expectedContribution);
    assert.equal(adapterResult, expectedContribution);
  });
}

// --- Sanity: non-expense transactions never contribute, either implementation ---

test("characterization: non-expense transactions contribute 0 under both implementations", () => {
  const incomeOnly = HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS.filter((t) => t.id === "t_income_noise");

  const legacyResult = legacyHomeHouseholdSpend(incomeOnly, HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS);
  const adapterResult = getHouseholdAttributedTotal({
    periodTransactions: incomeOnly,
    allTransactions: HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS,
  });

  assert.equal(legacyResult, 0);
  assert.equal(adapterResult, 0);
});
