// TRX-002C4b — Legacy Adapter for person-share settlement on a Bill.
//
// Per AQ-002: `TransactionPersonShare` is a value object shared by both the
// Transaction and Bill aggregates — Bill.splitPeople and Transaction.people are
// the identical shape. This adapter reuses that shared value object directly
// (not a full Bill aggregate, which doesn't exist yet — that's TRX-002D) to
// canonicalize the person-share settlement math, while bill.status
// recomputation and cross-entity mirroring stay as explicit, visible adapter
// logic — legitimate Bill-level effects, not duplicated business rules.
//
// Scope, matching the same discipline as the Transaction-side adapter:
// person-share settlement + status recompute + mirroring only. Does NOT cover
// group-txn/group-bill links or tagged links — those remain fully legacy.

import { TransactionPersonShare } from "../TransactionPersonShare.js";

export function settlePersonShareOnBill({ bill, personId, amount, todayStr }) {
  const info = bill.splitPeople?.[personId];
  if (!info) return { bill, mirror: null }; // matches legacy: `if(!bill.splitPeople?.[personId]) return bill;`

  const share = new TransactionPersonShare({
    personId,
    amount: Number(info.amount || 0),
    mode: info.mode,
    settledAmt: Number(info.settledAmt || 0),
  });

  const updatedShare = share.applySettlement(amount);
  const addedAmt = updatedShare.settledAmt.amount - share.settledAmt.amount;

  const updatedInfo = {
    ...info,
    settled: updatedShare.settled,
    settledAmt: updatedShare.settledAmt.amount,
    remainingAmt: updatedShare.remainingAmt.amount,
  };
  const updatedSplitPeople = { ...bill.splitPeople, [personId]: updatedInfo };

  // Bill.status recomputation — a real Bill-level invariant (fixed earlier this
  // session), expressed here from the canonical per-share `settled` values
  // rather than duplicated ad hoc.
  const allOwedSettled = Object.entries(updatedSplitPeople)
    .filter(([p]) => p !== "__me__")
    .every(([, i]) => i.settled || i.mode !== "owes");

  // --- CR-006: group-collective tracking, same legacy pass-through as the
  // Transaction-side adapter, same reasoning (not yet audited as a business
  // concept belonging to any aggregate).
  const groupCap = Number(bill.groupCollectiveAmount || 0);
  const nextGroupSettled = groupCap > 0
    ? Math.min(groupCap, Number(bill.groupCollectiveSettledAmt || 0) + addedAmt)
    : bill.groupCollectiveSettledAmt;

  const updatedBill = {
    ...bill,
    splitPeople: updatedSplitPeople,
    ...(groupCap > 0 ? { groupCollectiveSettledAmt: nextGroupSettled } : {}),
    ...(allOwedSettled ? { status: "paid", paidDate: todayStr() } : {}),
  };

  // Mirroring is a cross-entity concern (Bill -> linked Transaction), not
  // something this function applies itself — it returns the instruction,
  // the caller applies it via mirrorSettlementOntoTransaction below, exactly
  // matching the two-step shape the legacy code already uses.
  const mirror = (bill.paidByTxnId && addedAmt > 0)
    ? { txnId: bill.paidByTxnId, addedAmt }
    : null;

  return { bill: updatedBill, mirror };
}

export function mirrorSettlementOntoTransaction({ txn, personId, addedAmt }) {
  const info = txn.people?.[personId];
  if (!info) return txn;
  const originalAmt = Number(info.amount || 0);
  const prevSettled = Number(info.settledAmt || 0);
  const nextSettled = Math.min(originalAmt, prevSettled + addedAmt);
  const nextRemaining = Math.max(0, originalAmt - nextSettled);
  return {
    ...txn,
    people: { ...txn.people, [personId]: { ...info, settled: nextRemaining <= 0, settledAmt: nextSettled, remainingAmt: nextRemaining } },
  };
}
