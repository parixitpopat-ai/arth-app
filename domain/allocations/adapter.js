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
