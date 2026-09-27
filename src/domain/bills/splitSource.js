// domain/bills/splitSource.js
//
// Root-cause fix for the reported "Nizam shows owes me but I have his settlement" bug.
//
// confirmMarkBillPaid snapshots bill.splitPeople into the paying Transaction's own `people` at
// the moment a split Bill is marked paid (App.jsx: `people:isFirstPayment?(bill.splitPeople||{}):{}`).
// From that point on, settling a person's share happens against the TRANSACTION (that's what the
// Bill Detail screen's linked payment actually is, and what Person/Group settle flows operate on)
// — but the Bill's own splitPeople is never written back to, so it's left behind as a stale,
// forever-unsettled snapshot. Any screen reading bill.splitPeople directly after that point shows
// a person as still owing even after they've paid, while the Transaction they actually paid
// against correctly shows them settled.
//
// This is the one place that decides which copy is authoritative right now, so every screen
// (Bill Detail's split rows/progress text, the Settle action, Person's Financial Position
// breakdown) agrees. Pure, read-only.

/**
 * @param {Object} bill
 * @param {Array} txns
 * @returns {{ people: Object, kind: "txn"|"bill", id: string|number|undefined }}
 *   `people` is whichever copy is authoritative right now: the linked payment Transaction's
 *   `people` once one exists and actually carries split data, else the Bill's own splitPeople.
 *   `kind`/`id` identify that source, for building a settlementLinks entry that updates the
 *   right record.
 */
export function getBillSplitSource(bill, txns) {
  const linkedTxn = bill?.paidByTxnId
    ? (txns || []).find(t => String(t.id) === String(bill.paidByTxnId))
    : null;
  const hasLinkedPeople = Boolean(linkedTxn?.people && Object.keys(linkedTxn.people).length > 0);
  if (hasLinkedPeople) return { people: linkedTxn.people, kind: "txn", id: linkedTxn.id };
  return { people: bill?.splitPeople || {}, kind: "bill", id: bill?.id };
}
