// domain/insights/budgetPerformance.js
//
// WP8 — the Budget performance slice of the central Insights read model. classifyPersonStatus
// and buildPersonRows are promoted here, verbatim, from src/screens/BudgetInsights.helpers.js —
// per WP8's locked rule ("Do not create independent calculations inside individual Insight
// cards"), a calculation both BudgetInsights and the new top-level Insights page need must live
// in exactly one place.
//
// getHouseholdForecastSummary is new composition, not new math: per the explicit decision this
// WP locked (keep Budget's and Outlook's forecasts as the two different questions they already
// are — budget-margin pace vs. cash-solvency projection — rather than inventing a third method),
// this only re-exposes getMonthEndForecast/getBudgetHealthStatus's own result shape for Insights
// to render, exactly as BudgetPage's dashboard tab already computes it.

import {
  getPersonPlanningAllocation,
  getPersonAttributedTotal,
  getBudgetVariance,
  getBudgetHealthStatus,
  getMonthEndForecast,
} from "../allocations/adapter.js";

// Classifies a single person's budget status from already-canonical figures. Reuses
// getBudgetHealthStatus's existing three-way threshold (over / close (<10% margin) / onTrack)
// rather than inventing a new system, applied here to actual-vs-planned instead of
// forecast-vs-planned. Zero budget is a distinct, explicit state, not silently run through the
// same thresholds (which would misclassify a null/zero margin as "close").
export const classifyPersonStatus = (planned, actual) => {
  if (!(Number(planned) > 0)) {
    return { hasBudget: false, status: "no_budget", planned: Number(planned || 0), actual: Number(actual || 0), variance: null, variancePct: null, isOver: null };
  }
  const v = getBudgetVariance(actual, planned);
  const { status } = getBudgetHealthStatus(v.isOver, v.variancePct ?? 0);
  return { hasBudget: true, status, planned: Number(planned), actual: Number(actual || 0), ...v };
};

// Builds the Person View row set for a period: canonical planning + actual figures per person,
// classified via classifyPersonStatus, filtered to people with something to show, sorted by
// actual spend descending (so "who is driving spending" reads top-to-bottom by construction).
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

/**
 * WP8 — the household-level budget-margin forecast, for Insights to render. Identical
 * composition to BudgetPage dashboard's own calculation (App.jsx ~L14443-14447) — same inputs,
 * same functions, never re-derived. This is the "canonical forecasting method" for the budget
 * question ("will I stay within budget?"); the separate cash-solvency question Outlook answers
 * is intentionally NOT unified into this one — they answer different questions (see file header).
 *
 * @param {number} spend - this period's attributed household spend
 * @param {number} daysElapsed
 * @param {number} daysInPeriod
 * @param {number} budget - this period's planning allocation
 * @returns {{projectedMonthEnd, isProjectedOver, projectedMarginPct, status}}
 */
export function getHouseholdForecastSummary(spend, daysElapsed, daysInPeriod, budget) {
  const { projectedMonthEnd, isProjectedOver, projectedMarginPct } = getMonthEndForecast(spend, daysElapsed, daysInPeriod, budget);
  const { status } = getBudgetHealthStatus(isProjectedOver, projectedMarginPct);
  return { projectedMonthEnd, isProjectedOver, projectedMarginPct, status };
}
