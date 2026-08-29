// domain/schoolFees/startingState.js
//
// Pure functions for I-5 WP-3 (starting-state declaration) and WP-4 (period
// amount edit). No state, no side effects, no persistence, no Bills/
// Membership/getCommitments() interaction. Nothing here is wired into any
// UI yet — these are the domain-logic functions a future UI slice calls;
// building that UI (the actual "prompt the user" screen/modal) is a
// separate, distinct unit of work from this domain-logic layer and is not
// part of this delivery — see the accompanying report for why that's kept
// separate rather than folded in silently.
//
// WP-3 — locked rule (I-5 plan correction #1): startingStateDeclared is a
// hard visibility gate, not a status flag with a default. A period is
// either genuinely undeclared (invisible everywhere downstream — enforced
// by every consumer checking this flag, not by this file), or explicitly
// declared paid or unpaid by the user. Nothing here ever infers one from
// the other, and this function refuses to run at all without an explicit
// boolean.
//
// WP-4 — locked rule (decision #7, first half): editing obligationAmount is
// only valid for a period that hasn't been touched by any settlement yet.
// Once paidAmount, discountAmount, writeOffAmount, or appliedCreditAmount is
// non-zero, decision #7 requires the discount/credit-note path instead —
// this function enforces that split by refusing the edit outright rather
// than silently allowing an already-settled obligation to be rewritten.

/**
 * Declare the starting state of a pre-existing fee period — WP-3.
 *
 * @param {Object} period - a feePeriods[] record
 * @param {boolean} wasPaid - true if the user says this period was already
 *   paid before Arth tracked it; false if genuinely unpaid. Must be an
 *   explicit boolean — there is no default.
 * @returns {Object} a new period object with the declaration applied.
 *   Never mutates the input.
 * @throws {Error} if wasPaid is not strictly a boolean, or period is missing.
 */
export function declareFeePeriodStartingState(period, wasPaid) {
  if (!period || typeof period !== "object") {
    throw new Error("declareFeePeriodStartingState: a period object is required");
  }
  if (typeof wasPaid !== "boolean") {
    throw new Error("declareFeePeriodStartingState: wasPaid must be explicitly true or false — no default");
  }
  if (period.startingStateDeclared) {
    throw new Error("declareFeePeriodStartingState: this period has already been declared — this function is for the initial declaration only");
  }

  return {
    ...period,
    startingStateDeclared: true,
    // Declaring "paid" records a starting-balance fact, NOT a transaction —
    // no settlementLinks entry is created, because Arth has no record of
    // the original payment. Declaring "unpaid" leaves paidAmount as-is
    // (0, for a freshly generated period that's never been touched).
    paidAmount: wasPaid ? period.obligationAmount : period.paidAmount,
  };
}

/**
 * Which periods currently need an explicit starting-state declaration —
 * i.e. the period has already ended, but no declaration has been made yet.
 * A future UI layer uses this to decide what to prompt for; this function
 * itself makes no UI decisions and renders nothing.
 *
 * @param {Array} periods - feePeriods[], for one schedule or many
 * @param {Date} [today] - injectable for deterministic tests
 * @returns {Array} the subset of periods needing declaration
 */
export function getPeriodsNeedingDeclaration(periods, today = new Date()) {
  const todayStr = today.toISOString().slice(0, 10);
  return (periods || []).filter(p => !p.startingStateDeclared && p.periodEnd < todayStr);
}

/**
 * Edit the obligation amount of a not-yet-settled fee period — WP-4.
 *
 * @param {Object} period - a feePeriods[] record
 * @param {number} newAmount - the corrected obligation amount
 * @returns {Object} a new period object with obligationAmount updated.
 *   Never mutates the input.
 * @throws {Error} if newAmount isn't a positive finite number, or if the
 *   period has already received any payment, discount, write-off, or
 *   applied credit — per decision #7, a touched period must be corrected
 *   via discount/credit-note, never by rewriting its obligation directly.
 */
export function editFeePeriodObligationAmount(period, newAmount) {
  if (!period || typeof period !== "object") {
    throw new Error("editFeePeriodObligationAmount: a period object is required");
  }
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    throw new Error("editFeePeriodObligationAmount: newAmount must be a positive number");
  }
  const touched = (period.paidAmount || 0) > 0
    || (period.discountAmount || 0) > 0
    || (period.writeOffAmount || 0) > 0
    || (period.appliedCreditAmount || 0) > 0;
  if (touched) {
    throw new Error("editFeePeriodObligationAmount: this period has already been settled/discounted/credited — use a discount, write-off, or credit note instead of editing the obligation directly (decision #7)");
  }

  return { ...period, obligationAmount: newAmount };
}
