// domain/allocations/adapter.js
//
// WP-1 — Allocation Engine Integration (PR-1: adapter interfaces only)
// Implements ADR-035's read-side conceptual API against today's actual
// field shapes. Per WP-1 scope: NO behavior change, NO migration, NO UI
// change. Existing consumers (Home, OutlookPage, BudgetPage) are NOT
// modified by this PR — they continue reading their own local fields
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
// something this PR silently changes — doing so here would be a
// behavior change, which is out of scope for WP-1.

/**
 * Resolve the Planning Allocation amount for the Household dimension,
 * for a given period. Mirrors the six duplicate implementations found
 * in BUD-000's Mutation Census (AppContent, Home, OutlookPage,
 * BudgetPage) exactly — same formula, same `||` semantics — so that
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
 * Phase 4, CBR-BUD-10) — flat value only. This function does not
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
 * Resolve the Planning Allocation amount for a Person dimension, for a
 * given period. Uses `??` (nullish), not `||` — an explicit override of
 * 0 is respected as a deliberate zero, matching today's real behavior
 * at spendBudgetOverrides call sites (not unified with Household's `||`
 * semantics — see file header).
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
 * given period. Same `??` semantics as Person — see file header.
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
 * across a set of transactions, for the transaction's own recorded
 * category split (`catAllocations`). Read-only — does not touch
 * transaction state. Falls back to the transaction's primary `catId`
 * for transactions that predate category-split (no `catAllocations`
 * present), matching ADR-008's field-priority-resolution precedent
 * (resolve to one canonical source per transaction, don't double-count
 * legacy and current fields together).
 *
 * @param {Array} transactions
 * @param {string} categoryId
 * @returns {number}
 */
export function getCategoryAttributedTotal(transactions, categoryId) {
  return transactions.reduce((sum, t) => {
    if (t.type !== "expense") return sum;
    if (t.catAllocations && Object.prototype.hasOwnProperty.call(t.catAllocations, categoryId)) {
      return sum + Number(t.catAllocations[categoryId] || 0);
    }
    if (!t.catAllocations && t.catId === categoryId) {
      return sum + Number(t.amount || 0);
    }
    return sum;
  }, 0);
}

/**
 * Resolve the total Analytical Attribution for a Person dimension
 * across a set of transactions, reading `t.people`. Read-only.
 *
 * Counts only `mode: "spent_on"` entries — confirmed, evidence-based
 * business rule (CR-ACC-BUD-001 resolution): `mode: "owes"` represents
 * a temporary receivable owed back to the user (App.jsx's own `myShare`
 * formula explicitly excludes it from spend: `amount - sum(mode==="owes")`),
 * not attributable household/person spend. `mode: "spent_on"` is genuine
 * attributed spend with no debt. The real repository never uses
 * `mode: "on_me"` — that value does not exist in production data; earlier
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
 * Resolve the total Analytical Attribution for the Household dimension —
 * i.e. "what did I actually spend this period," mirroring App.jsx's
 * `getMyExpenseAmount` (~L1240, composed with `getNetExpenseAmount`
 * ~L1224) exactly. Read-only — does not touch transaction state.
 *
 * Nets out, in order:
 *   1. Refunds matched to an expense via `settlement_in` transactions'
 *      `againstTxnId` — matched against `allTransactions` (or a
 *      precomputed `refundTotalsByExpense`), NOT `periodTransactions`,
 *      because a refund can post in a later period than the expense it
 *      applies to (see adapter.test.js's cross-period refund test).
 *      Matching only within the period would silently under-net
 *      expenses whose refund landed elsewhere. Caller owns period
 *      filtering — this function does not know about months, fiscal
 *      years, or ADR-037's Financial Calendar.
 *   2. Amounts attributed away to other people or groups via
 *      `mode: "owes"` entries in `people` or `groupAllocations` — same
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
 * fallback (~L433, uses a `hasSplitPeople` flag) — those three inline
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

    // trackingMode inference — intentionally mirrors getMyExpenseAmount's
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
