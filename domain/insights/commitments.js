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
