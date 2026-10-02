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
// - "Add something not listed" needs a non-empty name, a positive amount, AND (WP18c-fix) a real
//   category — the whole point of this fix is that it is no longer a bare free-text line. It
//   still carries no periodId — settlement never sees it, it is stored directly on the
//   Transaction;
// - the Transaction total is always the sum of every ticked line's amount plus every extra line's
//   amount — nothing here ever rounds or guesses that total.
//
// WP18c-fix (Pay Fees mixed category) — buildPayFeesLineItems is the one new export: it turns
// this sheet's selection into the Transaction's REAL lineItems[] (the only category-attribution
// representation the app has — see domain/transactions/lineItemCategoryRollup.js), replacing the
// old Education-only `eduExtraLines` Transaction field. A ticked fee line's catId/subId are left
// null (see this WP's own investigation notes: no categoryId exists anywhere on a fee
// schedule/School Relationship to inherit from today), and it gets a `feePeriodId` stamped on —
// additive to LineItem's existing {id,label,qty,unit,unitPrice,catId,subId} shape, purely for
// traceability; settlement itself still runs off `linkedFeePeriods`/`toSettlementAllocations`
// below, unchanged.

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
 * @param {string|null|undefined} catId - WP18c-fix: a "not listed" line must carry a real
 *   category, the same as any other line item in the app — no longer a bare free-text line.
 * @returns {string|null} an error message, or null if a new "not listed" line is valid
 */
export function validateExtraLine(name, amount, catId) {
  if (!String(name || "").trim()) return "Give this item a name.";
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "Enter an amount of at least ₹1.";
  if (!catId) return "Pick a category for this item.";
  return null;
}

/**
 * Turns one Pay Fees selection into the Transaction's real lineItems[] — ticked fee lines first
 * (in their original order), then "not listed" lines. The ONLY category-attribution
 * representation this produces; see this file's header comment.
 *
 * @param {Array<{periodId:string, label:string, amount:number}>} tickedLines - one entry per
 *   ticked fee line, already resolved to a display label (this module has no opinion on fee
 *   naming — that stays the screen's `feeLineDisplayName`)
 * @param {Array<{id:string, name:string, amount:number, catId?:string|null, subId?:string|null}>} extraLines
 *   - one entry per "not listed" line, each with the real category the user picked
 * @returns {Array<{id:string, label:string, qty:number, unit:string, unitPrice:number, catId:string|null, subId:string|null, feePeriodId?:string}>}
 */
export function buildPayFeesLineItems(tickedLines, extraLines) {
  const feeItems = (tickedLines || []).map(l => ({
    id: `fee-${l.periodId}`,
    label: l.label || "Fee",
    qty: 1,
    unit: "nos",
    unitPrice: Number(l.amount) || 0,
    // No categoryId exists anywhere on a fee schedule/School Relationship to inherit from today
    // (confirmed by this WP's own investigation) — left uncategorized, same as any other
    // uncategorized line item in the app, rather than guessing a category id that may not exist
    // in a given user's real category list.
    catId: null,
    subId: null,
    feePeriodId: l.periodId,
  }));
  const extraItems = (extraLines || []).map(l => ({
    id: l.id,
    label: l.name,
    qty: 1,
    unit: "nos",
    unitPrice: Number(l.amount) || 0,
    catId: l.catId || null,
    subId: l.subId || null,
  }));
  return [...feeItems, ...extraItems];
}
