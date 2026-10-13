// domain/obligations/itemBillLinks.js
//
// UI-2C WP-5 / T-34 — an itemised expense pays Bills one ITEM at a time. The link lives on the item (a Contribution with
// lineItemId), never on the transaction. Rules, on top of contribution.js and billBalance.js (ADR-038):
//   - an item applies at most its own amount, and a Bill takes at most what it still owes — including what earlier items of
//     the SAME payment already applied to it, so several items may pay one Bill and never overpay it;
//   - what an item cannot apply stays Unallocated (shown, never written as a Contribution);
//   - this transaction's earlier item-level Contributions are replaced by the current links (unlinking removes them).
// Pure: no React, no storage.

import { planBillPayment } from "./billBalance.js";
import { withBillContributionForTxn } from "./billContributionSync.js";

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** This transaction's item-level Bill Contributions. */
export const isItemBillContribution = (c, txnId) => Boolean(c) && c.obligationType === "bill" && c.lineItemId != null && sameId(c.txnId, txnId);

/**
 * What each linked item would apply, in item order.
 * @param {{items:Array<{id:string|number, amount:number}>, links:Object<string,string>, bills:Array, contributions:Array}} p
 *   `contributions` must NOT include this transaction's own item-level Contributions (they are re-applied).
 * @returns {Object<string,{bill:Object|undefined, itemAmt:number, applied:number, unallocated:number, remainingBefore:number}>}
 */
export function planItemBillLinks({ items, links, bills, contributions }) {
  const out = {};
  let running = contributions || [];
  (items || []).forEach(item => {
    const itemId = String(item.id);
    const billId = links?.[itemId];
    if (!billId) return;
    const bill = (bills || []).find(b => sameId(b.id, billId));
    const itemAmt = round2(item.amount);
    if (!bill || !(itemAmt > 0)) { out[itemId] = { bill, itemAmt, applied: 0, unallocated: Math.max(0, itemAmt), remainingBefore: 0 }; return; }
    const plan = planBillPayment({ ...bill, status: "unpaid" }, running, itemAmt);
    out[itemId] = { bill, itemAmt, applied: plan.applied, unallocated: plan.unallocated, remainingBefore: plan.remaining };
    if (plan.applied > 0) running = [...running, { obligationType: "bill", obligationId: String(bill.id), txnId: "__draft__", lineItemId: itemId, amount: plan.applied }];
  });
  return out;
}

/**
 * The next contributions array for a saved transaction: drops this transaction's earlier item-level Bill Contributions and
 * writes one per linked item that applies something. Other contributions (other payments, a whole-transaction bill payment of
 * this one) are untouched.
 */
export function withItemBillContributions(prev, { txnId, txnAmount, items, links, bills }, genId) {
  let next = (prev || []).filter(c => !isItemBillContribution(c, txnId));
  const plan = planItemBillLinks({ items, links, bills, contributions: next });
  (items || []).forEach(item => {
    const p = plan[String(item.id)];
    if (!p || !p.bill) return;
    const applied = Math.min(Number(txnAmount) || 0, p.applied);
    if (applied > 0) next = withBillContributionForTxn(next, { billId: p.bill.id, txnId, amount: applied, txnAmount, lineItemId: String(item.id), lineItemAmount: p.itemAmt }, genId);
  });
  return next;
}

/** Bills that this transaction paid through an item that is no longer linked and that nothing else pays: they reopen. */
export function getDroppedItemBills({ prev, txnId, links, items }) {
  const stillLinked = new Set((items || []).map(i => links?.[String(i.id)]).filter(Boolean).map(String));
  return [...new Set((prev || []).filter(c => isItemBillContribution(c, txnId)).map(c => String(c.obligationId)))]
    .filter(id => !stillLinked.has(id)
      && !(prev || []).some(c => c?.obligationType === "bill" && sameId(c.obligationId, id) && !sameId(c.txnId, txnId)));
}
