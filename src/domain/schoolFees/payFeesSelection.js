// domain/schoolFees/payFeesSelection.js
//
// Payments v2 (WP18c) — E2/E4. Pure helpers for the "Pay fees" sheet: several fee lines ticked
// into one Transaction, each line's amount independently editable from ₹1 up to what's left on
// that fee (the rest stays due, never written off), plus "Add something not listed" lines that
// have no fee period at all. No persistence, no Transaction creation, no settlement — this module
// only shapes and validates what the sheet is about to send into schoolFees/settlement.js
// (settleFeePeriods) and into the real Transaction, which stays App.jsx's job.
//
// Rules this module enforces (brief's own words):
// - a ticked line's amount can be anything from ₹1 to what is left on that fee;
// - an unticked/omitted fee is not part of the Transaction at all — it is simply never passed in;
// - "Add something not listed" needs a non-empty name and a positive amount, and carries no
//   periodId — settlement never sees it, it is stored directly on the Transaction;
// - the Transaction total is always the sum of every ticked line's amount plus every extra line's
//   amount — nothing here ever rounds or guesses that total.

import { calculateOutstanding } from "./outstanding.js";

/** The amount a freshly-ticked line defaults to — everything left on that fee. */
export function defaultLineAmount(period) {
  if (!period || !period.startingStateDeclared) return 0;
  return Math.max(0, calculateOutstanding(period));
}

/**
 * @param {Object} period
 * @param {number} amount
 * @returns {string|null} an error message, or null if the amount is valid for this line
 *   (a whole rupee from 1 up to the period's own remaining balance).
 */
export function validatePayFeesLineAmount(period, amount) {
  if (!period) return "This fee could not be found.";
  if (!period.startingStateDeclared) return "This fee's status isn't established yet.";
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "Enter an amount of at least ₹1.";
  const remaining = calculateOutstanding(period);
  if (n - remaining > 1e-9) return `Only ₹${remaining} is left on this fee — the rest stays due.`;
  return null;
}

/**
 * @param {Array<{amount:number}>} tickedLines - one entry per ticked fee line
 * @param {Array<{amount:number}>} extraLines - one entry per "add something not listed" line
 * @returns {number} the Transaction total — sum of everything ticked plus every extra line
 */
export function sumPayFeesTotal(tickedLines, extraLines) {
  const a = (tickedLines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const b = (extraLines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  return Math.round((a + b) * 100) / 100;
}

/**
 * @param {Array<{periodId:string, amount:number}>} tickedLines
 * @returns {Array<{periodId:string, amount:number}>} the exact shape settleFeePeriods'
 *   `allocations` parameter needs — zero/omitted lines are filtered out, since an unticked fee
 *   was never part of the selection at all.
 */
export function toSettlementAllocations(tickedLines) {
  return (tickedLines || []).filter(l => Number(l.amount) > 0).map(l => ({ periodId: l.periodId, amount: Number(l.amount) }));
}

/**
 * @param {string} name
 * @param {number} amount
 * @returns {string|null} an error message, or null if a new "not listed" line is valid
 */
export function validateExtraLine(name, amount) {
  if (!String(name || "").trim()) return "Give this item a name.";
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "Enter an amount of at least ₹1.";
  return null;
}
