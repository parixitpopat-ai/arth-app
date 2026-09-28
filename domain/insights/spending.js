// domain/insights/spending.js
//
// WP8 — the Spending slice of the central Insights read model. buildCategorySeries,
// buildSubcategoryBreakdown and their helpers are promoted here, verbatim, from
// src/screens/BudgetInsights.helpers.js — that file's own header already said it followed "same
// discipline as domain/allocations/adapter.js," and per WP8's locked rule ("Do not create
// independent calculations inside individual Insight cards"), a calculation that both
// BudgetInsights and the new top-level Insights page need must live in exactly one place. Nothing
// about the arithmetic changed in the move.
//
// getCategorySpendBreakdown and getTopMerchants are genuinely new here: nothing in the app
// currently ranks every category (or every merchant) by spend for a period — both are thin
// wrappers over already-canonical functions (getCategoryAttributedTotal, getFrequentVendors),
// never a new spend engine.

import { getCategoryAttributedTotal, buildRefundTotalsByExpense } from "../allocations/adapter.js";
import { getCalendarMonthBounds } from "../../src/domain/financialCalendar/calendarMonth.js";
import { shiftMonthKey } from "../../src/components/shiftMonthKey.js";
import { getFrequentVendors } from "../../src/domain/transactions/vendorInsights.js";

export const TRAILING_WINDOW = 6;

// Earliest "YYYY-MM" period with any transaction at all, across the whole household — used to
// bound the Category trend window so it never fabricates zero-history rows for periods before
// the household had any data.
export const getEarliestMonthKey = (txns) => {
  let earliest = null;
  for (const t of txns) {
    if (!t.date) continue;
    const key = t.date.slice(0, 7);
    if (!earliest || key < earliest) earliest = key;
  }
  return earliest;
};

// Builds the trailing period series ending at viewMonth (inclusive, always the last/anchor
// entry). Extends backward only as far as real household data exists, capped at
// TRAILING_WINDOW — never zero-padded to fill 6 slots when fewer periods of real data exist.
export const buildCategorySeries = (categoryId, viewMonth, txns) => {
  const earliestKey = getEarliestMonthKey(txns);
  const keys = [viewMonth];
  let k = viewMonth;
  for (let i = 1; i < TRAILING_WINDOW; i++) {
    if (!earliestKey) break; // no household data anywhere — anchor only
    const prev = shiftMonthKey(k, -1);
    if (prev < earliestKey) break;
    keys.unshift(prev);
    k = prev;
  }
  return keys.map(key => {
    const { label } = getCalendarMonthBounds(key);
    const periodTxns = txns.filter(t => t.date && t.date.startsWith(key));
    const attributedTotal = getCategoryAttributedTotal(periodTxns, categoryId, { allTransactions: txns });
    return { key, label, attributedTotal };
  });
};

// ============================================================
// Category → Subcategory breakdown (accounting-safe, no fabricated splits)
// ============================================================
// ACCOUNTING RULE (the product decision this implements):
//   - A transaction tagged with exactly ONE subcategory under the selected category: its full
//     category-attributed amount is unambiguously that subcategory's money.
//   - A transaction tagged with ZERO subcategories under the selected category: counted as
//     "untagged" — never silently dropped, never assigned to a subcategory it wasn't tagged with.
//   - A transaction tagged with TWO OR MORE subcategories: NO monetary split is fabricated. Its
//     amount is held in a separate "multiTag" bucket, excluded from every individual
//     subcategory's attributedAmount. The transaction is still counted (multiTagCount) against
//     every subcategory it's tagged with, as a tag-only reference with no dollar figure attached.
//
// RECONCILIATION INVARIANT (tested explicitly):
//   categoryTotal === sum(subcategories[].attributedAmount) + untaggedAmount + multiTagAmount

// Per-transaction attributed amount for a single category, replicating
// getCategoryAttributedTotal's exact rules at per-transaction granularity.
const getTxnCategoryAmount = (t, categoryId, refundMap) => {
  if (t.type !== "expense") return 0;
  if (t.catAllocations && Object.prototype.hasOwnProperty.call(t.catAllocations, categoryId)) {
    return Number(t.catAllocations[categoryId] || 0);
  }
  if (t.catAllocations) return 0;
  if (t.excludeFromSpend) return 0;
  const netAmount = Math.max(0, Number(t.amount || 0) - Number(refundMap[String(t.id)] || 0));
  if (!(netAmount > 0)) return 0;
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
  const trackingMode = t.trackingMode || (Object.keys(t.people || {}).some((pid) => pid !== "__me__") ? "split" : t.forPerson || t.groupId ? "tag" : "none");
  if ((trackingMode === "split" || trackingMode === "allocate") && groupAllocations.length === 0) {
    const collectivePart = Number(t.groupCollectiveAmount || 0);
    if (collectivePart > 0) attributedAway += collectivePart;
  }
  const myAmount = Math.max(0, netAmount - attributedAway);
  if (!(myAmount > 0)) return 0;
  const tCats = (Array.isArray(t.catIds) && t.catIds.length ? t.catIds : t.catId ? [t.catId] : []).filter(Boolean);
  if (!tCats.length || !tCats.includes(categoryId)) return 0;
  return myAmount / tCats.length;
};

// Same field-shape normalization used elsewhere in the app (t.subIds array, falling back to
// legacy t.subId) — replicated here since it's a 2-line field-normalization helper, not
// calculation logic, and isn't exported from anywhere importable.
const getTxnSubIdsLocal = (t) => {
  if (Array.isArray(t?.subIds) && t.subIds.length) return t.subIds.filter(Boolean);
  if (t?.subId) return [t.subId];
  return [];
};

// Builds the Category → Subcategory breakdown for a period. Never fabricates a monetary split
// for multi-subcategory transactions — see file header for the exact accounting rule.
export const buildSubcategoryBreakdown = (category, periodTxns, allTransactions) => {
  const categoryId = category.id;
  const subIdsInCategory = new Set((category.subs || []).map(s => s.id));
  const refundMap = buildRefundTotalsByExpense(allTransactions);

  const subRows = {};
  (category.subs || []).forEach(s => {
    subRows[s.id] = { subId: s.id, name: s.name, attributedAmount: 0, singleTagCount: 0, multiTagCount: 0 };
  });

  let untaggedAmount = 0, untaggedCount = 0;
  let multiTagAmount = 0, multiTagCount = 0;
  let categoryTotal = 0;

  for (const t of periodTxns) {
    const amt = getTxnCategoryAmount(t, categoryId, refundMap);
    if (!(amt > 0)) continue;
    categoryTotal += amt;

    const taggedSubs = getTxnSubIdsLocal(t).filter(sid => subIdsInCategory.has(sid));

    if (taggedSubs.length === 0) {
      untaggedAmount += amt;
      untaggedCount += 1;
    } else if (taggedSubs.length === 1) {
      const row = subRows[taggedSubs[0]];
      if (row) {
        row.attributedAmount += amt;
        row.singleTagCount += 1;
      }
    } else {
      multiTagAmount += amt;
      multiTagCount += 1;
      taggedSubs.forEach(sid => {
        const row = subRows[sid];
        if (row) row.multiTagCount += 1;
      });
    }
  }

  return {
    subcategories: Object.values(subRows).sort((a, b) => b.attributedAmount - a.attributedAmount),
    untaggedAmount,
    untaggedCount,
    multiTagAmount,
    multiTagCount,
    categoryTotal,
  };
};

/**
 * WP8 — every category ranked by attributed spend for a period. Nothing in the app currently
 * produces this household-wide ranking (BudgetInsights' Month tab does the equivalent inline,
 * per-render — this is that same loop, promoted so Insights and BudgetInsights share it).
 * Categories with zero spend for the period are omitted, never shown as a fabricated zero row.
 *
 * @param {Array} periodTxns - the caller's own already-filtered period transactions
 * @param {Array} categories - [{id, name, icon}]
 * @param {Array} allTransactions - full history, for refund netting
 * @returns {Array<{category, amount}>} sorted descending by amount
 */
export function getCategorySpendBreakdown(periodTxns, categories, allTransactions) {
  return (categories || [])
    .map(category => ({ category, amount: getCategoryAttributedTotal(periodTxns, category.id, { allTransactions }) }))
    .filter(row => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * WP8 — top merchants by transaction frequency (and spend), for a period. Thin wrapper over the
 * existing getFrequentVendors — never a second vendor-aggregation mechanism.
 *
 * @param {Array} periodTxns
 * @param {number} [limit]
 * @returns {Array} same shape as getFrequentVendors's result
 */
export function getTopMerchants(periodTxns, limit = 5) {
  return getFrequentVendors(periodTxns, limit);
}
