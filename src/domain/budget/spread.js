// domain/budget/spread.js
//
// Plan Ahead PA14/PA15 - "Spread over months": one payment counted across several months of BUDGET.
// Cash is untouched - the full amount still leaves in the month it is paid; only the budget view shares it.
// A spread is a plan on top of a payment: removing it restores the single-month budget count.
//
// Shape: { id, key, label, amount, startMonth, months, cashDate, createdAt }
//   key       "sourceType:sourceId" of the upcoming item it was made from, or null for an already-paid payment
//   cashDate  the date the cash leaves (due date for an upcoming item, paid date for a payment)

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export const shiftMonth = (mk, delta) => { const [y, m] = String(mk).split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const monthIndex = mk => { const [y, m] = String(mk).split("-").map(Number); return y * 12 + (m - 1); };

/** Equal shares in whole paise; any rounding remainder goes to the last month so the shares add up exactly. */
export function spreadShares(amount, months) {
  const n = Math.max(1, Math.floor(Number(months) || 1));
  const total = r2(amount);
  const base = Math.floor((total * 100) / n) / 100;
  const shares = Array.from({ length: n }, () => base);
  shares[n - 1] = r2(total - base * (n - 1));
  return shares;
}

/** @returns {{ok:true, spread:Object}|{ok:false, reason:string}} */
export function createSpread({ key = null, label, amount, startMonth, months, cashDate, genId }) {
  const n = Math.floor(Number(months));
  if (!(Number(amount) > 0)) return { ok: false, reason: "There is no amount to spread." };
  if (!Number.isFinite(n) || n < 1) return { ok: false, reason: "Choose how many months." };
  if (n > 60) return { ok: false, reason: "Spread over at most 60 months." };
  if (!/^\d{4}-\d{2}$/.test(String(startMonth || ""))) return { ok: false, reason: "Choose the starting month." };
  return { ok: true, spread: { id: genId(), key, label: label || "Payment", amount: r2(amount), startMonth, months: n, cashDate: cashDate || null, createdAt: Date.now() } };
}

/** This spread's position in `monthKey`: { index (0-based), of, share } or null when the month is outside it. */
export function spreadInMonth(spread, monthKey) {
  const idx = monthIndex(monthKey) - monthIndex(spread.startMonth);
  if (idx < 0 || idx >= spread.months) return null;
  return { index: idx, of: spread.months, share: spreadShares(spread.amount, spread.months)[idx] };
}

/** The months a spread touches, with each month's budget share. */
export function spreadMonths(spread) {
  const shares = spreadShares(spread.amount, spread.months);
  return shares.map((share, i) => ({ monthKey: shiftMonth(spread.startMonth, i), share }));
}
