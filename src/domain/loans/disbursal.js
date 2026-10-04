// domain/loans/disbursal.js
//
// Loan Given -> money out. When a loan is given from one of the user's accounts, that account is debited by
// the amount lent. The entry is a "transfer" with a source account and NO destination: account balances take
// money out of the source (see accountBalance), and transfers are never counted as spending, so budgets and
// cash flow are not distorted. It carries linkedLoanId, so the entry can always be traced to its loan.
// Repayments already come back as a settlement_in (LoanRepaymentModal), which credits the receiving account.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

/** Only a NEW loan given, from a chosen account, for a positive amount, writes a debit. */
export function shouldDebitOnLoanGiven({ direction, isEditing, lentFromAccId, principal }) {
  return direction === "given" && !isEditing && Boolean(lentFromAccId) && r2(principal) > 0;
}

export function buildLoanDisbursalTxn({ loanId, personName, fromAccId, amount, date, id, now = Date.now() }) {
  const who = String(personName || "").trim();
  return {
    id: id ?? now,
    type: "transfer",
    desc: `Loan given${who ? ` - ${who}` : ""}`,
    merchant: who || "Loan given",
    note: "Money lent",
    date,
    amount: r2(amount),
    fromAccId,
    toAccId: null,
    accId: null,
    catId: null, catIds: [], subId: null, subIds: [],
    people: {},
    linkedLoanId: loanId,
    isLoanDisbursal: true,
    trackingMode: "none",
    createdDate: date,
    createdAt: now,
  };
}
