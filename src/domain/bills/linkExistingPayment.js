// domain/bills/linkExistingPayment.js
//
// "I already paid this" — picks the earlier transactions a Bill (a recharge or renewal) can be
// linked to instead of recording a second payment, and works out what linking one does.
//
// A transaction can pay only one Bill, so one that already pays a Bill (paidBillId / isBillPayment),
// and anything that is not a plain expense (transfers, card payments, income), is never offered.
// Best matches come first: the same amount, then the same category, then the closest date.

import { planBillPayment, getBillBalance } from "../obligations/billBalance.js";

const DAY = 86400000;
const toDay = v => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
};

export function isLinkableExpense(txn) {
  return Boolean(txn)
    && txn.type === "expense"
    && !txn.isBillPayment
    && txn.paidBillId == null
    && Number(txn.amount) > 0;
}

/** Up to `limit` expenses that could be this Bill's payment, best match first. */
export function getLinkablePayments(txns, bill, { limit = 8 } = {}) {
  if (!bill) return [];
  const billAmount = Number(bill.amount || 0);
  const billDay = toDay(bill.validFrom || bill.billDate || bill.dueDate);
  const billCats = (bill.catIds && bill.catIds.length ? bill.catIds : [bill.catId]).filter(Boolean).map(String);
  return (txns || [])
    .filter(isLinkableExpense)
    .map(t => {
      const sameAmount = Math.abs(Number(t.amount) - billAmount) < 0.005;
      const txnCats = (t.catIds && t.catIds.length ? t.catIds : [t.catId]).filter(Boolean).map(String);
      const sameCategory = txnCats.some(c => billCats.includes(c));
      const d = toDay(t.date);
      const dayGap = billDay != null && d != null ? Math.abs(Math.round((billDay - d) / DAY)) : Infinity;
      return { txn: t, sameAmount, sameCategory, dayGap };
    })
    .sort((a, b) =>
      (b.sameAmount - a.sameAmount)
      || (b.sameCategory - a.sameCategory)
      || (a.dayGap - b.dayGap)
      || String(b.txn.date || "").localeCompare(String(a.txn.date || "")))
    .slice(0, limit)
    .map(x => x.txn);
}

/**
 * What linking `txn` to `bill` does, given the Bill's existing Contributions:
 * `applied` is at most what is still owed (the rest of the transaction stays Unallocated),
 * `becomesPaid` when that clears the balance, `isFirst` when no payment was recorded before.
 */
export function planLinkExistingPayment(bill, txn, contributions) {
  const balance = getBillBalance(bill, contributions);
  const { applied, unallocated } = planBillPayment(bill, contributions, Number(txn?.amount || 0));
  const isFirst = !(contributions || []).some(c => c?.obligationType === "bill" && String(c.obligationId) === String(bill?.id));
  return { applied, unallocated, becomesPaid: applied >= balance.remaining - 0.005 && applied > 0, isFirst };
}
