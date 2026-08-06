// domain/allocations/household.fixture.js
//
// A permanent, hand-crafted "golden dataset" for characterizing Home's
// Household spend calculation. Deliberately synthetic rather than
// derived from real user data — see PR-2A discussion: real data goes
// stale as the app evolves, may carry accidental complexity irrelevant
// to the behavior under test, and doesn't guarantee coverage of the
// specific edge cases we already know matter. This fixture exists to
// document those edge cases explicitly and guard them permanently.
//
// Target period for characterization: January 2026 ("2026-01").
// One transaction (`r_feb_refund`) is deliberately dated in February to
// exercise the cross-period refund case — a refund posted in a later
// month against a January expense.
//
// Each expense's expected contribution to Household spend is documented
// inline. See household.characterization.test.js for the full
// hand-worked math and per-case + aggregate assertions.

export const PERIOD_MONTH_KEY = "2026-01";

export const HOUSEHOLD_FIXTURE_ALL_TRANSACTIONS = [
  // 1 & 8: Normal expense, no people/group allocations at all.
  // Expected contribution: 500 (plain pass-through, nothing to net or subtract)
  {
    id: "t_normal",
    type: "expense",
    amount: 500,
    date: "2026-01-05",
  },

  // 2: Cross-period refund. Expense is January, refund (settlement_in,
  // matched via againstTxnId) posts in February — must still net out of
  // January's total, per BUG-class caught by the adapter.test.js
  // cross-period refund test.
  // Expected contribution: 1000 - 300 = 700
  {
    id: "t_refunded_partial",
    type: "expense",
    amount: 1000,
    date: "2026-01-10",
  },
  {
    id: "r_feb_refund",
    type: "settlement_in",
    amount: 300,
    againstTxnId: "t_refunded_partial",
    date: "2026-02-03",
  },

  // 3: excludeFromSpend short-circuits to 0 before any other logic runs.
  // Expected contribution: 0
  {
    id: "t_excluded",
    type: "expense",
    amount: 800,
    date: "2026-01-12",
    excludeFromSpend: true,
  },

  // 4: mode:"owes" — a person owes this back, so it's subtracted from
  // Household spend (it's a receivable, not spend).
  // trackingMode inferred as "split" (a people entry other than __me__
  // exists). No groupAllocations, so groupCollectiveAmount branch is
  // eligible but groupCollectiveAmount isn't set here (0).
  // Expected contribution: 600 - 200 = 400
  {
    id: "t_owes",
    type: "expense",
    amount: 600,
    date: "2026-01-15",
    people: { p1: { amount: 200, mode: "owes" } },
  },

  // 5: mode:"spent_on" — genuine attributed spend, NOT subtracted.
  // Same trackingMode inference as above ("split"), but attributedAway
  // stays 0 since only mode:"owes" entries count.
  // Expected contribution: 400 - 0 = 400
  {
    id: "t_spent_on",
    type: "expense",
    amount: 400,
    date: "2026-01-16",
    people: { p1: { amount: 150, mode: "spent_on" } },
  },

  // 6: groupCollectiveAmount, no groupAllocations. trackingMode is
  // explicitly "split" (not inferred). Because groupAllocations is
  // empty, the groupCollectiveAmount branch applies.
  // Expected contribution: 1200 - 500 = 700
  {
    id: "t_group_collective",
    type: "expense",
    amount: 1200,
    date: "2026-01-18",
    groupId: "g1",
    trackingMode: "split",
    groupCollectiveAmount: 500,
    groupCollectiveSettledAmt: 0,
  },

  // 7: groupAllocations present (mix of "owes" and "spent_on" entries —
  // only "owes" counts). Because groupAllocations.length > 0, the
  // groupCollectiveAmount branch is skipped entirely even though
  // trackingMode is "allocate".
  // Expected contribution: 900 - 300 = 600
  {
    id: "t_group_allocations",
    type: "expense",
    amount: 900,
    date: "2026-01-20",
    trackingMode: "allocate",
    groupAllocations: [
      { mode: "owes", amount: 300 },
      { mode: "spent_on", amount: 200 },
    ],
  },

  // 9: Expense fully refunded within the SAME period (not cross-period —
  // that case is covered separately by t_refunded_partial above).
  // Expected contribution: 0 (netAmount hits 0, short-circuits before
  // attribution logic even runs)
  {
    id: "t_fully_refunded",
    type: "expense",
    amount: 700,
    date: "2026-01-22",
  },
  {
    id: "r_full_refund",
    type: "settlement_in",
    amount: 700,
    againstTxnId: "t_fully_refunded",
    date: "2026-01-23",
  },

  // 10: Mixed / explicit tracking mode — "tag" with forPerson set, not
  // inferred from people keys. Since trackingMode isn't "split" or
  // "allocate", the groupCollectiveAmount branch never applies here
  // regardless of what else is set.
  // Expected contribution: 300 - 0 = 300
  {
    id: "t_mixed_tracking",
    type: "expense",
    amount: 300,
    date: "2026-01-25",
    trackingMode: "tag",
    forPerson: "p1",
  },

  // Non-expense transaction in the period — must be filtered out
  // entirely, contributes nothing either way.
  {
    id: "t_income_noise",
    type: "income",
    amount: 50000,
    date: "2026-01-01",
  },
];

// Hand-worked sum of every "Expected contribution" comment above:
// 500 + 700 + 0 + 400 + 400 + 700 + 600 + 0 + 300 = 3600
export const EXPECTED_JANUARY_HOUSEHOLD_SPEND = 3600;

// Per-expense expected contributions, keyed by id, for granular
// characterization assertions (so a failure points at the exact case
// that broke, not just the aggregate).
export const EXPECTED_CONTRIBUTIONS_BY_ID = {
  t_normal: 500,
  t_refunded_partial: 700,
  t_excluded: 0,
  t_owes: 400,
  t_spent_on: 400,
  t_group_collective: 700,
  t_group_allocations: 600,
  t_fully_refunded: 0,
  t_mixed_tracking: 300,
};
