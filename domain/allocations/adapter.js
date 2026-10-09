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
// WP6 (Arth IA — Budget Core Model, 2026-09-28) — the `||` vs `??` split this
// file used to preserve deliberately is now RESOLVED: Household unifies onto
// `??`, matching Person/Group exactly. An explicit household month override
// of 0 is a deliberate zero, not "not meaningfully set" — same rule as
// Person/Group already had. This is a real behavior change to existing
// Budget numbers for anyone who's set a household override to exactly 0,
// decided explicitly (not inferred) before building the Mandatory/
// Discretionary hierarchy on top of it, per the locked decision record in
// the "Arth IA — Payments, Outlook, Budget & Insights" doc, §12.

/**
 * Resolve the Planning Allocation amount for the Household dimension,
 * for a given period. Same `??` semantics as Person/Group (WP6) - an
 * explicit override of 0 is respected as a deliberate zero.
 *
 * @param {number} annualBudget
 * @param {Object} monthOverrides - { [monthKey: "YYYY-MM"]: number }
 * @param {string} monthKey
 * @returns {number}
 */
export function getHouseholdPlanningAllocation(annualBudget, monthOverrides, monthKey) {
  return monthOverrides[monthKey] ?? Math.round(Number(annualBudget || 0) / 12);
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
 * given period. Uses `??` (nullish) - an explicit override of 0 is
 * respected as a deliberate zero. Household uses this same semantics now
 * too (WP6) - all three dimensions are unified.
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
 * given period. Same `??` semantics as Person and Household (WP6).
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
 * @param {boolean} [options.includeTransfers] - WP16: also count `type:
 *   "transfer"` transactions tagged (via `catId`/`catIds`) to this
 *   category. Default false - every existing caller (StatsPage's
 *   catTotals, the "Not in budget" / Unplanned Actual figures, etc.)
 *   keeps summing expense-only spend exactly as before. Pass true only
 *   for a Mandatory Commitment's own "spent" figure: a Transfer tagged
 *   to a commitment's category is an explicit, accepted product decision
 *   that it fulfils that commitment the moment it's tagged, regardless
 *   of what happens to the money afterward. The rest of this function's
 *   netting/attribution logic (refunds, `mode:"owes"`, groupCollective)
 *   applies unchanged - a tagged Transfer never populates those fields
 *   today, so this is a pure widening of the type guard, not new math.
 * @returns {number}
 */
export function getCategoryAttributedTotal(transactions, categoryId, { allTransactions, refundTotalsByExpense, includeTransfers } = {}) {
  const refundMap = refundTotalsByExpense || buildRefundTotalsByExpense(allTransactions || transactions);

  return transactions.reduce((sum, t) => {
    if (t.type !== "expense" && !(includeTransfers && t.type === "transfer")) return sum;

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
    return sum + getMyExpenseShare(expense, refundMap);
  }, 0);
}

/**
 * My share of ONE expense: amount less refunds, less what others owe me (people / group
 * allocations / group collective), zero when excluded from spend. The single per-transaction rule
 * behind both getHouseholdAttributedTotal and App.jsx's getMyExpenseAmount (which used to be a
 * hand-copied duplicate; the two were proven equivalent before this was extracted).
 * Does NOT check `type` - callers pass expenses.
 *
 * @param {Object} expense
 * @param {Object} refundMap - from buildRefundTotalsByExpense
 * @returns {number}
 */
export function getMyExpenseShare(expense, refundMap) {
  if (expense?.excludeFromSpend) return 0;

  const netAmount = Math.max(
    0,
    Number(expense?.amount || 0) - Number((refundMap || {})[String(expense?.id)] || 0)
  );
  if (!(netAmount > 0)) return 0;

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

  return Math.max(0, netAmount - attributedAway);
}
/**
 * WP-4 Home — Budget carry-forward resolution.
 *
 * Resolves the effective monthly Planning Allocation after carry-forward,
 * matching BudgetPage's dashboard-tab legacy inline formula exactly
 * (characterized against the live formula before this extraction —
 * see domain/allocations/home.characterization.test.js).
 *
 * `prevMonthSpend` is the previous month's household spend from
 * getCarryForwardPrevSpend (below) - the same attributed figure shown as
 * "Spent" everywhere else, not a separate gross-expense sum.
 *
 * @param {boolean} carryForwardEnabled
 * @param {number} baseMonthly - this period's base allocation (no carry-forward)
 * @param {number} prevMonthPlanning - previous period's base allocation
 * @param {number} prevMonthSpend - previous period's raw expense sum, per
 *   the legacy (non-canonical) filter — caller's responsibility, unchanged
 * @returns {number}
 */
const previousMonthKey = (monthKey) => {
  const [y, m] = String(monthKey).split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

/**
 * The monthly budget a screen should measure spending against: the month's planning allocation, plus
 * (only when carry-forward is enabled) last month's allocation less last month's attributed spend, never
 * below zero. The one entry point for Home, Budget and Insights, so they cannot drift (BUD-001: carry-forward
 * stays Budget-owned and is implemented once). Carry-forward is off unless the caller says otherwise.
 *
 * @returns {{base:number, effective:number, carry:number, prevMonthKey:string, prevPlanning:number, prevSpend:number}}
 *   prevSpend is always reported (Insights shows it even when carry-forward is off); it only affects
 *   `effective` when carryForwardEnabled is true.
 */
export function getEffectiveMonthlyBudget({ annualBudget, monthOverrides, monthKey, carryForwardEnabled = false, transactions }) {
  const overrides = monthOverrides || {};
  const base = getHouseholdPlanningAllocation(annualBudget, overrides, monthKey);
  const prevMonthKey = previousMonthKey(monthKey);
  const prevPlanning = getHouseholdPlanningAllocation(annualBudget, overrides, prevMonthKey);
  const prevSpend = getCarryForwardPrevSpend(transactions, prevMonthKey);
  const effective = resolveCarryForwardMonthly(Boolean(carryForwardEnabled), base, prevPlanning, prevSpend);
  return { base, effective, carry: effective - base, prevMonthKey, prevPlanning, prevSpend };
}

/**
 * Previous month's household spend for budget carry-forward. This IS getHouseholdAttributedTotal over
 * that month's transactions (refunds netted, excluded expenses and receivables left out, group
 * attribution applied) - carry-forward must not keep its own gross definition of "spent".
 *
 * @param {Array} allTransactions
 * @param {string} prevMonthKey - "YYYY-MM"
 * @returns {number}
 */
export function getCarryForwardPrevSpend(allTransactions, prevMonthKey) {
  const all = allTransactions || [];
  return getHouseholdAttributedTotal({
    periodTransactions: all.filter((t) => (t.date || "").startsWith(prevMonthKey)),
    allTransactions: all,
  });
}

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

// --- WP6 (Arth IA — Budget Core Model) ---------------------------------
//
// The hierarchy the IA locked: Monthly Budget (getHouseholdPlanningAllocation,
// above) minus Mandatory Commitments = Discretionary Pool; Person/Group
// Planning Allocations (already implemented above) are envelopes carved out
// of that pool; whatever's left is Unallocated. This is new work layered on
// top of the existing sibling-dimension functions above — it does not
// replace or recompute them, and it adds no second spend engine: a Mandatory
// Commitment's "remaining" is arithmetic over the exact same
// getCategoryAttributedTotal a caller already has, per the locked invariant
// "spending reduces exactly one envelope, computed once."
//
// A Mandatory Commitment record: { id, name, amount, categoryId }. No
// month-override layer, deliberately — same reasoning getCategoryPlanningAllocation
// already documents for Category (flat only); amount changes are edits, not
// a parallel per-month map for a handful of user-defined line items.

/**
 * Sum of every Mandatory Commitment's amount — the "Mandatory Commitments"
 * figure in the hierarchy (e.g. Household 5,000 + Spouse support 3,000 +
 * Pocket money 2,000 = 10,000).
 *
 * @param {Array} mandatoryCommitments - [{id, name, amount, categoryId}]
 * @returns {number}
 */
export function getMandatoryCommitmentsTotal(mandatoryCommitments) {
  return (mandatoryCommitments || []).reduce((sum, c) => sum + Number(c?.amount || 0), 0);
}

/**
 * How much of one Mandatory Commitment is left, given what's actually been
 * spent against its linked category so far this period. Thin wrapper over
 * getBudgetVariance (same arithmetic, relabeled for this dimension) — not a
 * second calculation. `spent` is the caller's own
 * getCategoryAttributedTotal(periodTransactions, commitment.categoryId)
 * result; this function never reads transactions itself.
 *
 * @param {Object} commitment - {amount}
 * @param {number} spent
 * @returns {{spent: number, remaining: number, isOver: boolean}}
 */
export function getMandatoryCommitmentRemaining(commitment, spent) {
  const { variance, isOver } = getBudgetVariance(spent, commitment?.amount);
  return { spent: Number(spent || 0), remaining: variance, isOver };
}

/**
 * Discretionary Pool = Monthly Budget − Mandatory Commitments. Not floored
 * at 0 — if commitments exceed the budget, that's a real over-commitment,
 * and hiding it behind a floor would be exactly the kind of silent
 * inconsistency ADR-035/BUD-000A already flagged once for this file (see
 * the || vs ?? history above). Callers surface a negative pool as a warning,
 * not a broken UI.
 *
 * @param {number} monthlyBudget - getHouseholdPlanningAllocation's result
 * @param {number} mandatoryCommitmentsTotal - getMandatoryCommitmentsTotal's result
 * @returns {number}
 */
export function getDiscretionaryPool(monthlyBudget, mandatoryCommitmentsTotal) {
  return Number(monthlyBudget || 0) - Number(mandatoryCommitmentsTotal || 0);
}

/**
 * Sum of every Person/Group Planning Allocation envelope carved out of the
 * Discretionary Pool this period. Takes already-resolved amounts (each
 * from getPersonPlanningAllocation/getGroupPlanningAllocation) rather than
 * Person/Group objects themselves — stays a pure arithmetic function, like
 * getBudgetVariance, with no knowledge of either shape.
 *
 * @param {Array<number>} allocationAmounts
 * @returns {number}
 */
export function getDiscretionaryAllocatedTotal(allocationAmounts) {
  return (allocationAmounts || []).reduce((sum, n) => sum + Number(n || 0), 0);
}

/**
 * Unallocated discretionary = Discretionary Pool − Σ(Person/Group
 * allocations). Not floored, same reasoning as getDiscretionaryPool — a
 * negative result means allocations exceed the pool, which
 * getAllocationHierarchyWarning below turns into a real warning rather than
 * a silently-clamped number.
 *
 * @param {number} discretionaryPool
 * @param {number} allocatedTotal
 * @returns {number}
 */
export function getUnallocatedDiscretionary(discretionaryPool, allocatedTotal) {
  return Number(discretionaryPool || 0) - Number(allocatedTotal || 0);
}

/**
 * The Σ(children) ≤ parent check the hierarchy needs and the sibling
 * Planning Allocation dimensions never had (per the IA doc: "today these
 * are independent sibling dimensions, no parent/child nesting, no
 * Σ(children) ≤ parent check anywhere. That check is new work this model
 * requires.") Returns null when allocations fit inside the pool; a plain
 * data object (no formatted string — presentation stays in the UI layer,
 * same as getBudgetHealthStatus) when they don't, so a caller can warn
 * without silently clamping anything.
 *
 * @param {number} discretionaryPool
 * @param {number} allocatedTotal
 * @returns {{overBy: number}|null}
 */
export function getAllocationHierarchyWarning(discretionaryPool, allocatedTotal) {
  const overBy = Number(allocatedTotal || 0) - Number(discretionaryPool || 0);
  return overBy > 0 ? { overBy } : null;
}

/**
 * WP7 correction — the locked IA does not treat Σ allocations ≤ Discretionary Pool as
 * warning-only: an allocation that would push the total over the pool must be rejected, not
 * silently persisted. This is the single-candidate version of getAllocationHierarchyWarning
 * above, evaluated BEFORE a write: "if I commit this one candidate amount, alongside every
 * other allocation exactly as it already stands, does the total fit?" Every other allocation
 * stays exactly as it is — this never touches or reconsiders them, only the one being entered.
 * Returns null when it fits (the caller may commit); a plain data object when it doesn't (the
 * caller must refuse the write and keep whatever the person typed on screen, never clamp it to
 * a guessed valid number).
 *
 * @param {number} discretionaryPool
 * @param {number} otherAllocationsTotal - Σ every OTHER Person/Group allocation, i.e. the
 *   existing allocatedTotal with this one dimension's current committed amount subtracted out
 * @param {number} candidateAmount - the not-yet-committed amount being typed/entered
 * @returns {{overBy: number}|null}
 */
export function wouldExceedDiscretionaryPool(discretionaryPool, otherAllocationsTotal, candidateAmount) {
  const overBy = Number(otherAllocationsTotal || 0) + Number(candidateAmount || 0) - Number(discretionaryPool || 0);
  return overBy > 0 ? { overBy } : null;
}

/**
 * The dismissedAlerts[] id for "has this month's Mandatory Commitments been
 * confirmed" — same month-scoped id shape App.jsx's existing budget alerts
 * already use (`budget_<subject>_<monthKey>_<variant>`), reused rather than
 * inventing a second confirmation-tracking array. Confirming appends this
 * id to the existing dismissedAlerts[] state; nothing new to persist.
 *
 * @param {string} monthKey - "YYYY-MM"
 * @returns {string}
 */
export function getMandatoryCommitmentsConfirmationId(monthKey) {
  return `mandatory_confirm_${monthKey}`;
}

/**
 * Has this month's Mandatory Commitments total already been confirmed?
 *
 * @param {Array<string>} dismissedAlerts
 * @param {string} monthKey
 * @returns {boolean}
 */
export function isMandatoryCommitmentsConfirmed(dismissedAlerts, monthKey) {
  return (dismissedAlerts || []).includes(getMandatoryCommitmentsConfirmationId(monthKey));
}

/**
 * WP7 — which of the four states a single Mandatory Commitment is in for a
 * given month: "skipped" (explicitly marked not happening this month, same
 * per-month opt-out shape as the existing skippedInvestmentMonths[] pattern
 * — a commitment.skippedMonths array of monthKeys, nothing new invented),
 * "actual" (money has actually moved against its linked category this
 * month), or "planned" (reserved, nothing spent against it yet). A skipped
 * commitment is "actual" only in the trivial sense that spend could still
 * post to its category even after being skipped — that's surfaced as
 * "actual", not silently reclassified back to skipped, since real spend
 * happened regardless of the plan.
 *
 * @param {Object} commitment - {skippedMonths?: string[]}
 * @param {number} spent - caller's own getCategoryAttributedTotal result
 * @param {string} monthKey - "YYYY-MM"
 * @returns {"skipped"|"actual"|"planned"}
 */
export function getMandatoryCommitmentState(commitment, spent, monthKey) {
  if (Number(spent) > 0) return "actual";
  if ((commitment?.skippedMonths || []).includes(monthKey)) return "skipped";
  return "planned";
}

/**
 * WP14 — Person/Group-scoped Mandatory Commitments. Locked product decision: a Mandatory
 * Commitment "for Household" (categoryId only, no scope — every existing commitment, untouched)
 * reduces the Household Discretionary Pool exactly as before. A commitment the person explicitly
 * creates FOR a specific Person or Group (e.g. "Spouse's phone bill ₹699" carved out of her own
 * envelope) is a DIFFERENT thing: it must reduce only THAT Person/Group's own envelope, never the
 * household pool a second time (the envelope itself was already carved out of the household pool).
 * Reuses the exact same record shape ({id, name, amount, categoryId, skippedMonths}) plus two new
 * optional fields (scopeType: "person"|"group", scopeId) rather than a second commitments array —
 * an existing record with neither field is implicitly household-scoped, zero migration needed.
 * Every existing function above (getMandatoryCommitmentsTotal, getMandatoryCommitmentRemaining,
 * getMandatoryCommitmentState, getDiscretionaryPool) is reused unchanged on the filtered subset —
 * no new arithmetic, no second spend engine, just the same recursion one level deeper: a Person's
 * own Discretionary = getDiscretionaryPool(personPlanningAllocation, that person's commitments
 * total), the identical formula the Household already uses one level up.
 */

/**
 * Is this commitment Household-scoped (the only kind that existed before WP14)? True for every
 * commitment with no scopeType at all (all pre-existing data) or scopeType explicitly "household".
 *
 * @param {Object} commitment - {scopeType?}
 * @returns {boolean}
 */
export function isHouseholdScopedCommitment(commitment) {
  return !commitment?.scopeType || commitment.scopeType === "household";
}

/**
 * The commitments created FOR one specific Person or Group — never includes Household-scoped
 * commitments or a different Person/Group's own.
 *
 * @param {Array} mandatoryCommitments
 * @param {"person"|"group"} scopeType
 * @param {string} scopeId
 * @returns {Array}
 */
export function getCommitmentsForScope(mandatoryCommitments, scopeType, scopeId) {
  return (mandatoryCommitments || []).filter(
    c => c?.scopeType === scopeType && String(c.scopeId) === String(scopeId)
  );
}

/**
 * WP7 — the fourth state, "Unplanned Actual": which categories have NO
 * Mandatory Commitment covering them this month (skipped commitments don't
 * count as coverage — their category is exactly as unplanned as one with no
 * commitment at all). Returns category ids only; the caller runs its own
 * getCategoryAttributedTotal per id (the existing attribution function,
 * same as every other figure on this page) to find which of those ids
 * actually have spend against them — this function does not touch
 * transactions or amounts at all, matching getDiscretionaryAllocatedTotal's
 * "pure arithmetic/set logic, no knowledge of the caller's other shapes"
 * pattern.
 *
 * @param {Array} categories - [{id}]
 * @param {Array} mandatoryCommitments - [{categoryId, skippedMonths?}]
 * @param {string} monthKey - "YYYY-MM"
 * @returns {Array<string>} category ids not covered by any active commitment
 */
export function getUnplannedCategoryIds(categories, mandatoryCommitments, monthKey) {
  const coveredIds = new Set(
    (mandatoryCommitments || [])
      .filter(c => !(c?.skippedMonths || []).includes(monthKey))
      .map(c => c.categoryId)
  );
  return (categories || []).filter(cat => !coveredIds.has(cat.id)).map(cat => cat.id);
}
