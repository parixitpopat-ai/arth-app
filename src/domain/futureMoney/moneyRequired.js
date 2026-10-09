// domain/futureMoney/moneyRequired.js
//
// "Money Required" - the cash the user must keep available for what is already committed: unpaid
// Bills / card statements / school fees (committed spending), SIPs (committed saving) and loan EMIs
// (debt service). One calculation for Home and Outlook (FIN-TRUTH-001, D3).
//
// What it is not: it is not spending and not budget used (ADR-024). Paid bills are already counted as
// spending when paid, so they are excluded here. Transfers, own-account movements and card purchases are
// not commitments and never appear; a card's unpaid statement is one commitment (commitments.js does not
// also emit the card's own balance when a statement Bill exists), and compose.js keeps one event per
// (sourceType, sourceId).
//
// The period is explicit: pass `horizonDays` + `today` to count only items overdue or due within that
// many days (same rule as horizon.js); omit them to count every open commitment. Both screens call it the
// same way, so they cannot drift.

import { isWithinPaymentsHorizon } from "./horizon.js";

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const sum = list => r2(list.reduce((s, e) => s + (Number(e?.amount) || 0), 0));

/**
 * @param {{futureMoney:{committedSpending?:Array, committedSaving?:Array, debtService?:Array}, today?:string, horizonDays?:number|null}} args
 * @returns {{spending:Array, saving:Array, debtService:Array, spendingTotal:number, savingTotal:number, debtServiceTotal:number, total:number, count:number}}
 */
export function getMoneyRequiredForPeriod({ futureMoney, today = null, horizonDays = null } = {}) {
  const scoped = horizonDays != null && today ? (e => isWithinPaymentsHorizon(e, today, horizonDays)) : (() => true);
  const owed = e => (Number(e?.amount) || 0) > 0; // a zero-amount entry (e.g. an empty card statement) is nothing to pay
  const spending = (futureMoney?.committedSpending || []).filter(c => c?.status !== "paid").filter(owed).filter(scoped);
  const saving = (futureMoney?.committedSaving || []).filter(owed).filter(scoped);
  const debtService = (futureMoney?.debtService || []).filter(owed).filter(scoped);
  const spendingTotal = sum(spending);
  const savingTotal = sum(saving);
  const debtServiceTotal = sum(debtService);
  return {
    spending, saving, debtService,
    spendingTotal, savingTotal, debtServiceTotal,
    total: r2(spendingTotal + savingTotal + debtServiceTotal),
    count: spending.length + saving.length + debtService.length,
  };
}

/**
 * Buffer = cash available - money required. Level uses the same thresholds on every screen:
 * negative -> risk; under 10% of required -> tight; under 30% -> watchful; else comfortable.
 * `forecastNegative` lets a screen that has a day-by-day forecast force "risk" when it dips below zero.
 */
export function classifyCashBuffer({ available, required, forecastNegative = false }) {
  const buffer = r2((Number(available) || 0) - (Number(required) || 0));
  const req = Number(required) || 0;
  const level = forecastNegative || buffer < 0 ? "risk" : buffer < req * 0.1 ? "tight" : buffer < req * 0.3 ? "watchful" : "comfortable";
  return { buffer, level };
}
