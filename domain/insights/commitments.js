// domain/insights/commitments.js
//
// WP8 — the Mandatory commitments and Recurring costs slices of the central Insights read
// model. Mandatory commitments has no new math here at all: domain/allocations/adapter.js
// already owns getMandatoryCommitmentsTotal/getMandatoryCommitmentRemaining/
// getMandatoryCommitmentState/getDiscretionaryPool — Insights imports and reuses them directly,
// never re-derives them (re-exported below only for a single, discoverable Insights import
// surface, not a copy).
//
// getRecurringCostsSummary is new composition, not new math: it groups the ALREADY-composed
// Future Money list (committedSpending + committedSaving + debtService, WP4's canonical
// composition of Bills/SIPs/CC statements/School Fees/Memberships/Insurance/Debt EMIs) by
// subCategory/sourceType — the same array every other screen (Outlook, Budget) already reads,
// never a second commitment-composition engine.

export {
  getMandatoryCommitmentsTotal,
  getMandatoryCommitmentRemaining,
  getMandatoryCommitmentState,
  getDiscretionaryPool,
  getUnallocatedDiscretionary,
} from "../allocations/adapter.js";

import { groupFutureMoneyByRhythm } from "../../src/domain/futureMoney/rhythm.js";
import { getCategoryAttributedTotal } from "../allocations/adapter.js";

const RECURRING_LABELS = {
  bill: "Bills", ccStatement: "Card Statements", recurringSchedule: "SIPs",
  feePeriod: "School Fees", membership: "Memberships", insurancePolicy: "Insurance", debt: "Debt / EMIs",
};

/**
 * WP8 — every recurring commitment (spending + saving + debt service) grouped by its real
 * source type, with a count and total per group. Reads the same futureMoney object Outlook and
 * Budget already compute once per render (committedSpending/committedSaving/debtService) — this
 * function never touches bills/recurringSchedules/etc. directly, only the already-composed list.
 *
 * @param {{committedSpending: Array, committedSaving: Array, debtService: Array}} futureMoney
 * @returns {Array<{sourceType, label, count, total}>} sorted descending by total
 */
export function getRecurringCostsSummary(futureMoney) {
  const all = [
    ...(futureMoney?.committedSpending || []),
    ...(futureMoney?.committedSaving || []),
    ...(futureMoney?.debtService || []),
  ];
  const groups = {};
  all.forEach(c => {
    const key = c.sourceType || "other";
    if (!groups[key]) groups[key] = { sourceType: key, label: RECURRING_LABELS[key] || key, count: 0, total: 0 };
    groups[key].count += 1;
    groups[key].total += Number(c.amount || 0);
  });
  return Object.values(groups).sort((a, b) => b.total - a.total);
}

// WP12 — "Recurring costs" (section 4) over the next 12 months, per the handoff's own worked
// example (₹5,01,368 = Loans + SIPs + Insurance + Bills/cards/fees/memberships). Deliberately
// NOT getRecurringCostsSummary's single-next-occurrence total: this reuses Outlook's own
// groupFutureMoneyByRhythm (src/domain/futureMoney/rhythm.js, built for Outlook's WP10 redesign)
// to get the real monthly rhythm baseline plus every one-off event due within 12 months, then
// sums rather than re-deriving anything — "inherits Outlook's status rules" per the handoff's
// own Flag 4, because it IS Outlook's calculation, read again.
const RECURRING_DISPLAY_GROUPS = {
  debt: "Loans",
  recurringSchedule: "SIPs",
  insurancePolicy: "Insurance",
  bill: "Bills, cards, fees, memberships",
  ccStatement: "Bills, cards, fees, memberships",
  feePeriod: "Bills, cards, fees, memberships",
  membership: "Bills, cards, fees, memberships",
};

/**
 * @param {{committedSpending: Array, committedSaving: Array, debtService: Array}} futureMoney
 * @param {string} fromDateStr - YYYY-MM-DD, same reference date Outlook itself uses
 * @returns {{total: number, groups: Array<{label, total}>}}
 */
export function getRecurringCostsOver12Months(futureMoney, fromDateStr) {
  const { everyMonthEvents, everyMonthTotal, monthBuckets } = groupFutureMoneyByRhythm(futureMoney, fromDateStr, { monthsAhead: 12 });
  const totals = {};
  const add = (label, amount) => { totals[label] = (totals[label] || 0) + amount; };

  everyMonthEvents.forEach(e => add(RECURRING_DISPLAY_GROUPS[e.sourceType] || "Bills, cards, fees, memberships", Number(e.amount || 0) * 12));
  monthBuckets.forEach(bucket => bucket.items.forEach(e => add(RECURRING_DISPLAY_GROUPS[e.sourceType] || "Bills, cards, fees, memberships", Number(e.amount || 0))));

  const groups = Object.entries(totals).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
  const total = groups.reduce((sum, g) => sum + g.total, 0);
  return { total, groups };
}

// WP12 — the trailing-N-month history line under each Mandatory Commitment (section 3), e.g.
// "6-month average ₹9,640 · within budget 5 of 6". The handoff's own mock shows three different
// captions per commitment (an average + within-count for a variable one, a "Paid on the 1st" +
// paid-count for a fixed one, a "Skipped in July" + paid-count for one with a real skip) — that
// implies a per-commitment heuristic for WHICH caption to show that isn't actually specified
// anywhere in the handoff text, so rather than guess three unstated rules, this applies one
// honest, consistent rule to every commitment: the average real spend and the count of months
// that stayed within the commitment amount, over the real skippedMonths + real category spend
// history — using the exact same getCategoryAttributedTotal every other commitment figure on
// Budget's own dashboard already calls, no second spend engine.
//
// @param {Object} commitment - a mandatoryCommitments[] record ({categoryId, skippedMonths})
// @param {Array} txns - full transaction list
// @param {Array<string>} monthKeys - the trailing months to look back over, oldest first
// @returns {{average: number, withinCount: number, consideredMonths: number, skippedCount: number, totalMonths: number}}
export function getCommitmentHistory(commitment, txns, monthKeys) {
  let consideredMonths = 0;
  let withinCount = 0;
  let spendTotal = 0;
  let skippedCount = 0;
  (monthKeys || []).forEach(monthKey => {
    if ((commitment.skippedMonths || []).includes(monthKey)) { skippedCount += 1; return; }
    const monthTxns = (txns || []).filter(t => t.date && t.date.startsWith(monthKey));
    const spent = getCategoryAttributedTotal(monthTxns, commitment.categoryId, { allTransactions: txns });
    consideredMonths += 1;
    spendTotal += spent;
    if (spent <= Number(commitment.amount || 0)) withinCount += 1;
  });
  return { average: consideredMonths > 0 ? spendTotal / consideredMonths : 0, withinCount, consideredMonths, skippedCount, totalMonths: (monthKeys || []).length };
}
