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

import { generateFeePeriods } from "./periodGeneration.js";

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
  // P0 (2026-09-04) — redefined per the confirmed live bug: a starting-state
  // "paid" declaration (declareFeePeriodStartingState, wasPaid=true) sets
  // paidAmount with NO settlementLinks entry, per that function's own
  // documented design. That is a claim, not evidence — it must not, by
  // itself, permanently lock this period. Only a genuine transaction
  // (settlementLinks.length > 0, which settleFeePeriods guarantees always
  // accompanies a real paidAmount) is treated as immutable financial
  // history here. Discount/write-off/applied-credit are untouched by this
  // change — those are recorded facts independent of any payment claim,
  // not something a starting-state correction affects.
  const hasGenuinePayment = (period.settlementLinks || []).length > 0;
  const touched = hasGenuinePayment
    || (period.discountAmount || 0) > 0
    || (period.writeOffAmount || 0) > 0
    || (period.appliedCreditAmount || 0) > 0;
  if (touched) {
    throw new Error("editFeePeriodObligationAmount: this period has already been settled/discounted/credited — use a discount, write-off, or credit note instead of editing the obligation directly (decision #7)");
  }

  return { ...period, obligationAmount: newAmount };
}

// --- P0 (2026-09-04) — School Schedule Edit & Correction --------------------
//
// Three additions, all domain-layer, none touching billerAccountId/personId/
// billerAccounts[]/schoolRelationships[] — that territory stays exclusively
// PPL-006's (attemptSchoolAttributionChange / resolveSchoolAttribution),
// never merged with anything here. This file owns schoolName,
// schoolYearStart/End, rateRules, and feePeriods[] reconciliation only.
//
// Kept in this file rather than a new shared cross-domain module — "domain
// layer" here means not-UI, not-screen-helpers, matching where
// declareFeePeriodStartingState already lives. The functions below are
// shaped so a future shared extraction (mirroring how school/relationship.js
// already relates to membership/lifecycle.js) needs no rework, but that
// extraction isn't done speculatively, before a second real consumer exists.

/**
 * Correct an existing starting-state declaration — distinct from
 * declareFeePeriodStartingState, which is for the INITIAL declaration only
 * and refuses to run twice. This function exists specifically for "I
 * declared this wrong": a period marked paid at setup (paidAmount>0) with
 * no genuine transaction behind it (settlementLinks empty) is a claim, not
 * history, and must remain correctable. A genuinely transaction-backed
 * period can NEVER be corrected this way — that's real financial history,
 * not a declaration.
 *
 * This is an auditable financial correction — a reason is required, and
 * every correction is recorded in its own append-only audit array
 * (startingStateCorrections), matching the exact convention
 * discountEntries/writeOffEntries already establish in discountWriteOff.js:
 * the aggregate field (paidAmount) is the arithmetic source of truth, the
 * entries array exists purely so "why" is never lost. Never overwrites a
 * prior correction entry.
 *
 * Does not touch discountAmount/writeOffAmount/appliedCreditAmount/
 * settlementLinks — those are independent facts, unaffected by correcting
 * the starting-payment claim. Does not un-declare the period
 * (startingStateDeclared stays true) — this corrects the claim's value,
 * it doesn't erase the fact that a declaration was made.
 *
 * Does NOT create a transaction, a settlement link, or any evidence of
 * payment — it only corrects the assertion and records why.
 *
 * @param {Object} period - a feePeriods[] record
 * @param {boolean} newWasPaid - the corrected starting-state claim
 * @param {string} reason - required, non-empty — the auditable basis for the correction
 * @returns {Object} a new period object with paidAmount corrected and the
 *   correction appended to startingStateCorrections. Never mutates the input.
 * @throws {Error} if the period was never declared, if it has a genuine
 *   transaction behind it (settlementLinks non-empty), if newWasPaid isn't
 *   an explicit boolean, or if reason is missing/empty.
 */
export function correctFeePeriodStartingState(period, newWasPaid, reason) {
  if (!period || typeof period !== "object") {
    throw new Error("correctFeePeriodStartingState: a period object is required");
  }
  if (typeof newWasPaid !== "boolean") {
    throw new Error("correctFeePeriodStartingState: newWasPaid must be explicitly true or false — no default");
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new Error("correctFeePeriodStartingState: a reason is required");
  }
  if (!period.startingStateDeclared) {
    throw new Error("correctFeePeriodStartingState: this period has no starting-state declaration to correct");
  }
  if ((period.settlementLinks || []).length > 0) {
    throw new Error("correctFeePeriodStartingState: this period has a genuine transaction linked to it — that is real financial history, not a correctable declaration");
  }

  const previousWasPaid = (period.paidAmount || 0) > 0;
  return {
    ...period,
    paidAmount: newWasPaid ? period.obligationAmount : 0,
    startingStateCorrections: [
      ...(period.startingStateCorrections || []),
      { previousWasPaid, newWasPaid, reason, correctedAt: Date.now() },
    ],
  };
}

/**
 * Classify a fee period for edit/reconciliation purposes — the taxonomy
 * the P0 design specifies: protected, correctable, historical-editable,
 * or future.
 *
 * @param {Object} period
 * @param {string} todayStr - "YYYY-MM-DD", injectable for deterministic tests
 * @returns {"protected"|"correctable"|"historical-editable"|"future"}
 */
export function classifyPeriod(period, todayStr) {
  const hasGenuinePayment = (period.settlementLinks || []).length > 0;
  const hasOtherProtectedFact = (period.discountAmount || 0) > 0
    || (period.writeOffAmount || 0) > 0
    || (period.appliedCreditAmount || 0) > 0;
  if (hasGenuinePayment || hasOtherProtectedFact) return "protected";

  // A starting-state "paid" claim with no genuine transaction is correctable
  // regardless of whether the period is calendar-past or calendar-future —
  // protection status is about the claim's evidentiary weight, not the date.
  const isFakePaid = period.startingStateDeclared && (period.paidAmount || 0) > 0;
  if (isFakePaid) return "correctable";

  const isPast = period.periodStart < todayStr;
  return isPast ? "historical-editable" : "future";
}

/**
 * Reconcile a schedule's feePeriods[] against an edit to its dates and/or
 * rate rules. Reuses generateFeePeriods, UNMODIFIED, as the "what would an
 * untouched schedule produce" oracle — diffs its output against the
 * existing periods month-by-month rather than wholesale-replacing anything.
 * Handles shrink, expand, rate-only changes, and any combination of the
 * three uniformly, because all three reduce to the same question per
 * month: does a period already exist for it, and if so, is it safe to
 * touch?
 *
 * @param {Object} params
 * @param {Array} params.feePeriods - ALL periods for this one schedule (caller
 *   filters by scheduleId before calling — this function is schedule-agnostic)
 * @param {string} params.newSchoolYearStart
 * @param {string} params.newSchoolYearEnd
 * @param {Array} params.newRateRules
 * @param {string} params.todayStr - "YYYY-MM-DD", injectable for deterministic tests
 * @returns {{
 *   periodsToRemove: Array,      // existing periods to delete
 *   periodsToUpdate: Array,      // existing periods, with obligationAmount recalculated
 *   periodsToAdd: Array,         // genuinely new periods for newly-covered months
 *   periodsUnchanged: Array,     // existing periods, returned as-is
 *   protectedOutOfRange: Array,  // protected periods whose month falls outside the new range
 * }} None of the returned periods are mutated from their input form except
 *   periodsToUpdate, which carry a new obligationAmount only — every other
 *   field (id, settlementLinks, discountAmount, etc.) is preserved exactly.
 */
export function reconcileScheduleEdit({ feePeriods, newSchoolYearStart, newSchoolYearEnd, newRateRules, todayStr }) {
  const proposedPeriods = generateFeePeriods(newSchoolYearStart, newSchoolYearEnd, newRateRules);
  const proposedByMonth = new Map(proposedPeriods.map(p => [p.periodStart.slice(0, 7), p]));
  const existingMonths = new Set((feePeriods || []).map(p => p.periodStart.slice(0, 7)));

  const periodsToRemove = [];
  const periodsToUpdate = [];
  const periodsUnchanged = [];
  const protectedOutOfRange = [];

  for (const period of (feePeriods || [])) {
    const monthKey = period.periodStart.slice(0, 7);
    const classification = classifyPeriod(period, todayStr);
    const inNewRange = proposedByMonth.has(monthKey);

    if (classification === "protected") {
      periodsUnchanged.push(period);
      if (!inNewRange) protectedOutOfRange.push(period);
      continue;
    }
    if (!inNewRange) {
      periodsToRemove.push(period);
      continue;
    }
    if (classification === "future") {
      const newRate = proposedByMonth.get(monthKey).obligationAmount;
      if (newRate !== period.obligationAmount) {
        periodsToUpdate.push({ ...period, obligationAmount: newRate });
      } else {
        periodsUnchanged.push(period);
      }
      continue;
    }
    // "correctable" or "historical-editable", in range — actuals, kept as-is.
    periodsUnchanged.push(period);
  }

  const periodsToAdd = proposedPeriods.filter(p => !existingMonths.has(p.periodStart.slice(0, 7)));

  return { periodsToRemove, periodsToUpdate, periodsToAdd, periodsUnchanged, protectedOutOfRange };
}
