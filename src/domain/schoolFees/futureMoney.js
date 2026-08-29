// domain/schoolFees/futureMoney.js
//
// Pure School Fee → Future Money projection adapter — I-5 WP-8. No state,
// no side effects, no persistence, no second Future Money data store.
// `getCommitments()` (src/domain/bills/commitments.js) is not imported,
// referenced, or modified by this file in any way. This module is not
// wired into any consumer (Home/Outlook/getCommitments()) — per the I-1
// contract, Future Money is a composition of canonical projections, and no
// canonical composition layer exists yet (that's I-3/I-7, not built). This
// file only produces the projection; something else, later, composes it
// alongside whatever `getCommitments()` already produces.
//
// Locked gates, both required, checked in this order:
// 1. startingStateDeclared === true — an undeclared period's status is
//    genuinely unknown (WP-3); it must never be projected as a commitment,
//    because that would silently treat "unknown" as "owed."
// 2. calculateOutstanding(period) > 0 — a settled period (by any
//    combination of payment/discount/write-off/credit reaching the full
//    obligation) is resolved; I-1 says a resolved obligation gets no event.
//
// Every field on the output event is read directly from real data already
// on the period — nothing is computed speculatively, nothing is a
// placeholder. `amount` is the period's live outstanding balance (what's
// actually still owed right now), not its original obligationAmount — a
// partially-paid or partially-discounted period should project only what's
// left, never the original full figure.

import { calculateOutstanding } from "./outstanding.js";

/**
 * Project a single fee period into a Future Money event, or null if it
 * shouldn't be projected at all (undeclared, or already settled).
 *
 * @param {Object} period - a feePeriods[] record
 * @returns {Object|null} the I-1 canonical event shape, or null
 */
export function mapFeePeriodToCommitment(period) {
  if (!period || !period.startingStateDeclared) return null;

  const amount = calculateOutstanding(period);
  if (amount <= 0) return null;

  return {
    sourceType: "feePeriod",
    sourceId: period.id,
    category: "committedSpending",
    subCategory: "schoolFee",
    name: period.label,
    amount,
    date: period.dueDate,
    status: "unpaid",
    recurs: false,
  };
}

/**
 * Project a whole collection of fee periods into Future Money events,
 * silently dropping anything that shouldn't be projected (undeclared or
 * settled) — the caller gets back only genuine, current obligations.
 *
 * @param {Array} periods - feePeriods[], any mix of schedules/years
 * @returns {Array} Future Money events, one per genuinely outstanding,
 *   declared period
 */
export function projectFeePeriodsToCommitments(periods) {
  return (periods || [])
    .map(mapFeePeriodToCommitment)
    .filter(Boolean);
}
