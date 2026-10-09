// domain/budget/pace.js
//
// "Where should my spending be by today?" - the straight-line pace of a monthly budget: budget x (day of
// month / days in month), counting today as spent. A guide, not a promise: it tells the progress bar where
// to put its tick, and how to colour the fill.

const r0 = n => Math.round(Number(n) || 0);

/**
 * @param {{budget:number, today:string, monthKey:string}} args  today = "YYYY-MM-DD"; monthKey = the month shown.
 * @returns {number|null} null when the month shown is not the current month or there is no budget.
 */
export function getExpectedSpendByToday({ budget, today, monthKey }) {
  const b = Number(budget) || 0;
  if (!(b > 0) || !today || String(today).slice(0, 7) !== monthKey) return null;
  const [y, m] = String(monthKey).split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const day = Number(String(today).slice(8, 10));
  return r0((b * Math.min(Math.max(day, 1), daysInMonth)) / daysInMonth);
}

/**
 * How the spend is going against budget and pace.
 * "over" = past the whole budget; "ahead" = spending faster than the pace (but inside budget);
 * "onTrack" = at or under the pace.
 */
export function getSpendPaceState({ spent, budget, expected }) {
  const s = Number(spent) || 0, b = Number(budget) || 0;
  if (b > 0 && s > b) return "over";
  if (expected != null && s > expected) return "ahead";
  return "onTrack";
}
