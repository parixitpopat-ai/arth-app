// domain/payments/paidWith.js
//
// Payments v2 (WP18c) — E3 "Paid with": a Transaction's payment lines (method + account + amount)
// must sum exactly to its total before the sheet can close — never a silent rounding fix. This is
// a small, generic sum/validate module, not specific to Education — the brief's own E3 note says
// "the same sheet opens from any Transaction's Paid from row, not only for school fees", so this
// file holds only the pure arithmetic any such sheet needs, independent of which screen uses it.
//
// This WP wires it into the new Pay Fees flow only (E2/E3/E4) — rewiring every other Transaction's
// existing single-account "Paid from" field to this multi-method sheet is Generic Transactions
// architecture, explicitly out of this WP's scope (see the WP brief). Nothing here prevents that
// later; this module makes no assumption about who calls it.

export const PAYMENT_METHODS = ["UPI", "Card", "Net Banking", "Cash", "Cheque"];

const EPS = 1e-9;

/** @returns {number} sum of every payment line's amount */
export function sumPaymentLines(lines) {
  return Math.round((lines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0) * 100) / 100;
}

/** @returns {number} total minus what's been assigned so far — positive: still to assign, negative: over-assigned */
export function paidWithDifference(lines, total) {
  return Math.round((Number(total || 0) - sumPaymentLines(lines)) * 100) / 100;
}

/** @returns {boolean} true only when every line has a method+account+positive amount AND the sum matches the total exactly */
export function isPaidWithBalanced(lines, total) {
  const list = lines || [];
  if (list.length === 0) return false;
  if (list.some(l => !l.method || !l.accId || !(Number(l.amount) > 0))) return false;
  return Math.abs(paidWithDifference(list, total)) < EPS;
}

/** A fresh, empty payment line for the "+ Add payment method" action. */
export function blankPaymentLine(genId) {
  return { id: genId(), method: PAYMENT_METHODS[0], accId: "", amount: "" };
}
