// domain/cards/emiSettlement.js
//
// Corrected CC EMI settlement allocation. Fixes a real bug found in the
// live cc_payment handler: loan.outstanding was being reduced by the FULL
// aggregate of all unpaid EMI installments on the card, and every one of
// those installments was marked paidInBill:true, regardless of whether the
// actual payment amount covered that much. A ₹500 payment against ₹9,000
// of pending EMI installments would incorrectly clear all of it.
//
// This module does NOT create a new EMI mechanism. It reuses every
// existing field (ccEmiPlanId, installmentNo, loans[].outstanding,
// loans[].repayments[]) and the same overall trigger (a cc_payment
// transaction). The only change is HOW MUCH of the pending EMI total gets
// attributed to a given payment — now capped at the actual payment amount,
// applied oldest-installment-first, instead of an unconditional sweep.
//
// New field: `emiAmountSettled` (number, per cc_emi transaction) replaces
// the old boolean `paidInBill`. Confirmed via full-file grep that
// `paidInBill` had exactly two readers in the entire app, both inside the
// buggy block being replaced here — safe to introduce a richer field
// without breaking anything else. A derived `paidInBill` boolean
// (`emiAmountSettled >= amount`) is still set alongside it, purely for
// backward compatibility with anything that might read it later.
//
// Cross-plan ordering: if a card has multiple active EMI plans, pending
// installments across ALL of them are settled together, oldest-by-date
// first — the only fair, unambiguous ordering available across different
// plans (installmentNo only orders installments *within* one plan).
// Documented choice, not silently assumed.
//
// This does NOT touch getCardSummary/currentDue — that calculation is
// already correct and independent of this bookkeeping; verified by
// direct inspection of domain/cards/summaries.js.
//
// This does NOT enforce or fix the separate tenure-cap gap (an
// installment count can currently exceed a plan's stated tenure) — that's
// an unrelated finding, doesn't affect this settlement logic, and isn't
// touched here per the explicit instruction to keep it separate.

/**
 * Allocate a single CC payment across a card's pending (not-yet-fully-
 * settled) EMI installments, oldest-first, never allocating more than the
 * payment amount, never over-crediting a single installment beyond its own
 * remaining amount.
 *
 * @param {Array} loans - the full loans[] array (only CC-linked loans for
 *   this card are touched; everything else passes through unchanged)
 * @param {Array} txns - the full txns[] array (only cc_emi transactions
 *   for this card are touched; everything else passes through unchanged)
 * @param {string} cardId - the card account id the payment was made to
 * @param {number} paymentAmount - the actual cc_payment amount
 * @param {string} paymentDate - date of the payment (for the repayment log)
 * @param {Function} genId - real id generator, injected
 * @returns {{updatedLoans:Array, updatedTxns:Array, totalAllocated:number}}
 *   totalAllocated is how much of paymentAmount was actually applied to
 *   EMI installments (may be less than paymentAmount if there was nothing
 *   left pending, or the payment exceeded all pending installments).
 */
export function allocateCcPaymentToEmiInstallments(loans, txns, cardId, paymentAmount, paymentDate, genId) {
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return { updatedLoans: loans, updatedTxns: txns, totalAllocated: 0 };
  }

  const cardLoans = (loans || []).filter(loan =>
    loan.direction === "taken" &&
    (loan.sourceType === "cc" || loan.ccLinked === true) &&
    loan.linkedCardId === cardId &&
    loan.status !== "closed"
  );
  if (cardLoans.length === 0) {
    return { updatedLoans: loans, updatedTxns: txns, totalAllocated: 0 };
  }
  const loanIdByPlanId = new Map(cardLoans.map(loan => [loan.ccEmiPlanId, loan.id]));
  const planIds = new Set(cardLoans.map(loan => loan.ccEmiPlanId).filter(Boolean));

  // Gather pending installments across ALL plans on this card, oldest-by-date first.
  const pendingInstallments = (txns || [])
    .filter(t => t.type === "cc_emi" && t.accId === cardId && planIds.has(t.ccEmiPlanId))
    .filter(t => (Number(t.amount || 0) - Number(t.emiAmountSettled || 0)) > 1e-9) // not yet fully settled
    .slice()
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  if (pendingInstallments.length === 0) {
    return { updatedLoans: loans, updatedTxns: txns, totalAllocated: 0 };
  }

  let remaining = paymentAmount;
  const allocationByTxnId = new Map(); // txnId -> amount applied this time
  const allocatedByLoanId = new Map(); // loanId -> total applied this time

  for (const installment of pendingInstallments) {
    if (remaining <= 1e-9) break;
    const stillOwedOnThis = Number(installment.amount || 0) - Number(installment.emiAmountSettled || 0);
    const applyHere = Math.min(remaining, stillOwedOnThis);
    if (applyHere <= 0) continue;

    allocationByTxnId.set(installment.id, applyHere);
    const loanId = loanIdByPlanId.get(installment.ccEmiPlanId);
    if (loanId) {
      allocatedByLoanId.set(loanId, (allocatedByLoanId.get(loanId) || 0) + applyHere);
    }
    remaining -= applyHere;
  }

  const totalAllocated = paymentAmount - remaining;
  const consideredTxnIds = new Set(pendingInstallments.map(t => t.id));

  const updatedTxns = (txns || []).map(t => {
    if (!consideredTxnIds.has(t.id)) return t; // not part of this card's pending set at all — untouched
    const applied = allocationByTxnId.get(t.id) || 0; // 0 if considered but nothing reached it
    const newEmiAmountSettled = Number(t.emiAmountSettled || 0) + applied;
    return {
      ...t,
      emiAmountSettled: newEmiAmountSettled,
      paidInBill: newEmiAmountSettled - Number(t.amount || 0) >= -1e-9, // always explicit — never undefined for anything considered this round
    };
  });

  const updatedLoans = (loans || []).map(loan => {
    const applied = allocatedByLoanId.get(loan.id);
    if (!applied) return loan;
    const newOutstanding = Math.max(0, Number(loan.outstanding || 0) - applied);
    return {
      ...loan,
      outstanding: newOutstanding,
      status: newOutstanding <= 0 ? "closed" : "active",
      repayments: [
        ...(loan.repayments || []),
        { id: genId(), date: paymentDate, amount: applied, note: `CC bill payment — partial or full EMI settlement` },
      ],
    };
  });

  return { updatedLoans, updatedTxns, totalAllocated };
}

/**
 * Recompute what a loan's outstanding SHOULD be, independently of the
 * incrementally-maintained `loan.outstanding` field — the reconciliation
 * check. Correct formula: principal minus the total ever actually settled
 * across this plan's installments. This holds regardless of how many of
 * the plan's future installments have been logged as transactions yet —
 * an installment that hasn't been created yet simply hasn't had anything
 * settled against it, so it doesn't need to appear here for the equation
 * to be correct. Used in tests as an independent cross-check against the
 * incremental value `allocateCcPaymentToEmiInstallments` produces.
 */
export function calculateExpectedLoanOutstanding(loan, txns) {
  const installments = (txns || []).filter(t => t.type === "cc_emi" && t.ccEmiPlanId === loan.ccEmiPlanId);
  const totalSettled = installments.reduce((sum, t) => sum + Number(t.emiAmountSettled || 0), 0);
  return Math.max(0, Number(loan.principal || 0) - totalSettled);
}
