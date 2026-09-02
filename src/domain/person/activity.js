// domain/person/activity.js
//
// Pure. Reuses getPersonAttributedAmount (the existing, already-correct
// primitive) over a rolling 6-month window — extends WP-B1's
// current-month-only pattern rather than inventing a second calculation.

// Same timezone-safe date parsing as reminders.js — deliberately never
// mixes `new Date(str)` (UTC) with `new Date(y,m,d)` (local) for what's
// meant to be the same calendar date. This file happened to work
// correctly for timezones ahead of UTC even without this fix, but that
// was luck, not correctness — fixed proactively once the same bug class
// was confirmed real elsewhere in this session.
function parseDateOnly(str) {
  const parts = String(str).split("-").map(Number);
  const [year, month, day] = parts;
  return new Date(year, (month || 1) - 1, day || 1);
}

/**
 * @param {string} personId
 * @param {Array} txns
 * @param {Function} getPersonAttributedAmount - injected, existing function
 * @param {string} referenceDateStr - "YYYY-MM-DD", injected for determinism
 * @returns {{
 *   months: Array<{key, label, total}>,   // oldest -> newest, 6 entries
 *   totalOverPeriod: number,
 *   monthlyAverage: number,
 *   transactionCount: number,
 * }}
 */
export function getPersonSixMonthActivity(personId, txns, getPersonAttributedAmount, referenceDateStr) {
  const ref = parseDateOnly(referenceDateStr || new Date().toISOString().slice(0, 10));
  const monthKeys = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const totalsByMonth = new Map(monthKeys.map(k => [k, 0]));
  let transactionCount = 0;

  for (const t of (txns || [])) {
    if (!t || t.type !== "expense" || !t.date) continue;
    const monthKey = t.date.slice(0, 7);
    if (!totalsByMonth.has(monthKey)) continue;
    const amount = getPersonAttributedAmount(t, personId);
    if (!(amount > 0)) continue;
    totalsByMonth.set(monthKey, totalsByMonth.get(monthKey) + amount);
    transactionCount++;
  }

  const months = monthKeys.map(key => {
    const monthIdx = Number(key.slice(5, 7)) - 1;
    return { key, label: MONTH_LABELS[monthIdx], total: totalsByMonth.get(key) };
  });
  const totalOverPeriod = months.reduce((s, m) => s + m.total, 0);

  return {
    months,
    totalOverPeriod,
    monthlyAverage: totalOverPeriod > 0 ? totalOverPeriod / 6 : 0,
    transactionCount,
  };
}
