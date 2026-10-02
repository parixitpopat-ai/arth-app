// domain/cashflow/monthlyCashFlow.js
//
// Money → Monthly cash flow (M1–M9). READ-SIDE ONLY: Actual transactions → monthly aggregation →
// Came in / Went out / Left over. No new record type, taxonomy or accounting model, and nothing here
// reads Bills, Expected items, renewals, fee periods or forecasts — only recorded transactions.
//
// Every figure reuses a rule the app already applies:
//   - Came in   = type "income" transactions (the same filter Home/Insights use for income).
//   - Went out  = getHouseholdAttributedTotal — the canonical household spend figure behind Home's
//                 "Spent": expense transactions, net of refunds, excluding the part owed back by
//                 other people and anything flagged excludeFromSpend.
//   - By category = getCategorySpendBreakdown (Insights) -> getCategoryAttributedTotal, which already
//                 aggregates a multi-line / multi-category transaction per category (via its
//                 catAllocations), so a mixed Education + Books payment counts each line under its own
//                 category. Any remainder (an expense with no category) shows as "Uncategorised" so the
//                 rows always add up to Went out.
//   - Not counted = money movements that are neither income nor spending, identified by the ledger's
//                 own transaction types: own-account transfers, card-bill payments, investments, EMI
//                 instalments and settlements/refunds received. Listed read-only so a month can be
//                 reconciled against the ledger.

import { getHouseholdAttributedTotal, buildRefundTotalsByExpense } from "../allocations/adapter.js";
import { getCategorySpendBreakdown } from "../insights/spending.js";

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

export const NOT_COUNTED_TYPES = [
  { type: "transfer", label: "Transfers between your accounts" },
  { type: "cc_payment", label: "Credit-card bill payments" },
  { type: "investment", label: "Investments" },
  { type: "cc_emi", label: "EMI instalments" },
  { type: "settlement_in", label: "Repayments and refunds received" },
];

/** "YYYY-MM" for a date string, or null. */
export const monthKeyOf = date => (/^\d{4}-\d{2}/.test(String(date || "")) ? String(date).slice(0, 7) : null);

/** Financial year (Apr–Mar) a month belongs to, as its starting calendar year. */
export function fyStartYearOf(monthKey) {
  const [y, m] = String(monthKey).split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

/** The 12 month keys of the FY starting in `fyStartYear`, Apr first. */
export function fyMonthKeys(fyStartYear) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((i + 3) % 12) + 1;
    const y = m >= 4 ? fyStartYear : fyStartYear + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  });
}

/** Step a month key by +/- n months (crosses year/FY boundaries). */
export function shiftMonth(monthKey, n) {
  const [y, m] = String(monthKey).split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/**
 * How the Left over figure should read. The label switches to "Went out more" when negative so a
 * minus sign is never the only cue; the same classification drives the Money card's one-line form.
 * @returns {{kind:"positive"|"zero"|"negative", label:string, amount:number}} amount is signed
 */
export function describeLeftOver(cameIn, wentOut) {
  const net = round2(Number(cameIn || 0) - Number(wentOut || 0));
  if (Math.abs(net) < 0.005) return { kind: "zero", label: "Left over", amount: 0 };
  return net > 0 ? { kind: "positive", label: "Left over", amount: net } : { kind: "negative", label: "Went out more", amount: net };
}

/**
 * Cash flow for one calendar month.
 * @param {Object} p
 * @param {Array} p.txns - the full transaction list
 * @param {Array} p.cats - the app's categories ({id,name,icon,...})
 * @param {string} p.monthKey - "YYYY-MM"
 * @returns {{monthKey, cameIn, wentOut, leftOver, incomeBySource, wentOutByCategory, notCounted, txnCount, hasActivity}}
 */
export function getMonthlyCashFlow({ txns, cats, monthKey }) {
  const all = Array.isArray(txns) ? txns : [];
  const period = all.filter(t => t && monthKeyOf(t.date) === monthKey);

  const incomeTxns = period.filter(t => t.type === "income");
  const cameIn = round2(incomeTxns.reduce((s, t) => s + Number(t.amount || 0), 0));
  const bySource = new Map();
  for (const t of incomeTxns) {
    const key = String(t.incomeType || "");
    bySource.set(key, round2((bySource.get(key) || 0) + Number(t.amount || 0)));
  }
  const incomeBySource = [...bySource.entries()].map(([key, amount]) => ({ key, amount })).sort((a, b) => b.amount - a.amount);

  const refunds = buildRefundTotalsByExpense(all);
  const wentOut = round2(getHouseholdAttributedTotal({ periodTransactions: period, allTransactions: all, refundTotalsByExpense: refunds }));
  const rows = getCategorySpendBreakdown(period, cats, all).map(r => ({ id: r.category.id, name: r.category.name, icon: r.category.icon || "", amount: round2(r.amount) }));
  const remainder = round2(wentOut - rows.reduce((s, r) => s + r.amount, 0));
  const wentOutByCategory = remainder > 0.5 ? [...rows, { id: "__uncategorised__", name: "Uncategorised", icon: "", amount: remainder }] : rows;

  const notCounted = NOT_COUNTED_TYPES.map(({ type, label }) => {
    const hits = period.filter(t => t.type === type);
    return { type, label, amount: round2(hits.reduce((s, t) => s + Number(t.amount || 0), 0)), count: hits.length };
  }).filter(r => r.count > 0 && r.amount > 0);

  return {
    monthKey, cameIn, wentOut, leftOver: describeLeftOver(cameIn, wentOut),
    incomeBySource, wentOutByCategory, notCounted,
    txnCount: period.length,
    hasActivity: period.length > 0,
  };
}

/** Totals only, for the 12 months of an FY — what the chart and month list read. */
export function getFiscalYearSeries({ txns, cats, fyStartYear }) {
  return fyMonthKeys(fyStartYear).map(monthKey => {
    const cf = getMonthlyCashFlow({ txns, cats, monthKey });
    return { monthKey, cameIn: cf.cameIn, wentOut: cf.wentOut, leftOver: cf.leftOver, hasActivity: cf.hasActivity };
  });
}

/** Net across the series months up to and including `uptoMonthKey` (FY to date). */
export function sumFyToDate(series, uptoMonthKey) {
  const upto = series.filter(s => s.monthKey <= uptoMonthKey);
  return round2(upto.reduce((sum, s) => sum + (s.cameIn - s.wentOut), 0));
}

/**
 * Which presentation a month gets: "future" (hasn't started — never shows forecasts), "empty" (a
 * past or current month with no transactions), or "normal".
 */
export function getMonthState(cf, currentMonthKey) {
  if (cf.monthKey > currentMonthKey) return "future";
  return cf.hasActivity ? "normal" : "empty";
}
