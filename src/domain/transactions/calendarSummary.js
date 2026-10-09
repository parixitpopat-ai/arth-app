// domain/transactions/calendarSummary.js
//
// Month calendar for Transactions: one cell per day. Day amounts follow the same rules as the rest of the
// app (FIN-TRUTH-001), so the days always add up to the month figure shown on Home:
//   spent   = MY share of that day's expenses (getMyExpenseShare: refunds netted, receivables and excluded
//             items left out). A refund lowers the original expense's day, not the refund's day.
//   income  = income transactions only. Refunds, repayments, reimbursements are not income.
//   other   = transfers, investments, card payments/EMIs, settlements, loan given: listed on the day, never
//             counted in spent or income.
// Pure: no dates from the clock; `today` is passed in.

import { getMyExpenseShare, buildRefundTotalsByExpense } from "../../../domain/allocations/adapter.js";

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export const OTHER_KIND = "other";

/** How a transaction counts on the calendar: "spend" | "income" | "other". */
export function calendarKind(t) {
  if (t?.type === "expense") return "spend";
  if (t?.type === "income") return "income";
  return OTHER_KIND;
}

/**
 * @param {{txns:Array, monthKey:string, today:string, dueDates?:string[]}} args
 *   dueDates = "YYYY-MM-DD" of unpaid bills/commitments, shown as a faint marker on that day.
 * @returns {{monthKey, daysInMonth, startOffset, days:Array, spentTotal:number, incomeTotal:number, entryCount:number}}
 *   startOffset = blank cells before day 1 with Monday as the first column.
 */
export function buildMonthCalendar({ txns, monthKey, today, dueDates = [] }) {
  const [y, m] = String(monthKey).split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startOffset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const all = txns || [];
  const refunds = buildRefundTotalsByExpense(all);
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    return { day, date, spent: 0, income: 0, count: 0, otherCount: 0, dueCount: 0, isToday: date === today, isFuture: date > today };
  });
  for (const t of all) {
    if (!t?.date || !String(t.date).startsWith(monthKey + "-")) continue;
    const d = days[Number(String(t.date).slice(8, 10)) - 1];
    if (!d) continue;
    d.count += 1;
    const kind = calendarKind(t);
    if (kind === "spend") d.spent += getMyExpenseShare(t, refunds);
    else if (kind === "income") d.income += Number(t.amount || 0);
    else d.otherCount += 1;
  }
  for (const due of dueDates || []) {
    if (!String(due).startsWith(monthKey + "-")) continue;
    const d = days[Number(String(due).slice(8, 10)) - 1];
    if (d) d.dueCount += 1;
  }
  days.forEach(d => { d.spent = r2(d.spent); d.income = r2(d.income); });
  return {
    monthKey, daysInMonth, startOffset, days,
    spentTotal: r2(days.reduce((s, d) => s + d.spent, 0)),
    incomeTotal: r2(days.reduce((s, d) => s + d.income, 0)),
    entryCount: days.reduce((s, d) => s + d.count, 0),
  };
}

/**
 * The entries of one date for the day sheet, newest recorded first. `share` is what the entry cost me
 * (expenses only); the sheet shows the full amount and "your share" when they differ.
 */
export function getDayEntries({ txns, date }) {
  const all = txns || [];
  const refunds = buildRefundTotalsByExpense(all);
  return all
    .filter(t => t?.date === date)
    .map(t => {
      const kind = calendarKind(t);
      return { id: t.id, txn: t, kind, gross: Number(t.amount || 0), share: kind === "spend" ? r2(getMyExpenseShare(t, refunds)) : null };
    })
    .sort((a, b) => Number(b.txn.createdAt || 0) - Number(a.txn.createdAt || 0));
}

/** Compact amount for a calendar cell: full if it fits, else 1.2k / 1.2L. */
export function formatCellAmount(n, sign = "", max = 6) {
  const value = Math.round(Number(n) || 0);
  const full = sign + value.toLocaleString("en-IN");
  if (full.length <= max) return full;
  const [unit, suffix] = value >= 100000 ? [100000, "L"] : [1000, "k"];
  const v = value / unit;
  let s = sign + (v < 10 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v)) + suffix;
  if (s.length > max) s = sign + Math.round(v) + suffix;
  return s;
}
