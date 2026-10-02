// domain/obligations/billBalance.js
//
// ADR-038 (approved 2026-09-26) — the one owner of a Bill's paid amount,
// remaining amount and payment status, and of how much of a payment may be
// applied to a Bill. Built on contribution.js's primitives; never writes
// state itself (callers apply what it returns).
//
// Rules, exactly as approved:
//   - Paid so far = the sum of this Bill's Contributions (obligationType "bill").
//   - Paid so far never exceeds the Bill amount: a payment applies
//     min(requested, remaining); the excess is never written as a
//     Contribution. It is Unallocated, computed and shown, with no
//     resolution flow in M2.
//   - Status: unpaid (0 paid) → partial (some paid) → paid (all paid);
//     Overdue is the due-date overlay on unpaid/partial; cancelled only by
//     explicit user action.
//   - A Bill marked paid before Contributions existed, with none recorded,
//     stays paid ("historical"), never re-derived to unpaid.
//   - Bills only. Credit-card statement Bills keep their own payment
//     mechanism (card payments allocated oldest-first), so their stored
//     status is read as-is here.
//
// Storage: bills[].status stays "unpaid" | "paid" (| "cancelled"). A
// partially paid Bill is stored as "unpaid" — still open — so every existing
// reader of status === "unpaid" keeps treating it as a Bill with money due.
// "Partially paid" is derived here and shown by the UI.

import { DUE_SOON_DAYS } from "./dueSoonWindow.js";

const BILL = "bill";
const EPS = 0.005;
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const money = n => Math.round(Number(n || 0) * 100) / 100;

export function getBillContributions(bill, contributions) {
  if (!bill) return [];
  // One payment counts once per Bill. Older builds could store the same transaction's
  // Contribution more than once for a Bill (e.g. before edits upserted); keep the latest.
  const own = (contributions || []).filter(c => c?.obligationType === BILL && sameId(c.obligationId, bill.id));
  const byTxn = new Map();
  own.forEach(c => byTxn.set(c.txnId == null ? `c:${c.id}` : `t:${c.txnId}`, c));
  return [...byTxn.values()];
}

/**
 * { amount, paid, remaining, status, historical }
 * status: "unpaid" | "partial" | "paid" | "cancelled"
 */
export function getBillBalance(bill, contributions) {
  const amount = money(bill?.amount);
  if (!bill) return { amount: 0, paid: 0, remaining: 0, status: "unpaid", historical: false };
  if (bill.status === "cancelled") return { amount, paid: 0, remaining: 0, status: "cancelled", historical: false };
  if (bill.isCcStatement) {
    const paid = bill.status === "paid";
    return { amount, paid: paid ? amount : 0, remaining: paid ? 0 : amount, status: paid ? "paid" : "unpaid", historical: false };
  }
  const own = getBillContributions(bill, contributions);
  const contributed = money(own.reduce((s, c) => s + Number(c.amount || 0), 0));
  if (own.length === 0 && bill.status === "paid") {
    return { amount, paid: amount, remaining: 0, status: "paid", historical: true };
  }
  const paid = Math.min(contributed, amount);
  const remaining = money(Math.max(0, amount - paid));
  let status = "unpaid";
  if (amount > 0 && remaining <= EPS) status = "paid";
  else if (paid > EPS) status = "partial";
  return { amount, paid, remaining, status, historical: false };
}

/** The stored status that matches the Contributions ("unpaid" | "paid" | "cancelled"). */
export function projectStoredBillStatus(bill, contributions) {
  const b = getBillBalance(bill, contributions);
  if (b.status === "cancelled") return "cancelled";
  return b.status === "paid" ? "paid" : "unpaid";
}

/** How much of `requested` applies to the Bill, and how much is Unallocated. */
export function planBillPayment(bill, contributions, requested) {
  const req = money(Math.max(0, Number(requested || 0)));
  const { remaining, status } = getBillBalance(bill, contributions);
  if (status === "cancelled" || status === "paid") return { applied: 0, unallocated: req, remaining };
  const applied = money(Math.min(req, remaining));
  return { applied, unallocated: money(req - applied), remaining };
}

const localYMD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const noon = ymd => { const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d, 12); };
const isYMD = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || ""));

/**
 * The single D-16 badge for a Bill, in the approved order:
 * Cancelled → Paid → Overdue → Partially paid → Due (within 14 days,
 * including today) → Unpaid.
 * Returns { kind, days, balance } — kind: cancelled | paid | overdue | partial | due | unpaid.
 */
export function getBillBadge(bill, contributions, refDate = new Date()) {
  const balance = getBillBalance(bill, contributions);
  if (balance.status === "cancelled") return { kind: "cancelled", days: null, balance };
  if (balance.status === "paid") return { kind: "paid", days: null, balance };
  if (isYMD(bill?.dueDate)) {
    const days = Math.round((noon(bill.dueDate) - noon(localYMD(refDate))) / 86400000);
    if (days < 0) return { kind: "overdue", days: -days, balance };
    if (balance.status === "partial") return { kind: "partial", days, balance };
    if (days <= DUE_SOON_DAYS) return { kind: "due", days, balance };
    return { kind: "unpaid", days, balance };
  }
  return { kind: balance.status === "partial" ? "partial" : "unpaid", days: null, balance };
}

/**
 * The ledger for Bill detail (PY-26 / PY-26b): each payment against the
 * Bill with what it paid and what was applied, then the balance. A
 * payment transaction larger than what it applied shows the difference as
 * Unallocated. `txns` is used to read each payment's own amount, date and
 * account; a Contribution whose transaction is gone is still listed.
 */
export function getBillLedger(bill, contributions, txns) {
  const balance = getBillBalance(bill, contributions);
  const rows = getBillContributions(bill, contributions).map(c => {
    const txn = (txns || []).find(t => sameId(t.id, c.txnId)) || null;
    const applied = money(c.amount);
    const paidAmount = txn ? money(txn.amount) : money(c.txnAmount || c.amount);
    return {
      contributionId: c.id,
      txnId: c.txnId,
      txn,
      date: txn?.date || null,
      applied,
      paidAmount,
      unallocated: money(Math.max(0, paidAmount - applied)),
    };
  }).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const unallocated = money(rows.reduce((s, r) => s + r.unallocated, 0));
  return { ...balance, rows, unallocated };
}

/**
 * Unallocated money for one bill-linked transaction: its amount minus
 * everything it contributed to Bills. Only for transactions that pay a
 * Bill; anything else is never "unallocated".
 */
export function getTxnUnallocated(txn, contributions) {
  if (!txn) return 0;
  const own = (contributions || []).filter(c => c?.obligationType === BILL && sameId(c.txnId, txn.id));
  if (!own.length) return 0;
  const applied = own.reduce((s, c) => s + Number(c.amount || 0), 0);
  return money(Math.max(0, Number(txn.amount || 0) - applied));
}

/**
 * Remaining balance to use wherever a total of money still due is shown
 * (Payments' Total unpaid, committed spending). Cancelled and paid Bills
 * contribute 0.
 */
export function getBillRemaining(bill, contributions) {
  return getBillBalance(bill, contributions).remaining;
}

/**
 * The single place stored Bill status follows Contributions (ADR-038 §6).
 * For every non-card, non-cancelled Bill that has Contributions: status
 * becomes "paid" when they cover the amount, otherwise "unpaid" (open,
 * possibly partially paid). When a Bill becomes paid, paidDate is the
 * latest payment's date; paidByTxnId keeps the first payment (the one that
 * carries the Bill's split). Bills without Contributions are left alone
 * (legacy paid Bills stay paid; the delete/unlink paths reopen those).
 * Returns the same array when nothing changes.
 */
export function withProjectedBillStatuses(bills, contributions, txns) {
  const list = Array.isArray(bills) ? bills : [];
  let changed = false;
  const next = list.map(bill => {
    if (!bill || bill.isCcStatement || bill.status === "cancelled") return bill;
    const own = getBillContributions(bill, contributions);
    if (!own.length) return bill;
    const target = projectStoredBillStatus(bill, contributions);
    const dates = own.map(cn => (txns || []).find(t => sameId(t.id, cn.txnId))?.date).filter(Boolean).sort();
    const firstTxnId = bill.paidByTxnId && own.some(cn => sameId(cn.txnId, bill.paidByTxnId)) ? bill.paidByTxnId : own[0].txnId;
    let out = bill;
    if (target === "paid") {
      const paidDate = bill.status === "paid" && bill.paidDate ? bill.paidDate : (dates[dates.length - 1] || bill.paidDate || null);
      if (bill.status !== "paid" || bill.paidDate !== paidDate || !sameId(bill.paidByTxnId, firstTxnId)) out = { ...bill, status: "paid", paidDate, paidByTxnId: firstTxnId };
    } else if (bill.status !== "unpaid" || bill.paidDate || !sameId(bill.paidByTxnId, firstTxnId)) {
      out = { ...bill, status: "unpaid", paidDate: null, paidByTxnId: firstTxnId };
    }
    if (out !== bill) changed = true;
    return out;
  });
  return changed ? next : bills;
}

/** { [billId]: remaining } for open Bills that are partially paid (for committed-spending reads). */
export function getPartialRemainingByBill(bills, contributions) {
  const out = {};
  (bills || []).forEach(b => {
    const bal = getBillBalance(b, contributions);
    if (bal.status === "partial") out[String(b.id)] = bal.remaining;
  });
  return out;
}
