// domain/futureMoney/commitmentTimeline.js
//
// Outlook's one dated list: every open commitment (the same set getMoneyRequiredForPeriod counts), overdue first,
// then by date, each with the cash balance left after paying it. Replaces the two lists that used to repeat the
// same items ("Next 30 days" and "Forecast timeline"), and includes loan EMIs and overdue items, so the last
// balance agrees with the Buffer in the hero.
//
//   overdue  = dated before today. Overdue items are paid first in the running balance.
//   period   = overdue + due within `horizonDays` (undated items count as due now, same rule as horizon.js).
//              This is the forecast period: Needed = the period's total, Buffer = available - Needed, and the last
//              balance in the list equals the Buffer. It is the same figure as Home's Money Required.
//   later    = open commitments beyond the period. Not in Needed or Buffer; reported separately so nothing hides.

import { getMoneyRequiredForPeriod } from "./moneyRequired.js";
import { isWithinPaymentsHorizon } from "./horizon.js";

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

/**
 * @param {{futureMoney:Object, openingBalance:number, today:string, horizonDays?:number}} args
 * @returns {{rows:Array, laterCount:number, laterTotal:number, overdueTotal:number, upcomingTotal:number,
 *            neededTotal:number, buffer:number, allOpenTotal:number}}
 *   rows[] = { event, date, amount, overdue, balanceAfter }
 */
export function buildCommitmentTimeline({ futureMoney, openingBalance, today, horizonDays = 30 }) {
  const open = getMoneyRequiredForPeriod({ futureMoney });
  const events = [...open.spending, ...open.saving, ...open.debtService];
  const isOverdue = e => Boolean(e?.date) && String(e.date).slice(0, 10) < today;
  const byDate = (a, b) => String(a.date || "").localeCompare(String(b.date || ""));
  const overdue = events.filter(isOverdue).sort(byDate);
  const rest = events.filter(e => !isOverdue(e));
  const upcomingShown = rest.filter(e => isWithinPaymentsHorizon(e, today, horizonDays)).sort((a, b) => (a.date ? 0 : -1) - (b.date ? 0 : -1) || byDate(a, b));
  const later = rest.filter(e => !isWithinPaymentsHorizon(e, today, horizonDays));

  let balance = Number(openingBalance) || 0;
  const rows = [...overdue, ...upcomingShown].map(event => {
    balance = r2(balance - (Number(event.amount) || 0));
    return { event, date: event.date || null, amount: r2(event.amount), overdue: isOverdue(event), balanceAfter: balance };
  });
  const overdueTotal = r2(overdue.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const shownTotal = r2(rows.reduce((s, r) => s + r.amount, 0));
  const laterTotal = r2(later.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  return {
    rows,
    laterCount: later.length,
    laterTotal,
    overdueTotal,
    upcomingTotal: r2(shownTotal - overdueTotal),
    neededTotal: shownTotal,
    buffer: r2((Number(openingBalance) || 0) - shownTotal),
    allOpenTotal: open.total,
  };
}
