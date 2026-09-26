// domain/obligations/billContributionSync.js
//
// QW-2 (UI-2C plan). Keeps contributions[] consistent with the legacy
// bill-payment link (txn.paidBillId / bill.paidByTxnId) while that link is
// still the source of truth. Built only on contribution.js's own primitives.
//
// Fixes three confirmed gaps in the WP-OBL-04a dual-write:
//   1. Editing a bill-linked transaction appended a second Contribution for
//      the same (transaction, bill) pair on every save.
//   2. Deleting that transaction, or switching "Bill payment" off, left its
//      Contribution behind, pointing at a transaction that no longer pays.
//   3. createContribution throws on amount <= 0; the callers ran it inside a
//      setState updater, so a zero-amount bill could throw mid-render.
//
// Deliberately NOT decided here (ADR-038, WP-4): how much of a payment may be
// applied to a bill, partial payment status, Unallocated. The amount written
// is exactly what the caller passes today.

import { withNewContribution } from "./contribution.js";

const BILL = "bill";
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

const isBillContributionOfTxn = (c, txnId) => c?.obligationType === BILL && sameId(c.txnId, txnId);

/**
 * Upsert: the one Contribution recording that `txnId` pays `billId`. Any earlier
 * Contribution for the same pair is replaced, never duplicated. A non-positive
 * amount writes nothing (and removes a stale one) instead of throwing.
 */
export function withBillContributionForTxn(prevContributions, { billId, txnId, amount, txnAmount }, genId) {
  const without = (prevContributions || []).filter(
    c => !(isBillContributionOfTxn(c, txnId) && sameId(c.obligationId, billId))
  );
  const amt = Number(amount);
  const txnAmt = Number(txnAmount);
  if (!(amt > 0) || !(txnAmt > 0) || billId == null || txnId == null) return without;
  return withNewContribution(without, {
    obligationType: BILL,
    obligationId: String(billId),
    txnId: String(txnId),
    amount: amt,
    txnAmount: txnAmt,
  }, genId);
}

/** Removes every bill Contribution made by this transaction (delete / unlink). */
export function withoutBillContributionsForTxn(prevContributions, txnId) {
  return (prevContributions || []).filter(c => !isBillContributionOfTxn(c, txnId));
}

/** Same as withoutBillContributionsForTxn, for several deleted transactions at once. */
export function withoutBillContributionsForTxns(prevContributions, txnIds) {
  const ids = new Set((txnIds || []).map(String));
  return (prevContributions || []).filter(c => !(c?.obligationType === BILL && ids.has(String(c.txnId))));
}

/**
 * Reopens bills whose core payment was one of these (deleted) transactions, using
 * exactly the single-delete rule already in App.jsx (WP-BILLS-2C): only a bill that
 * points back at the transaction (bill.paidByTxnId === txn.id) is reset, to
 * status "unpaid" with paidDate / paidByTxnId cleared. Nothing else on the bill changes.
 */
export function reopenBillsPaidByDeletedTxns(bills, deletedTxns) {
  const pairs = (deletedTxns || []).filter(t => t?.paidBillId != null).map(t => [String(t.paidBillId), String(t.id)]);
  if (!pairs.length) return bills;
  return (bills || []).map(bl => pairs.some(([billId, txnId]) => String(bl.id) === billId && String(bl.paidByTxnId) === txnId)
    ? { ...bl, status: "unpaid", paidDate: null, paidByTxnId: null }
    : bl);
}
