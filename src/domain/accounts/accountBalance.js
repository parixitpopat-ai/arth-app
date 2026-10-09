// domain/accounts/accountBalance.js
//
// Cash balance of an account, and the account-vs-payment-method rule (FIN-TRUTH-001, D2).
//
// The real source of money is a bank account, a wallet or a credit-card account. A UPI handle or a debit
// card that is linked to one of those is only a RAIL: spending through it moves the parent's money, once.
// So a linked UPI/debit has no balance of its own (it reports 0) and every figure that adds up accounts
// can sum all accounts without counting the same spend twice. A UPI that is not linked to anything is a
// standalone wallet and keeps its own balance. Card-linked UPI spend is a charge on the card (see
// cards/summaries.js); it never touches bank/cash.
//
// Transaction types and the card-settlement model are unchanged: expense/investment debit the paying
// account, income and settlement_in credit it, transfer moves from -> to, cc_payment debits the paying
// bank (the card's liability is settled by cards/summaries.js, not here).

import { expandPaymentLines } from "../payments/paymentLineSlices.js";

/** The parent account a payment method is linked to, or null if it is not a (resolvable) linked method. */
export function getParentAccountId(account, accounts) {
  if (!account) return null;
  const parentId = account.type === "upi" ? account.linkedAccount : account.type === "debit" ? account.linkedBank : null;
  if (!parentId) return null;
  return (accounts || []).some(a => a.id === parentId) ? parentId : null; // a deleted parent leaves a standalone wallet
}

export const isLinkedPaymentMethod = (account, accounts) => getParentAccountId(account, accounts) !== null;

/** Ids of the payment methods (UPI handles, debit cards) linked to `accountId`. */
export function getLinkedMethodIds(accountId, accounts) {
  return (accounts || []).filter(a => getParentAccountId(a, accounts) === accountId).map(a => a.id);
}

/**
 * @param {{accId:string, accounts:Array, txns:Array, endDate?:string|null, isDateInRange:Function}} args
 *   isDateInRange(txnDate, startDate, endDate) is passed in (its date parsing lives in App.jsx).
 * @returns {number}
 */
export function computeAccountBalance({ accId, accounts, txns, endDate = null, isDateInRange }) {
  const acc = (accounts || []).find(a => a.id === accId);
  if (!acc || acc.type === "cc") return 0;
  if (isLinkedPaymentMethod(acc, accounts)) return 0; // a rail, not a source of money
  const openingDate = acc.openingBalanceDate || "";
  const linkedIds = acc.type === "bank" ? getLinkedMethodIds(accId, accounts) : [];
  const mine = id => id === accId || linkedIds.includes(id);
  let bal = Number(acc.openingBalance || 0);
  // A multi-method payment hits each paying account for ITS line only (see paymentLineSlices.js).
  expandPaymentLines(txns).forEach(t => {
    if (!isDateInRange(t.date, openingDate, endDate)) return;
    if (t.type === "income" && t.accId === accId) bal += Number(t.amount || 0);
    if (t.type === "settlement_in" && t.accId === accId) bal += Number(t.amount || 0);
    if (t.type === "expense" && mine(t.accId)) bal -= Number(t.amount || 0);
    if (t.type === "investment" && mine(t.accId)) bal -= Number(t.amount || 0);
    if (t.type === "transfer") {
      if (mine(t.fromAccId)) bal -= Number(t.amount || 0);
      if (mine(t.toAccId)) bal += Number(t.amount || 0);
    }
    if (t.type === "cc_payment" && mine(t.fromAccId)) bal -= Number(t.amount || 0);
  });
  return bal;
}
