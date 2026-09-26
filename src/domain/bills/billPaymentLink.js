// domain/bills/billPaymentLink.js
//
// QW-1 (UI-2C plan). Rules for the "Bill payment" link in the transaction form
// (txn.paidBillId → one Bill), fixing the "bill deselection" bug:
//
//   - The chosen bill used to be recomputed from match candidates (exact amount +
//     category + ±45 days). Any edit to amount, category or date reset the choice,
//     so the link silently dropped or swapped, and saving with no candidate left
//     created a NEW paid Bill while the real one stayed unpaid (a duplicate).
//   - Saving a payment against an existing Bill overwrote that Bill's due date
//     with the payment date.
//
// Now: once a bill is chosen it stays chosen; a changed amount is surfaced as a
// mismatch that blocks the save until the user resolves it; an existing Bill's
// amount and due date are never overwritten by a payment. Partial payment
// ("Keep link" with a remainder, T-33) is ADR-038 / WP-4, not this module.

const NEW_BILL = "__new__"; // the form's "Not these — new bill" choice

/**
 * Next value of the form's bill choice when the candidate list changes.
 * "" = nothing chosen yet, "__new__" = user dismissed the candidates, else a bill id.
 * A choice is only auto-filled while nothing is chosen; an existing choice is kept
 * unless the chosen bill no longer exists at all.
 */
export function nextBillMatchChoice(currentChoice, candidateIds, existingBillIds) {
  if (currentChoice === NEW_BILL) return currentChoice;
  if (currentChoice) {
    const stillExists = (existingBillIds || []).some(id => String(id) === String(currentChoice));
    if (stillExists) return currentChoice;
  }
  return (candidateIds && candidateIds.length) ? candidateIds[0] : "";
}

/**
 * The bills to show as choices: the candidates, plus the chosen bill if it is no
 * longer a candidate (so a kept link is always visible instead of vanishing).
 */
export function getBillChoicesToShow(candidates, chosenBill) {
  const list = candidates || [];
  if (!chosenBill || list.some(b => String(b.id) === String(chosenBill.id))) return list;
  return [chosenBill, ...list];
}

/**
 * null when the payment amount matches the chosen bill; otherwise the two amounts.
 * Only amount matters: category and date edits never affect the link (T-32).
 */
export function getBillLinkAmountMismatch(chosenBill, paymentAmount) {
  if (!chosenBill) return null;
  const billAmount = Number(chosenBill.amount || 0);
  const paid = Number(paymentAmount || 0);
  if (!(billAmount > 0) || Math.abs(billAmount - paid) < 0.005) return null;
  return { billAmount, paymentAmount: paid };
}

/**
 * Applies a payment record onto an EXISTING bill without rewriting what defines the
 * bill itself: its amount and due date are kept. Everything else keeps today's merge.
 */
export function mergePaymentIntoExistingBill(existingBill, paymentRecord) {
  return {
    ...existingBill,
    ...paymentRecord,
    amount: existingBill.amount,
    dueDate: existingBill.dueDate || paymentRecord.dueDate,
  };
}
