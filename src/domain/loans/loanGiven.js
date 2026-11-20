// domain/loans/loanGiven.js
//
// "I lent money to a friend": ONE entry that makes the loan (a receivable: money owed to the person) and, when the money left one of the person's own
// accounts, the money-out entry for that account (domain/loans/disbursal.js: no destination account, never counted as spending).
// Nothing here asks for, or accepts, a destination account: the money went to someone else, not to one of the person's accounts.
import { shouldDebitOnLoanGiven, buildLoanDisbursalTxn } from "./disbursal.js";

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** @returns {{ok:true, loan:object, txn:object|null}|{ok:false, error:string}} */
export function buildLoanGiven({ personId = "", personName = "", amount, date, fromAccId = "", note = "", genId, now = Date.now(), toAccId, dueDate = "", interestRate = "" } = {}) {
  const name = String(personName || "").trim();
  const principal = r2(amount);
  if (!name) return { ok: false, error: "Choose who you lent the money to." };
  if (!(principal > 0)) return { ok: false, error: "Enter the amount you lent." };
  if (!date) return { ok: false, error: "Choose the date." };
  const rate = interestRate === "" || interestRate == null ? 0 : Number(interestRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { ok: false, error: "Interest must be between 0 and 100 percent a year." };
  const due = String(dueDate || "");
  if (due && due < date) return { ok: false, error: "The return date cannot be before the date you lent it." };
  if (toAccId) return { ok: false, error: "A loan given has no destination account." };    // guard: callers must not send one
  const loanId = genId();
  const loan = {
    id: loanId, direction: "given", sourceType: "person", name,
    principal, outstanding: principal, startDate: date, dueDate: due, dueDay: "", tenureMonths: 0, emiAmount: 0,
    paymentAccId: fromAccId || "", hasInterest: rate > 0, interestRate: rate, note: String(note || "").trim(),
    personId: personId || null, paymentMode: "manual", isEmiPlan: false, repayments: [],
    status: "active", closedDate: "", writtenOffDate: "", convertedDate: "",
  };
  const txn = shouldDebitOnLoanGiven({ direction: "given", isEditing: false, lentFromAccId: fromAccId, principal })
    ? buildLoanDisbursalTxn({ loanId, personName: name, fromAccId, amount: principal, date, id: genId(), now })
    : null;
  if (txn && loan.note) txn.note = `Money lent · ${loan.note}`;
  return { ok: true, loan, txn };
}
