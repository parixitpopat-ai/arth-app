// domain/schoolFees/service.js
//
// Application-boundary service layer for School Fees — I-5 WP-10. This is
// the "make the completed domain layer usable" file: it wraps WP-2 through
// WP-9's pure functions with real id generation where a new record is
// being created, and assembles the read model a future School Fees screen
// will consume. It adds no new business logic or calculations of its own
// — every number here comes from calling an already-tested WP-2–9
// function; this file's only job is composition and wiring.
//
// This module has NO dependency on React, App.jsx, or any global state.
// Every function takes explicit state in and returns new state out, same
// as every other file in this domain — fully testable with node --test.
// The thin React-side wiring (passing App.jsx's real setFeeSchedules/
// setFeePeriods/setSchoolCreditNotes/genId down to whatever screen
// component eventually calls these) is a separate, later step — see the
// accompanying WP-10 report for exactly what is and isn't connected yet.
//
// Explicitly NOT done here, per the locked scope:
// - No School Fees screen/UI component.
// - No changes to Bills, Membership, Insurance, or getCommitments().
// - No new Future Money calculation — getSchoolFeeCommitments() is a
//   direct passthrough to WP-8's projectFeePeriodsToCommitments(), never a
//   second implementation of it.
// - No Transaction creation — settlePeriods() requires a real, already-
//   created txnId, exactly as WP-5 already required. The existing
//   transaction model (however a School Fee payment eventually gets
//   entered — likely the normal expense-transaction flow) is preserved
//   untouched; this file only computes how that payment distributes
//   across the selected periods once a real transaction exists.

import { generateFeePeriods } from "./periodGeneration.js";
import {
  declareFeePeriodStartingState,
  getPeriodsNeedingDeclaration,
  editFeePeriodObligationAmount,
} from "./startingState.js";
import { calculateSelectedOutstandingTotal, settleFeePeriods } from "./settlement.js";
import { applyDiscount, applyWriteOff } from "./discountWriteOff.js";
import { createSchoolCreditNote, applyCreditToPeriod } from "./creditNotes.js";
import { calculateOutstanding } from "./outstanding.js";
import { projectFeePeriodsToCommitments } from "./futureMoney.js";
import { calculateAnnualSummary } from "./annualSummary.js";

// Re-exported directly — no wrapping value to add, these are already the
// exact shape a caller needs.
export { getPeriodsNeedingDeclaration };

// --- Create ----------------------------------------------------------------

/**
 * Create a new School Fee schedule for one school year, and generate its
 * fee periods in the same step. Each new school year is its own schedule
 * — this function never looks at or touches any other schedule.
 *
 * @param {Object} input - { billerAccountId, personId, schoolYearStart, schoolYearEnd, rateRules }
 * @param {Function} genId - real id generator, injected (App.jsx's own genId)
 * @returns {{schedule:Object, periods:Array}} the new schedule record and
 *   its generated periods — caller appends both to feeSchedules[]/feePeriods[]
 */
export function createSchoolFeeSchedule(input, genId) {
  if (typeof genId !== "function") {
    throw new Error("createSchoolFeeSchedule: genId function is required");
  }
  const { billerAccountId, personId, schoolYearStart, schoolYearEnd, rateRules } = input || {};
  const scheduleId = genId();
  const schedule = {
    id: scheduleId,
    billerAccountId: billerAccountId || null,
    personId: personId || null,
    schoolYearStart,
    schoolYearEnd,
    rateRules,
    createdAt: Date.now(),
  };
  // generateFeePeriods (WP-2) assigns its own period ids internally — this
  // function only attaches the schedule's id afterward, it never generates
  // an id itself for a period.
  const periods = generateFeePeriods(schoolYearStart, schoolYearEnd, rateRules)
    .map(p => ({ ...p, scheduleId }));
  return { schedule, periods };
}

// --- Starting-state declaration (WP-3) --------------------------------------

/**
 * Declare one period's starting state within a full feePeriods[] collection.
 * @returns {Array} a new feePeriods[] array, only the named period changed
 */
export function declareStartingState(feePeriods, periodId, wasPaid) {
  return (feePeriods || []).map(p => (p.id === periodId ? declareFeePeriodStartingState(p, wasPaid) : p));
}

// --- Edit obligation amount (WP-4) ------------------------------------------

/** @returns {Array} a new feePeriods[] array, only the named period changed */
export function editPeriodAmount(feePeriods, periodId, newAmount) {
  return (feePeriods || []).map(p => (p.id === periodId ? editFeePeriodObligationAmount(p, newAmount) : p));
}

// --- Settlement (WP-5) -------------------------------------------------------

/** Thin passthrough — see settlement.js for the actual logic. */
export function calculateSelectedTotal(feePeriods, periodIds) {
  return calculateSelectedOutstandingTotal(feePeriods, periodIds);
}

/**
 * Settle selected periods against a real, already-created transaction.
 * @returns {Array} a new feePeriods[] array
 */
export function settlePeriods(feePeriods, periodIds, actualAmount, txnId, allocations) {
  return settleFeePeriods(feePeriods, periodIds, actualAmount, txnId, allocations);
}

// --- Discount / write-off (WP-6) --------------------------------------------

/** @returns {Array} a new feePeriods[] array, only the named period changed */
export function discountPeriod(feePeriods, periodId, amount, reason) {
  return (feePeriods || []).map(p => (p.id === periodId ? applyDiscount(p, amount, reason) : p));
}

/** @returns {Array} a new feePeriods[] array, only the named period changed */
export function writeOffPeriod(feePeriods, periodId, amount, reason) {
  return (feePeriods || []).map(p => (p.id === periodId ? applyWriteOff(p, amount, reason) : p));
}

// --- Credit notes (WP-7) -----------------------------------------------------

/**
 * Create a new, standalone school credit note.
 * @param {Function} genId - real id generator, injected
 */
export function createCreditNote(scheduleId, amount, reason, genId) {
  return createSchoolCreditNote(scheduleId, amount, reason, genId);
}

/**
 * Apply part of a credit note's available balance to a specific period.
 * Looks both records up by id within the given collections, then delegates
 * to WP-7's applyCreditToPeriod for the actual logic.
 *
 * @returns {{updatedCreditNotes:Array, updatedFeePeriods:Array}}
 */
export function applyCredit(schoolCreditNotes, feePeriods, noteId, periodId, amount) {
  const note = (schoolCreditNotes || []).find(n => n.id === noteId);
  if (!note) throw new Error(`applyCredit: credit note ${noteId} not found`);
  const period = (feePeriods || []).find(p => p.id === periodId);
  if (!period) throw new Error(`applyCredit: period ${periodId} not found`);

  const { updatedNote, updatedPeriod } = applyCreditToPeriod(note, period, amount, calculateOutstanding);

  return {
    updatedCreditNotes: schoolCreditNotes.map(n => (n.id === noteId ? updatedNote : n)),
    updatedFeePeriods: feePeriods.map(p => (p.id === periodId ? updatedPeriod : p)),
  };
}

// --- Read model ----------------------------------------------------------------

/**
 * Assemble the full read model a School Fees screen needs: every schedule,
 * with its own periods, credit notes, annual summary (WP-9), and the
 * subset of its periods still awaiting a starting-state declaration
 * (WP-3). Nothing here is a new calculation — it's composition of the
 * already-tested per-domain functions, scoped per schedule.
 *
 * @returns {Array<{schedule, periods, creditNotes, summary, periodsNeedingDeclaration}>}
 */
export function getSchoolFeeReadModel(feeSchedules, feePeriods, schoolCreditNotes) {
  return (feeSchedules || []).map(schedule => {
    const periods = (feePeriods || []).filter(p => p.scheduleId === schedule.id);
    const creditNotes = (schoolCreditNotes || []).filter(n => n.scheduleId === schedule.id);
    return {
      schedule,
      periods,
      creditNotes,
      summary: calculateAnnualSummary(schedule.id, feePeriods, schoolCreditNotes),
      periodsNeedingDeclaration: getPeriodsNeedingDeclaration(periods),
    };
  });
}

// --- Future Money ----------------------------------------------------------------

/**
 * Project School Fee periods into Future Money commitment events. A direct
 * passthrough to WP-8 — this function exists only so a future consumer has
 * one obvious place to import from (the service layer) without needing to
 * know futureMoney.js exists separately. It is never a second calculation.
 */
export function getSchoolFeeCommitments(feePeriods) {
  return projectFeePeriodsToCommitments(feePeriods);
}
