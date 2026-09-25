// domain/cards/reconciliation.js
//
// Credit Card WP, rules 5-9: the statement-verification state machine.
// Three states only — needs_verification, matched, mismatch — and every
// transition here is explicit, never inferred. In particular: entering a
// bank amount equal to Arth's never silently "counts as" a match (rule 8),
// and a mismatch never auto-closes just because the numbers later happen to
// agree (rule 9 — no "accept difference" workflow exists here at all).

import { computePeriodAmount } from "./statementBills.js";

const AMOUNT_EPSILON = 0.005;

const amountsEqual = (a, b) => Math.abs(Number(a || 0) - Number(b || 0)) < AMOUNT_EPSILON;

/** "Yes, this matches my bank statement" (CC-10/CC-11). */
export function confirmMatchedWithBank(bill, refDate = new Date()) {
  return { ...bill, verification: "matched", verifiedAt: refDate.toISOString().slice(0, 10) };
}

/** Undo an explicit match, back to needs_verification (CC-11 "Undo"). */
export function undoMatch(bill) {
  return { ...bill, verification: "needs_verification", verifiedAt: null };
}

/**
 * "No" — the user enters what their bank statement says (CC-12). Stores
 * bankAmount alongside arthAmount; never overwrites arthAmount. If the
 * entered figure happens to equal Arth's own amount, this already IS the
 * match (nothing left to reconcile), so it resolves to matched directly.
 */
export function recordBankAmount(bill, bankAmount, refDate = new Date()) {
  const next = { ...bill, bankAmount: Number(bankAmount) };
  if (amountsEqual(bankAmount, bill.arthAmount)) {
    return { ...next, verification: "matched", verifiedAt: refDate.toISOString().slice(0, 10) };
  }
  return { ...next, verification: "mismatch", verifiedAt: null };
}

/** Bank > Arth (CC-13) vs Arth > Bank (CC-14) — which side is short. */
export function getMismatchDirection(bill) {
  if (bill.verification !== "mismatch" || bill.bankAmount == null) return null;
  const diff = Number(bill.bankAmount) - Number(bill.arthAmount);
  if (amountsEqual(diff, 0)) return null;
  return diff > 0 ? "bank_higher" : "arth_higher";
}

/** Live re-sum of the period's transactions — "Arth's records now total…" (CC-15). */
export function getRecordsNowTotal(bill, card, accounts, txns, toDateOnly) {
  return computePeriodAmount(card, accounts, txns, toDateOnly(bill.periodFrom), toDateOnly(bill.periodTo), toDateOnly);
}

/**
 * The explicit "Update statement and mark matched" / recalculate action
 * (CC-15). Only ever called on the user's own tap — never automatically,
 * even if newTotal already equals the bank amount. Keeps the adjustment in
 * the Bill's own history rather than silently rewriting arthAmount.
 */
export function applyRecalculatedUpdate(bill, newTotal, refDate = new Date()) {
  const today = refDate.toISOString().slice(0, 10);
  const matched = bill.bankAmount != null && amountsEqual(newTotal, bill.bankAmount);
  return {
    ...bill,
    arthAmount: newTotal,
    amount: newTotal,
    verification: matched ? "matched" : "mismatch",
    verifiedAt: matched ? today : null,
    adjustments: [...(bill.adjustments || []), { at: today, from: bill.arthAmount, to: newTotal }],
  };
}

/**
 * Deterministic review candidates only (rule 7 — no probabilistic
 * explanations): same merchant+amount within 2 days of each other
 * (possible duplicate), a refund-shaped note with no linked refund txn, or a
 * transaction dated exactly on either period boundary.
 */
export function getReviewCandidates(bill, txns, card, accounts) {
  const linkedUpiIds = (accounts || []).filter(a => a.type === "upi" && a.linkedAccount === card.id).map(a => a.id);
  const allIds = [card.id, ...linkedUpiIds];
  const periodTxns = (txns || []).filter(t => {
    if ((t.type !== "expense" && t.type !== "investment" && t.type !== "cc_emi") || !allIds.includes(t.accId)) return false;
    return t.date && t.date > bill.periodFrom && t.date <= bill.periodTo;
  });

  const dayMs = 24 * 60 * 60 * 1000;
  const candidates = [];
  for (let i = 0; i < periodTxns.length; i++) {
    const t = periodTxns[i];
    const isBoundary = t.date === bill.periodFrom || t.date === bill.periodTo;
    if (isBoundary) candidates.push({ txn: t, why: "Dated on the statement-period boundary" });

    const dup = periodTxns.find((o, j) => j !== i
      && Number(o.amount || 0) === Number(t.amount || 0)
      && (o.merchant || o.note || "") === (t.merchant || t.note || "")
      && Math.abs(new Date(o.date) - new Date(t.date)) <= 2 * dayMs);
    if (dup) candidates.push({ txn: t, why: "Same amount and merchant within 2 days — possible duplicate" });

    const looksLikeRefund = /refund|return|cashback/i.test(t.note || t.merchant || "");
    if (looksLikeRefund) candidates.push({ txn: t, why: "Refund-worded but no linked refund record" });
  }
  const seen = new Set();
  return candidates.filter(c => (seen.has(c.txn.id) ? false : (seen.add(c.txn.id), true)));
}
