// domain/insights/people.js
//
// WP8 — the People/Groups slice of the central Insights read model. buildGroupRows mirrors
// budgetPerformance.js's buildPersonRows exactly (same classifyPersonStatus classification,
// same "planned>0 || actual>0" filter, same actual-descending sort) — the only difference is
// Groups don't have an injection-free attributed-total function the way Person does
// (getPersonAttributedTotal lives in domain/allocations/adapter.js; the group equivalent,
// getGroupAttributedAmount, is a per-transaction App.jsx-local function tied to live household
// membership/allocation state). Per the same injection pattern domain/person/personOverview.js
// already uses for exactly this reason ("never reimplement how a transaction's amount is
// attributed"), the real function is passed in rather than re-derived here.

import { getGroupPlanningAllocation } from "../allocations/adapter.js";
import { classifyPersonStatus } from "./budgetPerformance.js";

/**
 * Builds the Group insight row set for a period: canonical planning + actual figures per group,
 * classified via the same Within Budget/Approaching/Over/No Budget thresholds Person rows use,
 * filtered to groups with something to show, sorted by actual spend descending.
 *
 * @param {Array} groups
 * @param {Array} periodTxns - the caller's own already-filtered period transactions
 * @param {string} viewMonth - "YYYY-MM"
 * @param {Function} getGroupAttributedAmount - injected, the real existing (t, groupId) => amount
 *   function (App.jsx's own getGroupAttributedAmount), never reimplemented here
 * @returns {Array<{group, ...classification}>}
 */
export function buildGroupRows(groups, periodTxns, viewMonth, getGroupAttributedAmount) {
  if (!groups) return [];
  return groups
    .map(g => {
      const planned = getGroupPlanningAllocation(g, viewMonth);
      const actual = (periodTxns || []).reduce((sum, t) => sum + getGroupAttributedAmount(t, g.id), 0);
      return { group: g, ...classifyPersonStatus(planned, actual) };
    })
    .filter(r => r.planned > 0 || r.actual > 0)
    .sort((a, b) => b.actual - a.actual);
}
