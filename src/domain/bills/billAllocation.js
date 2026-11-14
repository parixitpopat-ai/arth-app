// src/domain/bills/billAllocation.js — "I already paid this", for ANY bill, with one payment covering SEVERAL bills.
// Pure: nothing here writes state; `applyAllocations` returns what the caller should store.
//
// The money model is the one ADR-038 already has: a payment's share of a bill is a Contribution { txnId, billId, amount, txnAmount }; a bill's paid amount is
// the sum of its Contributions; a payment's available money is its amount minus what its Contributions already applied. This module adds:
//   - which earlier expenses still have money to give (`findUsableExpenses`), not just ones with the same amount;
//   - how one expense is spread over a connection's open bills, oldest first (`planCover`);
//   - the writes that make it real (`applyAllocations`): Contributions, bill status/paid fields, and the expense marked as a bill payment.
// NO ROUNDING: if a payment falls ₹0.46 short of a bill, that bill stays open with ₹0.46 remaining.
// Legacy: an expense that already points at a bill (`paidBillId`) but has no Contribution was a full payment before Contributions existed: never offered again.
import { getBillBalance, planBillPayment } from "../obligations/billBalance.js";
import { withBillContributionForTxn } from "../obligations/billContributionSync.js";

const EPS = 0.005, DAY = 86400000;
const money = n => Math.round(Number(n || 0) * 100) / 100;
const same = (a, b) => a != null && b != null && String(a) === String(b);
const toDay = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
const billContribOf = (contributions, txnId) => (contributions || []).filter(c => c && c.obligationType === "bill" && same(c.txnId, txnId));

/** How much of this payment bills already took. */
export const txnApplied = (txn, contributions) => money(billContribOf(contributions, txn && txn.id).reduce((s, c) => s + Number(c.amount || 0), 0));

/** Money this payment still has to give to bills. 0 for a legacy full payment (points at a bill, no Contribution). */
export function txnAvailable(txn, contributions) {
  if (!txn) return 0;
  const own = billContribOf(contributions, txn.id);
  if (!own.length && txn.paidBillId != null) return 0;
  return money(Math.max(0, Number(txn.amount || 0) - own.reduce((s, c) => s + Number(c.amount || 0), 0)));
}

export const isUsableExpense = (txn, contributions) => Boolean(txn) && txn.type === "expense" && Number(txn.amount) > 0 && txnAvailable(txn, contributions) > EPS;
const isOpenBill = b => Boolean(b) && b.status === "unpaid" && !b.isCcStatement;

/**
 * Earlier expenses that could be this bill's payment, best first: the same connection, then the same category, then ones that cover the bill, then the nearest date.
 * Only expenses with money left; nothing outside ±120 days of the bill's due date unless it is on the same connection.
 * @returns {{txn:object, available:number, sameConnection:boolean, sameCategory:boolean, covers:boolean, dayGap:number|null}[]}
 */
export function findUsableExpenses(txns, contributions, bill, { limit = 6 } = {}) {
  if (!bill || bill.isCcStatement) return [];
  const remaining = getBillBalance(bill, contributions).remaining;
  const due = toDay(bill.dueDate || bill.billDate || bill.validFrom);
  const cats = (bill.catIds && bill.catIds.length ? bill.catIds : [bill.catId]).filter(Boolean).map(String);
  return (txns || []).filter(t => isUsableExpense(t, contributions)).map(t => {
    const tc = (t.catIds && t.catIds.length ? t.catIds : [t.catId]).filter(Boolean).map(String);
    const d = toDay(t.date), gap = due != null && d != null ? Math.abs(Math.round((due - d) / DAY)) : null;
    const available = txnAvailable(t, contributions);
    return { txn: t, available, sameConnection: Boolean(t.billerLinkId) && same(t.billerLinkId, bill.billerAccountId), sameCategory: tc.some(c => cats.includes(c)), covers: available >= remaining - EPS, dayGap: gap };
  }).filter(x => x.sameConnection || (x.dayGap == null || x.dayGap <= 120))
    .sort((a, b) => (b.sameConnection - a.sameConnection) || (b.sameCategory - a.sameCategory) || (b.covers - a.covers) || ((a.dayGap ?? 1e9) - (b.dayGap ?? 1e9)) || String(b.txn.date || "").localeCompare(String(a.txn.date || "")))
    .slice(0, limit);
}

/**
 * Spread `available` over `bills` in the order given. Each bill takes at most what it still owes (planBillPayment); a short bill stays open.
 * @returns {{billId:any, applied:number, remainingAfter:number, becomesPaid:boolean}[]} only bills that get something
 */
export function spread(available, bills, contributions) {
  let left = money(available);
  const out = [];
  for (const b of bills) {
    if (!(left > EPS)) break;
    const { applied, remaining } = planBillPayment(b, contributions, left);
    if (!(applied > EPS)) continue;
    out.push({ billId: b.id, applied, remainingAfter: money(remaining - applied), becomesPaid: remaining - applied <= EPS });
    left = money(left - applied);
  }
  return out;
}

/**
 * The two ways to use one expense on `bill`:
 *   thisOnly: just this bill (what it can take);
 *   cover:    this bill plus the connection's other open bills, OLDEST DUE FIRST (including this one in that order), or null when there is nothing else to cover.
 * `unallocatedAfter` is what is left on the expense afterwards.
 */
export function planCover(txn, bill, allBills, contributions) {
  const available = txnAvailable(txn, contributions);
  const only = spread(available, [bill], contributions);
  const thisOnly = { allocations: only, unallocatedAfter: money(available - only.reduce((s, a) => s + a.applied, 0)) };
  const siblings = (allBills || []).filter(b => isOpenBill(b) && !same(b.id, bill.id) && bill.billerAccountId != null && same(b.billerAccountId, bill.billerAccountId) && getBillBalance(b, contributions).remaining > EPS);
  let cover = null;
  if (siblings.length && available > thisOnly.allocations.reduce((s, a) => s + a.applied, 0) + EPS) {
    const ordered = [bill, ...siblings].sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")) || String(a.id).localeCompare(String(b.id)));
    const allocations = spread(available, ordered, contributions);
    if (allocations.length > 1) cover = { allocations, unallocatedAfter: money(available - allocations.reduce((s, a) => s + a.applied, 0)) };
  }
  return { available, thisOnly, cover };
}

/**
 * The writes for `allocations` ({billId, applied}). Contributions are upserted per (txn, bill); a bill whose balance reaches 0 becomes paid with the payment's date; the
 * bill's FIRST payment is the one it points back at (`paidByTxnId`, so deleting that payment reopens it); the expense is marked as a bill payment and points at the first bill.
 * @returns {{contributions:object[], bills:object[], txnPatch:object, applied:number}}
 */
export function applyAllocations({ txn, allocations, bills, contributions, genId }) {
  let contribs = contributions || [];
  const touched = new Map();
  let firstBill = null, appliedTotal = 0;
  for (const a of allocations || []) {
    const bill = (bills || []).find(b => same(b.id, a.billId));
    if (!bill) continue;
    const plan = planBillPayment(bill, contribs, a.applied);
    if (!(plan.applied > EPS)) continue;
    const isFirst = !contribs.some(c => c && c.obligationType === "bill" && same(c.obligationId, bill.id));
    const balance = getBillBalance(bill, contribs);
    contribs = withBillContributionForTxn(contribs, { billId: bill.id, txnId: txn.id, amount: plan.applied, txnAmount: Number(txn.amount || 0) }, genId);
    touched.set(String(bill.id), {
      ...(plan.applied >= balance.remaining - EPS ? { status: "paid", paidDate: txn.date } : {}),
      ...(isFirst ? { paidByTxnId: txn.id } : {}),
      lastPaidAmount: plan.applied, lastPaidDate: txn.date, lastPaidAt: txn.id,
    });
    appliedTotal = money(appliedTotal + plan.applied);
    if (!firstBill) firstBill = bill;
  }
  const nextBills = (bills || []).map(b => (touched.has(String(b.id)) ? { ...b, ...touched.get(String(b.id)) } : b));
  const txnPatch = firstBill ? { isBillPayment: true, paidBillId: txn.paidBillId != null ? txn.paidBillId : firstBill.id, paidBillName: txn.paidBillName || firstBill.name, billInvoiceNo: txn.billInvoiceNo || firstBill.invoiceNo || "" } : {};
  return { contributions: contribs, bills: nextBills, txnPatch, applied: appliedTotal };
}
