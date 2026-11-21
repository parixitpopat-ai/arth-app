// domain/loans/collectToLoan.js
//
// "Make this a loan": an older entry where ONE person owes the WHOLE amount (a Collect entry that was really cash handed over) becomes a loan given.
//   * the entry itself is turned into the loan's money-out entry, same id, same date, same account: the account is debited exactly as before, but it is a transfer
//     with no destination (domain/loans/disbursal.js). Spending does not change for a qualifying entry: the person owing the WHOLE amount already took it out of my spend;
//   * money already paid back stays money received. Each repayment linked to the entry becomes a "Loan receipt" on the new loan (its link to the old entry is removed so
//     the repayments check does not list it); anything the entry showed as paid without a recorded receipt is added to the loan as a repayment with no money entry;
//   * the loan starts with outstanding = what is still unpaid; interest is only a stored rate (it is not added to what is owed).
// Only a clean case is converted. Anything the rule cannot carry over exactly (a share of the bill, several people, a group, a card, an itemised list, a repayment that also covers
// something else) is refused with a plain reason, so nothing is ever converted by guessing. There is deliberately NO undo that removes the loan: the app has a rule that nothing removes a loan (emiPurchaseGate.test.js G1), so the screen shows exactly what will change and asks first. Pure.
import { buildLoanDisbursalTxn } from "./disbursal.js";
import { getMyExpenseShare, buildRefundTotalsByExpense } from "../../../domain/allocations/adapter.js";

const P = n => Math.round((Number(n) || 0) * 100);
const R = p => Math.round(p) / 100;
const baseKind = k => String(k || "").replace(/^group-/, "");

const linksToThis = (s, txn) => (s.settlementLinks || []).filter(l => baseKind(l.kind) === "txn" && String(l.id) === String(txn.id));
const isReceiptFor = (s, txn) => s && s.type === "settlement_in" && !s.isRefund && linksToThis(s, txn).length > 0;

/** @returns {{ok:true, personId:string, amount:number}|{ok:false, reason:string}} */
export function loanCandidate(txn, { lendable = true } = {}) {
  const no = reason => ({ ok: false, reason });
  if (!txn || txn.type !== "expense") return no("Only an expense can become a loan.");
  if (txn.isLoanDisbursal || txn.linkedLoanId) return no("This is already a loan.");
  if (txn.paidByPersonId || txn.claimOnly) return no("Someone else paid this, or it is a claim only. It is not money you handed over.");
  if (txn.writtenOff) return no("This was written off.");
  if (txn.groupId || (Array.isArray(txn.groupAllocations) && txn.groupAllocations.length) || txn.paidBillId || txn.isBillPayment) return no("It belongs to a group or a bill.");
  if (Array.isArray(txn.lineItems) && txn.lineItems.length) return no("It is itemised, so it is not one handover of cash.");
  const people = Object.entries(txn.people || {}).filter(([pid]) => pid !== "__me__");
  const owes = people.filter(([, i]) => i && i.mode === "owes");
  if (people.length !== 1 || owes.length !== 1) return no("It must be one person who owes you, and nobody else.");
  const [personId, info] = owes[0];
  if (info.transferredTo) return no("This share was moved to someone else.");
  if (Math.abs(P(info.amount) - P(txn.amount)) > 1) return no("Only an entry where the person owes the WHOLE amount can become a loan. Part of it is your own spending.");
  if (!txn.accId || !lendable) return no("It was not paid from a bank, cash or wallet account.");
  return { ok: true, personId, amount: R(P(txn.amount)) };
}

/** What converting would do, for the screen to show before anything is saved. */
export function previewConversion({ txn, txns, lendable = true }) {
  const c = loanCandidate(txn, { lendable });
  if (!c.ok) return c;
  const info = txn.people[c.personId];
  const receipts = (txns || []).filter(s => isReceiptFor(s, txn));
  for (const s of receipts) {
    const links = linksToThis(s, txn);
    if (s.fromGroupId || (s.settlementLinks || []).length !== 1 || links.length !== 1 || Math.abs(P(links[0].amount) - P(s.amount)) > 1) return { ok: false, reason: "A repayment on this entry also covers something else, so it cannot be carried over exactly." };
  }
  const linked = receipts.reduce((s, r) => s + P(r.amount), 0);
  const marked = info.settled && info.settledAmt == null ? P(info.amount) : P(info.settledAmt);
  const paid = Math.min(P(txn.amount), Math.max(marked, linked));
  return { ok: true, personId: c.personId, principal: c.amount, paid: R(paid), outstanding: R(P(txn.amount) - paid), receipts, unrecorded: R(Math.max(0, paid - linked)),
    // What this entry counts as MY spending today (its amount less what the person owes). For an entry that qualifies this is normally 0, so converting changes no spending; it is
    // reported so the screen can say so, and warn if it is ever not 0.
    spendDrop: { amount: R(P(getMyExpenseShare(txn, buildRefundTotalsByExpense(txns || [])))), date: String(txn.date || ""), catIds: txn.catIds && txn.catIds.length ? txn.catIds : (txn.catId ? [txn.catId] : []) } };
}

/**
 * @returns {{ok:true, loan:object, txns:Array}|{ok:false, reason:string}}
 */
export function convertCollectToLoan({ txn, txns, personName, dueDate = "", interestRate = "", lendable = true, genId, now = Date.now() }) {
  const pv = previewConversion({ txn, txns, lendable });
  if (!pv.ok) return pv;
  const name = String(personName || "").trim();
  if (!name) return { ok: false, reason: "Choose who this was lent to." };
  const rate = interestRate === "" || interestRate == null ? 0 : Number(interestRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { ok: false, reason: "Interest must be between 0 and 100 percent a year." };
  const due = String(dueDate || "");
  if (due && due < String(txn.date || "")) return { ok: false, reason: "The return date cannot be before the date it was lent." };

  const loanId = genId();
  const repayments = pv.receipts.map(s => ({ id: genId(), date: String(s.date || txn.date || ""), amount: R(P(s.amount)), note: "Moved from the original entry", txnId: s.id }));
  if (pv.unrecorded > 0) repayments.push({ id: genId(), date: String(txn.date || ""), amount: pv.unrecorded, note: "Marked as paid before this became a loan" });
  const lastDate = repayments.map(r => r.date).sort().pop() || String(txn.date || "");
  const loan = {
    id: loanId, direction: "given", sourceType: "person", name,
    principal: pv.principal, outstanding: pv.outstanding, startDate: String(txn.date || ""), dueDate: due, dueDay: "", tenureMonths: 0, emiAmount: 0,
    paymentAccId: txn.accId, hasInterest: rate > 0, interestRate: rate, note: String(txn.note || "").trim(),
    personId: pv.personId, paymentMode: "manual", isEmiPlan: false, repayments,
    status: pv.outstanding <= 0 ? "closed" : "active", closedDate: pv.outstanding <= 0 ? lastDate : "", writtenOffDate: "", convertedDate: "", madeFromTxnId: txn.id,
  };
  const disbursal = {
    ...buildLoanDisbursalTxn({ loanId, personName: name, fromAccId: txn.accId, amount: pv.principal, date: txn.date, id: txn.id, now }),
    note: ["Money lent", String(txn.note || "").trim()].filter(Boolean).join(" · "),
    ...(txn.transactionRef ? { transactionRef: txn.transactionRef } : {}),
    createdAt: txn.createdAt || now,
  };
  const receiptIds = new Set(pv.receipts.map(s => String(s.id)));
  const next = (txns || []).map(t => {
    if (String(t.id) === String(txn.id)) return disbursal;
    if (receiptIds.has(String(t.id))) return { ...t, desc: `Loan receipt - ${name}`, merchant: name, note: ["Money received against loan", t.note].filter(Boolean).join(" · "), settlementLinks: [], appliedAmount: 0, extraAmount: 0, isRefund: false, againstTxnId: null, linkedLoanId: loanId };
    return t;
  });
  return { ok: true, loan, txns: next };
}
