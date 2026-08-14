// src/screens/BudgetInsights.helpers.js
//
// Pure calculation logic for BudgetInsights, extracted from the component
// so it's directly unit-testable with Node's test runner (no JSX/React
// transform needed) — same discipline as domain/allocations/adapter.js.
// BudgetInsights.jsx imports from this file; nothing here touches React
// or renders anything.
import {
  getCategoryAttributedTotal,
  getPersonPlanningAllocation,
  getPersonAttributedTotal,
  getBudgetVariance,
  getBudgetHealthStatus,
  buildRefundTotalsByExpense,
} from "../../domain/allocations/adapter.js";
import { getCalendarMonthBounds } from "../domain/financialCalendar/calendarMonth.js";
import { shiftMonthKey } from "../components/shiftMonthKey.js";

export const TRAILING_WINDOW = 6;

// Earliest "YYYY-MM" period with any transaction at all, across the whole
// household — used to bound the Category trend window so it never
// fabricates zero-history rows for periods before the household had any
// data (BUD-002 D.3, resolved per the BUD-Insights evidence pass finding
// that the prior implementation always zero-padded to exactly 6 rows).
export const getEarliestMonthKey = (txns) => {
  let earliest = null;
  for (const t of txns) {
    if (!t.date) continue;
    const key = t.date.slice(0, 7);
    if (!earliest || key < earliest) earliest = key;
  }
  return earliest;
};

// Builds the trailing period series ending at viewMonth (inclusive, always
// the last/anchor entry — the selected period always remains the anchor).
// Extends backward only as far as real household data exists, capped at
// TRAILING_WINDOW. Does NOT zero-pad to fill 6 slots when fewer periods of
// real data exist. A period within the real data range that happens to have
// zero attribution for THIS category still renders as a legitimate zero row
// (the household existed, this category had no spend that period) — only
// periods before any household data existed are excluded from the series.
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

// Classifies a single person's budget status from already-canonical
// figures. Reuses getBudgetHealthStatus's existing three-way threshold
// (over / close (<10% margin) / onTrack) rather than inventing a new
// system — the same classification Home's Budget Health tile already
// uses, applied here to actual-vs-planned instead of forecast-vs-planned.
// Zero budget is a distinct, explicit state, not silently run through the
// same thresholds (which would misclassify a null/zero margin as "close").
export const classifyPersonStatus = (planned, actual) => {
  if (!(Number(planned) > 0)) {
    return { hasBudget: false, status: "no_budget", planned: Number(planned || 0), actual: Number(actual || 0), variance: null, variancePct: null, isOver: null };
  }
  const v = getBudgetVariance(actual, planned);
  const { status } = getBudgetHealthStatus(v.isOver, v.variancePct ?? 0);
  return { hasBudget: true, status, planned: Number(planned), actual: Number(actual || 0), ...v };
};

// Builds the Person View row set for a period: canonical planning + actual
// figures per person, classified via classifyPersonStatus, filtered to
// people with something to show, sorted by actual spend descending (so
// "who is driving spending" reads top-to-bottom by construction).
export const buildPersonRows = (people, periodTxns, viewMonth) => {
  if (!people) return [];
  return people
    .map(p => {
      const planned = getPersonPlanningAllocation(p, viewMonth);
      const actual = getPersonAttributedTotal(periodTxns, p.id);
      return { person: p, ...classifyPersonStatus(planned, actual) };
    })
    .filter(r => r.planned > 0 || r.actual > 0)
    .sort((a, b) => b.actual - a.actual);
};

// ============================================================
// Category → Subcategory breakdown (accounting-safe, no fabricated splits)
// ============================================================
// ACCOUNTING RULE (the product decision this implements):
//   - A transaction tagged with exactly ONE subcategory under the selected
//     category: its full category-attributed amount is unambiguously that
//     subcategory's money. Counted toward that subcategory's total.
//   - A transaction tagged with ZERO subcategories under the selected
//     category: its amount is real category spend with no subcategory
//     tag. Counted as "untagged" — never silently dropped, never assigned
//     to a subcategory it wasn't tagged with.
//   - A transaction tagged with TWO OR MORE subcategories under the
//     selected category: NO monetary split is fabricated. Its amount is
//     held in a separate "multiTag" bucket, excluded from every individual
//     subcategory's attributedAmount. The transaction is still counted
//     (multiTagCount) against every subcategory it's tagged with, as a
//     tag-only reference with no dollar figure attached — so a user can
//     see "this subcategory is also referenced by 2 multi-category
//     transactions" without those transactions' money appearing to belong
//     to it.
//
// RECONCILIATION INVARIANT (tested explicitly, not just asserted here):
//   categoryTotal === sum(subcategories[].attributedAmount) + untaggedAmount + multiTagAmount
//   sum(subcategories[].attributedAmount) is therefore ALWAYS <= categoryTotal
//   when any multi-tag or untagged transaction exists — subcategory rows
//   never falsely sum to the category total in that case, by construction.

// Per-transaction attributed amount for a single category, replicating
// getCategoryAttributedTotal's exact rules at per-transaction granularity.
// Returns 0 for any transaction that doesn't contribute to this category
// (wrong type, excluded, refunded to zero, fully attributed away, or not
// tagged to this category at all).
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

// Same field-shape normalization getTxnSubIds() already uses elsewhere in
// App.jsx (t.subIds array, falling back to legacy t.subId) — replicated
// here since it's a 2-line field-normalization helper, not calculation
// logic, and isn't exported from anywhere importable.
const getTxnSubIdsLocal = (t) => {
  if (Array.isArray(t?.subIds) && t.subIds.length) return t.subIds.filter(Boolean);
  if (t?.subId) return [t.subId];
  return [];
};

// Builds the Category → Subcategory breakdown for a period. Never
// fabricates a monetary split for multi-subcategory transactions — see
// file header for the exact accounting rule and reconciliation invariant.
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
      // Two or more subcategories tagged — NO split fabricated. Amount
      // held in the multiTag bucket only. Each tagged subcategory gets a
      // tag-only reference count, no amount.
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
