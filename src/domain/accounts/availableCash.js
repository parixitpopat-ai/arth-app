// domain/accounts/availableCash.js
//
// Available Cash (Outlook): the actual cash position today.
//   per bank account  = the balance you last confirmed (the checkpoint) + every movement after that date.
//                       Movements before the checkpoint are already inside the confirmed figure, so they are
//                       never counted again. With no checkpoint it is the computed balance.
//   cash / wallet UPI = the computed balance.
//   linked UPI / debit = a rail, no balance of its own (accounts/accountBalance.js), so spend through it hits
//                       the funding bank once.
//   credit cards      = no cash balance. A card purchase moves no cash; paying the card bill debits the paying
//                       bank once (cc_payment), so purchase and settlement are never both deducted.
// Expected income is NOT cash until it is received and recorded.

import { computeAccountBalance } from "./accountBalance.js";

const num = v => Number(v) || 0;

/** A checkpoint is usable when it has a date and a numeric amount. */
export const isValidCheckpoint = cp => Boolean(cp && cp.date && cp.amount !== null && cp.amount !== undefined && cp.amount !== "" && Number.isFinite(Number(cp.amount)));

/**
 * @returns {number} computed balance, corrected to the confirmed checkpoint for banks:
 *   computed(now) + (checkpoint.amount - computed(as of checkpoint.date))
 */
export function getEffectiveBalance({ accId, accounts, txns, checkpoints, isDateInRange }) {
  const acc = (accounts || []).find(a => a.id === accId);
  if (!acc || acc.type === "cc") return 0;
  const computed = computeAccountBalance({ accId, accounts, txns, isDateInRange });
  const cp = (checkpoints || {})[accId];
  if (acc.type !== "bank" || !isValidCheckpoint(cp)) return computed;
  const expectedAtCheckpoint = computeAccountBalance({ accId, accounts, txns, endDate: cp.date, isDateInRange });
  return computed + (num(cp.amount) - num(expectedAtCheckpoint));
}

/**
 * Cash you hold today across bank, cash and standalone wallet accounts (investment accounts and cards excluded).
 * @param {{accounts:Array, txns:Array, checkpoints:Object, isDateInRange:Function, isInvestmentAccount:Function}} args
 */
export function getAvailableCash({ accounts, txns, checkpoints, isDateInRange, isInvestmentAccount = () => false }) {
  return (accounts || [])
    .filter(a => ["bank", "cash", "upi"].includes(a.type) && !isInvestmentAccount(a))
    .reduce((sum, a) => sum + getEffectiveBalance({ accId: a.id, accounts, txns, checkpoints, isDateInRange }), 0);
}
