// domain/insights/income.js
//
// WP12 — Income (section 9), newly required by the "Outlook, Budget and Insights" handoff,
// not part of WP8's original 8 sections. No forecasting here at all — this is a historical
// total and a trend series over real income transactions (type==="income"), the same field
// every other screen in the app already reads to total income (App.jsx's own totalIncome,
// incomeBaseTxns). Nothing here estimates a future income figure; Saving rate (section 10)
// is the only section that combines this with a forecast, and it takes that forecast as an
// argument rather than computing one itself (see savingRate.js).

/**
 * Total real income for one period, plus the individual credited entries (for the "Salary ·
 * Acme Corp / Rent received · Flat 2B" style list), sorted most-recent first.
 *
 * @param {Array} periodTxns - already date-filtered to the period being viewed
 * @returns {{ total: number, rows: Array<{id, name, date, amount}> }}
 */
export function getIncomeSummary(periodTxns) {
  const rows = (periodTxns || [])
    .filter(t => t && t.type === "income")
    .map(t => ({ id: t.id, name: t.merchant || t.who || t.desc || "Income", date: t.date || null, amount: Number(t.amount || 0) }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  return { total, rows };
}

/**
 * Household income for each of the given month keys, in order — the data a trend chart needs.
 * Reuses the exact same type==="income" filter as getIncomeSummary, just once per month.
 *
 * @param {Array} txns - full, unfiltered transaction list
 * @param {Array<string>} monthKeys - e.g. ["2026-04", "2026-05", ...]
 * @returns {Array<{monthKey, total}>}
 */
export function getIncomeMonthSeries(txns, monthKeys) {
  return (monthKeys || []).map(monthKey => {
    const total = (txns || [])
      .filter(t => t && t.type === "income" && t.date && t.date.startsWith(monthKey))
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return { monthKey, total };
  });
}
