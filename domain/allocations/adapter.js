// domain/allocations/adapter.js
//
// WP-1 - Allocation Engine Integration (PR-1: adapter interfaces only)
// Implements ADR-035's read-side conceptual API against today's actual
// field shapes. Per WP-1 scope: NO behavior change, NO migration, NO UI
// change. Existing consumers (Home, OutlookPage, BudgetPage) are NOT
// modified by this PR - they continue reading their own local fields
// until PR-2/PR-3 switch them over, one at a time, per the PR-slicing
// plan. This file only makes the canonical read path available; it does
// not yet replace anything.
//
// Deliberately preserves today's real, if inconsistent, resolution
// semantics rather than unifying them:
//   - Household (annualBudget/monthOverrides) resolves with `||`, so an
//     explicit override of 0 falls through to the computed default.
//   - Person/Group (spendBudgetOverrides/manualLimitOverrides) resolve
//     with `??`, so an explicit override of 0 is respected as-is.
// This split was flagged as a real inconsistency in BUD-000A/ADR-035
// (CBR-BUD-05/08). Unifying it is an explicit future decision, not
// something this PR silently changes - doing so here would be a
// behavior change, which is out of scope for WP-1.

/**
 * Resolve the Planning Allocation amount for the Household dimension,
 * for a given period. Mirrors the six duplicate implementations found
 * in BUD-000's Mutation Census (AppContent, Home, OutlookPage,
 * BudgetPage) exactly - same formula, same `||` semantics - so that
 * switching a consumer over to this function in PR-2/PR-3 produces
 * identical output to what it already computed inline.
 *
 * @param {number} annualBudget
 * @param {Object} monthOverrides - { [monthKey: "YYYY-MM"]: number }
 * @param {string} monthKey
 * @returns {number}
 */
export function getHouseholdPlanningAllocation(annualBudget, monthOverrides, monthKey) {
  return monthOverrides[monthKey] || Math.round(Number(annualBudget || 0) / 12);
}

/**
 * Resolve the Planning Allocation amount for a Category dimension.
 * Category has no month-override layer today (confirmed in BUD-000
 * Phase 4, CBR-BUD-10) - flat value only. This function does not
 * invent one; a `monthKey` parameter is deliberately not accepted,
 * so a future addition of category-level overrides can't be silently
 * assumed by a caller of this function.
 *
 * @param {Object} category - a Category object with a `.budget` field
 * @returns {number}
 */
export function getCategoryPlanningAllocation(category) {
  return Number(category?.budget || 0);
}

/**
 * Resolve variance between actual attributed spend and planning allocation
 * for a single dimension figure (category, person, group, household - any
 * pair of already-computed numbers). Pure arithmetic, no transaction
 * reads - deliberately generic rather than category-specific, so the same
 * function serves every dimension's "over/under budget" question without
 * a duplicate per dimension.
 *
 * variance: budget - actual. Positive = under budget, negative = over.
 * variancePct: variance as a percentage of budget. Null when budget is 0
 * (division is undefined, not "0% variance" - a 0-budget category with any
 * spend is fully over budget, not a meaningless percentage).
 *
 * @param {number} actual
 * @param {number} budget
 * @returns {{variance: number, variancePct: number|null, isOver: boolean}}
 */
export function getBudgetVariance(actual, budget) {
  const a = Number(actual || 0);
  const b = Number(budget || 0);
  const variance = b - a;
  const variancePct = b > 0 ? Math.round((variance / b) * 100) : null;
  return { variance, variancePct, isOver: variance < 0 };
}

/**
 * Resolve the Planning Allocation amount for a Person dimension, for a
 * given period. Uses `??` (nullish), not `||` - an explicit override of
 * 0 is respected as a deliberate zero, matching today's real behavior
 * at spendBudgetOverrides call sites (not unified with Household's `||`
 * semantics - see file header).
 *
 * @param {Object} person - a Person object with `.spendBudget` and
 *   optionally `.spendBudgetOverrides`
 * @param {string} monthKey
 * @returns {number}
 */
export function getPersonPlanningAllocation(person, monthKey) {
  return Number(person?.spendBudgetOverrides?.[monthKey] ?? person?.spendBudget ?? 0);
}

/**
 * Resolve the Planning Allocation amount for a Group dimension, for a
 * given period. Same `??` semantics as Person - see file header.
 *
 * @param {Object} group - a Group object with `.manualLimit` and
 *   optionally `.manualLimitOverrides`
 * @param {string} monthKey
 * @returns {number}
 */
export function getGroupPlanningAllocation(group, monthKey) {
  return Number(group?.manualLimitOverrides?.[monthKey] ?? group?.manualLimit ?? 0);
}

/**
 * Resolve the total Analytical Attribution for a Category dimension
 * across a set of transactions. Read-only - does not touch transaction
 * state. Two distinct paths, matching two distinct real data shapes:
 *
 *   1. Explicit split (`catAllocations` present, has an entry for
 *      `categoryId`): sums the raw recorded value for that category.
 *      Deliberately UNNETTED (no refund/attributed-away adjustment) -
 *      confirmed by repo inspection that no current legacy consumer
 *      reads `catAllocations` for any aggregation at all (it's a
 *      write-time/display-only field today), so there is no legacy
 *      behavior to characterize or match here. This is forward design,
 *      not a port - netting semantics for this path are an open
 *      question, intentionally left undecided by this function.
 *
 *   2. `catIds`/`catId` fallback (no `catAllocations`, or a
 *      `catAllocations` object that doesn't cover this category): the
 *      transaction's net attributed amount - computed with the exact
 *      same refund-netting and `mode:"owes"` attributed-away logic as
 *      `getHouseholdAttributedTotal`/App.jsx's `getMyExpenseAmount` -
 *      is split evenly across every tag in `t.catIds` (or `[t.catId]`
 *      if `catIds` is absent/empty). This matches App.jsx's `byCat` and
 *      StatsPage's `catTotals` exactly, which is the actual live
 *      category-breakdown behavior for the dominant real data shape
 *      (multi-category tagging without a custom split).
 *
 * Per ADR-036 Invariant 4 (per-dimension completeness): for any period,
 * summing this function's result across every category touched in that
 * period must equal `getHouseholdAttributedTotal` for the same period -
 * see adapter.test.js's completeness test.
 *
 * @param {Array} transactions
 * @param {string} categoryId
 * @param {Object} [options]
 * @param {Array} [options.allTransactions] - full transaction history,
 *   used to build the refund map for the catIds/catId path if
 *   refundTotalsByExpense isn't supplied. Defaults to `transactions`
 *   itself when omitted (self-contained, matches existing 2-arg call
 *   sites) - pass this explicitly when a refund may fall outside the
 *   summed period, same caveat as getHouseholdAttributedTotal.
 * @param {Object} [options.refundTotalsByExpense] - precomputed via
 *   buildRefundTotalsByExpense, for callers reusing it across multiple
 *   category figures in one render.
 * @returns {number}
 */
export function getCategoryAttributedTotal(transactions, categoryId, { allTransactions, refundTotalsByExpense } = {}) {
  const refundMap = refundTotalsByExpense || buildRefundTotalsByExpense(allTransactions || transactions);

  return transactions.reduce((sum, t) => {
    if (t.type !== "expense") return sum;

    // Path 1 - explicit split. Unnetted; see function doc.
    if (t.catAllocations && Object.prototype.hasOwnProperty.call(t.catAllocations, categoryId)) {
      return sum + Number(t.catAllocations[categoryId] || 0);
    }
    if (t.catAllocations) return sum; // has an explicit split, but not for this category

    // Path 2 - catIds/catId fallback, netted + evenly split.
    if (t.excludeFromSpend) return sum;

    const netAmount = Math.max(0, Number(t.amount || 0) - Number(refundMap[String(t.id)] || 0));
    if (!(netAmount > 0)) return sum;

    let attributedAway = 0;
    Object.entries(t.people || {}).forEach(([pid, info]) => {
      if (pid === "__me__") return;
      const mode = info?.mode;
      const part = Number(info?.amount || 0);
      if (!(part > 0)) return;
      if (mode === "owes") attributedAway += part;
    });

    const groupAllocations = Array.isArray(t.groupAllocations) ? t.groupAllocations : [];
    groupAllocations.forEach((groupPart) => {
      const mode = groupPart?.mode;
      const part = Number(groupPart?.amount || 0);
      if (!(part > 0)) return;
      if (mode === "owes") attributedAway += part;
    });

    const trackingMode =
      t.trackingMode ||
      (Object.keys(t.people || {}).some((pid) => pid !== "__me__")
        ? "split"
        : t.forPerson || t.groupId
        ? "tag"
        : "none");

    if ((trackingMode === "split" || trackingMode === "allocate") && groupAllocations.length === 0) {
      const collectivePart = Number(t.groupCollectiveAmount || 0);
      if (collectivePart > 0) attributedAway += collectivePart;
    }

    const myAmount = Math.max(0, netAmount - attributedAway);
    if (!(myAmount > 0)) return sum;

    const tCats = (Array.isArray(t.catIds) && t.catIds.length ? t.catIds : t.catId ? [t.catId] : []).filter(Boolean);
    if (!tCats.length || !tCats.includes(categoryId)) return sum;

    return sum + myAmount / tCats.length;
  }, 0);
}

/**
 * Resolve the total Analytical Attribution for a Person dimension
 * across a set of transactions, reading `t.people`. Read-only.
 *
 * Counts only `mode: "spent_on"` entries - confirmed, evidence-based
 * business rule (CR-ACC-BUD-001 resolution): `mode: "owes"` represents
 * a temporary receivable owed back to the user (App.jsx's own `myShare`
 * formula explicitly excludes it from spend: `amount - sum(mode==="owes")`),
 * not attributable household/person spend. `mode: "spent_on"` is genuine
 * attributed spend with no debt. The real repository never uses
 * `mode: "on_me"` - that value does not exist in production data; earlier
 * versions of this function (and the sandbox-built TransactionPersonShare
 * aggregate) assumed it did.
 *
 * @param {Array} transactions
 * @param {string} personId
 * @returns {number}
 */
export function getPersonAttributedTotal(transactions, personId) {
  return transactions.reduce((sum, t) => {
    if (t.type !== "expense") return sum;
    const info = t.people?.[personId];
    if (!info || info.mode !== "spent_on") return sum;
    return sum + Number(info.amount || 0);
  }, 0);
}

/**
 * Build a map of expenseId -> total refunded amount, from `settlement_in`
 * transactions matched via `againstTxnId`. Mirrors App.jsx's
 * `refundTotalsByExpense` (~L1219) exactly. Exposed separately (per
 * review CR1) so callers computing multiple Household figures in the
 * same render (Budget card, Safe to Spend, Forecast, etc.) can build
 * this once and reuse it, rather than each attribution call rebuilding
 * it from the full transaction history.
 *
 * @param {Array} allTransactions
 * @returns {Object} map of expenseId (string) -> total refunded amount
 */
export function buildRefundTotalsByExpense(allTransactions) {
  return allTransactions.reduce((map, txn) => {
    if (txn.type !== "settlement_in" || !txn.againstTxnId) return map;
    const key = String(txn.againstTxnId);
    map[key] = (map[key] || 0) + Number(txn.amount || 0);
    return map;
  }, {});
}

/**
 * Resolve the total Analytical Attribution for the Household dimension -
 * i.e. "what did I actually spend this period," mirroring App.jsx's
 * `getMyExpenseAmount` (~L1240, composed with `getNetExpenseAmount`
 * ~L1224) exactly. Read-only - does not touch transaction state.
 *
 * Nets out, in order:
 *   1. Refunds matched to an expense via `settlement_in` transactions'
 *      `againstTxnId` - matched against `allTransactions` (or a
 *      precomputed `refundTotalsByExpense`), NOT `periodTransactions`,
 *      because a refund can post in a later period than the expense it
 *      applies to (see adapter.test.js's cross-period refund test).
 *      Matching only within the period would silently under-net
 *      expenses whose refund landed elsewhere. Caller owns period
 *      filtering - this function does not know about months, fiscal
 *      years, or ADR-037's Financial Calendar.
 *   2. Amounts attributed away to other people or groups via
 *      `mode: "owes"` entries in `people` or `groupAllocations` - same
 *      `mode:"owes"`-excluded / `mode:"spent_on"`-included split used by
 *      `getPersonAttributedTotal` above, applied from the household's
 *      side rather than the person's.
 *   3. `groupCollectiveAmount`, when the expense is in split/allocate
 *      tracking mode with no explicit `groupAllocations` entries.
 *
 * `excludeFromSpend` transactions are skipped entirely, matching the
 * real function.
 *
 * trackingMode inference below intentionally mirrors
 * `getMyExpenseAmount`'s (App.jsx ~L1245) specific fallback: "split" if
 * ANY people entry other than `__me__` exists, regardless of mode. This
 * does NOT match `getGroupCollectiveDue`'s fallback (~L1232, requires
 * mode:"owes" AND unsettled) or the transaction-normalization-time
 * fallback (~L433, uses a `hasSplitPeople` flag) - those three inline
 * implementations diverge from each other (see BUG-TRX-002).
 * Unifying them is a real fix, out of scope for this read-only adapter.
 *
 * @param {Object} args
 * @param {Array} args.periodTransactions - transactions for the period
 *   being summed (caller owns period filtering)
 * @param {Array} [args.allTransactions] - full transaction history, used
 *   to build the refund map if refundTotalsByExpense isn't already
 *   supplied. Required unless refundTotalsByExpense is passed directly.
 * @param {Object} [args.refundTotalsByExpense] - precomputed via
 *   buildRefundTotalsByExpense, for callers reusing it across multiple
 *   Household figures in one render. If omitted, built internally from
 *   allTransactions.
 * @returns {number}
 */
export function getHouseholdAttributedTotal({ periodTransactions, allTransactions, refundTotalsByExpense }) {
  const refundMap = refundTotalsByExpense || buildRefundTotalsByExpense(allTransactions);

  return periodTransactions.reduce((sum, expense) => {
    if (expense.type !== "expense") return sum;
    if (expense?.excludeFromSpend) return sum;

    const netAmount = Math.max(
      0,
      Number(expense?.amount || 0) - Number(refundMap[String(expense?.id)] || 0)
    );
    if (!(netAmount > 0)) return sum;

    // trackingMode inference - intentionally mirrors getMyExpenseAmount's
    // (App.jsx ~L1245) specific fallback. See BUG-TRX-002 for the
    // 3-way divergence this does NOT attempt to reconcile.
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

    return sum + Math.max(0, netAmount - attributedAway);
  }, 0);
}
/**
 * WP-4 Home — Budget carry-forward resolution.
 *
 * Resolves the effective monthly Planning Allocation after carry-forward,
 * matching BudgetPage's dashboard-tab legacy inline formula exactly
 * (characterized against the live formula before this extraction —
 * see domain/allocations/home.characterization.test.js).
 *
 * KNOWN DISCREPANCY, deliberately NOT corrected here (see engineering
 * decision log / Budget correctness finding): `prevMonthSpend` passed
 * into this function by the caller is computed via a raw
 * `type==="expense" && !groupId` sum, NOT getHouseholdAttributedTotal's
 * refund-netting / mode:"owes" attributed-away logic. This means
 * carry-forward's notion of "what did I spend last month" can disagree
 * with the canonical household spend figure shown elsewhere on the same
 * screen. This function preserves that exact legacy behavior — it does
 * not resolve the discrepancy, per explicit instruction not to mix a
 * behavior change into this repoint.
 *
 * @param {boolean} carryForwardEnabled
 * @param {number} baseMonthly - this period's base allocation (no carry-forward)
 * @param {number} prevMonthPlanning - previous period's base allocation
 * @param {number} prevMonthSpend - previous period's raw expense sum, per
 *   the legacy (non-canonical) filter — caller's responsibility, unchanged
 * @returns {number}
 */
export function resolveCarryForwardMonthly(carryForwardEnabled, baseMonthly, prevMonthPlanning, prevMonthSpend) {
  if (!carryForwardEnabled) return baseMonthly;
  return Math.max(0, baseMonthly + (prevMonthPlanning - prevMonthSpend));
}

/**
 * WP-4 Home — Percentage of budget spent so far (progress-bar value).
 *
 * Distinct from getBudgetVariance's variancePct (over/under variance) —
 * this answers "what fraction of budget is spent," a different question.
 * Do not substitute getBudgetVariance for this. Matches BudgetPage's
 * `dashPct` exactly.
 *
 * @param {number} spend
 * @param {number} budget
 * @returns {number} 0-100, clamped (matches the progress bar's actual use)
 */
export function getSpentPercentage(spend, budget) {
  const s = Number(spend || 0);
  const b = Number(budget || 0);
  if (b > 0) return Math.min(100, Math.round((s / b) * 100));
  return s > 0 ? 100 : 0;
}

/**
 * WP-4 Home — Safe-to-spend per day for the remainder of the period.
 * Matches BudgetPage's `dashSafePerDay` exactly.
 *
 * `daysLeftInPeriod` is caller-supplied (the legacy `daysLeft(viewMonth)`
 * helper's implementation was not verified as part of this extraction —
 * this function deliberately takes the already-computed number rather
 * than reimplementing date logic itself).
 *
 * @param {number} remaining - budget minus spend, may be negative
 * @param {number} daysLeftInPeriod
 * @param {number} monthlyBudget - used only to decide null-vs-number, matching legacy
 * @returns {number|null}
 */
export function getSafeToSpendPerDay(remaining, daysLeftInPeriod, monthlyBudget) {
  if (!(Number(monthlyBudget || 0) > 0)) return null;
  return Math.max(0, Math.round(Number(remaining || 0) / Math.max(1, Number(daysLeftInPeriod || 0))));
}

/**
 * WP-4 Home — Month-end forecast via linear same-period extrapolation.
 * Matches BudgetPage's `projectedMonthEnd`/`isProjectedOver`/
 * `projectedMarginPct` exactly.
 *
 * NOT the same calculation as OutlookPage's forecast (which uses
 * averageOfLastNMonthsVariableSpend, a 3-month historical average,
 * App.jsx ~L10628) — a genuinely different forecasting approach, not
 * unified with this one. Flagging so this extraction isn't read as
 * consolidating the two.
 *
 * @param {number} spend - spend so far this period
 * @param {number} daysElapsed
 * @param {number} daysInPeriod
 * @param {number} budget
 * @returns {{projectedMonthEnd: number, isProjectedOver: boolean, projectedMarginPct: number}}
 */
export function getMonthEndForecast(spend, daysElapsed, daysInPeriod, budget) {
  const dailyPace = daysElapsed > 0 ? Number(spend || 0) / daysElapsed : 0;
  const projectedMonthEnd = Math.round(dailyPace * daysInPeriod);
  const b = Number(budget || 0);
  const isProjectedOver = b > 0 && projectedMonthEnd > b;
  const projectedMarginPct = b > 0 ? Math.round(((b - projectedMonthEnd) / b) * 100) : 0;
  return { projectedMonthEnd, isProjectedOver, projectedMarginPct };
}

/**
 * WP-4 Home — Budget Health classification. Status only, NO formatted
 * string — adapter.js functions never touch presentation (established
 * pattern). BudgetPage's legacy `healthNote` builds a currency-formatted
 * sentence inline using sym/fmt; the UI layer composes that sentence
 * from this function's returned status, same as every other adapter
 * output.
 *
 * @param {boolean} isProjectedOver
 * @param {number} projectedMarginPct
 * @returns {{status: "over"|"close"|"onTrack"}}
 */
export function getBudgetHealthStatus(isProjectedOver, projectedMarginPct) {
  if (isProjectedOver) return { status: "over" };
  if (projectedMarginPct < 10) return { status: "close" };
  return { status: "onTrack" };
}
