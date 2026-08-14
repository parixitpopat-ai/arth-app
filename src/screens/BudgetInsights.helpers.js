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
