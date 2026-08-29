// domain/schoolFees/annualSummary.js
//
// Pure annual read/calculation layer — I-5 WP-9. No state, no side effects,
// no persistence, no writes of any kind. Every value is computed live from
// feePeriods[]/schoolCreditNotes[] on every call — nothing here is cached
// or stored, so nothing here can drift from the underlying records.
//
// Locked accounting rules (I-5 plan correction #3):
// - grossAnnualCommitment sums EVERY period for the school year, declared
//   or not — this is a pure schedule fact, never affected by settlement.
// - amountPaid, discounts, writeOffs, appliedCredit only ever sum over
//   DECLARED periods — undeclared periods never contribute to any
//   settlement-side figure, only to the gross figure above.
// - remainingObligation/futureCashRequirement are a DIRECT SUM of each
//   declared period's own live outstanding balance — NEVER computed as
//   gross minus the other sums. A residual subtraction would silently
//   attribute undeclared periods' full amounts into "remaining," which is
//   exactly the "undeclared treated as unpaid" outcome decision #3
//   forbids. See the I-5 plan's own note on this for the full reasoning.
// - availableCredit is a schedule-level figure (summed across that
//   schedule's credit notes), not a period-level one.
// - Multi-year isolation: every figure here is filtered by scheduleId.
//   Nothing in this file ever aggregates across schedules unless a caller
//   explicitly asks it to (which nothing here does) — two different school
//   years' periods living in the same feePeriods[] array never bleed into
//   each other's totals, because every sum below is scoped to a single
//   scheduleId's periods only.

import { calculateOutstanding } from "./outstanding.js";
import { calculateAvailableCredit } from "./creditNotes.js";

/**
 * Compute the full annual summary for one school year's schedule.
 *
 * @param {string} scheduleId
 * @param {Array} allPeriods - feePeriods[], any mix of schedules/years —
 *   this function filters to the given scheduleId itself
 * @param {Array} allCreditNotes - schoolCreditNotes[], any mix of schedules
 * @returns {Object} the eight derived values
 */
export function calculateAnnualSummary(scheduleId, allPeriods, allCreditNotes) {
  if (!scheduleId) throw new Error("calculateAnnualSummary: scheduleId is required");

  const schedulePeriods = (allPeriods || []).filter(p => p.scheduleId === scheduleId);
  const declaredPeriods = schedulePeriods.filter(p => p.startingStateDeclared === true);
  const scheduleCreditNotes = (allCreditNotes || []).filter(n => n.scheduleId === scheduleId);

  const grossAnnualCommitment = schedulePeriods.reduce((s, p) => s + (p.obligationAmount || 0), 0);
  const amountPaid = declaredPeriods.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const discounts = declaredPeriods.reduce((s, p) => s + (p.discountAmount || 0), 0);
  const writeOffs = declaredPeriods.reduce((s, p) => s + (p.writeOffAmount || 0), 0);
  const appliedCredit = declaredPeriods.reduce((s, p) => s + (p.appliedCreditAmount || 0), 0);
  const availableCredit = scheduleCreditNotes.reduce((s, n) => s + calculateAvailableCredit(n), 0);

  // Direct sum over declared periods' own outstanding — NOT a residual
  // subtraction from grossAnnualCommitment. See file header.
  const remainingObligation = declaredPeriods.reduce((s, p) => s + calculateOutstanding(p), 0);
  const futureCashRequirement = remainingObligation;

  return {
    grossAnnualCommitment,
    amountPaid,
    discounts,
    writeOffs,
    availableCredit,
    appliedCredit,
    remainingObligation,
    futureCashRequirement,
  };
}
