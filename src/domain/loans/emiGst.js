// domain/loans/emiGst.js
//
// GST on the interest of a card EMI (18% in India) is billed with each instalment. The Add form takes the TOTAL GST on interest
// ("GST on interest", e.g. 648); each instalment carries an equal share, and any rounding left over goes on the last instalment so
// the shares always add back to the total exactly. Pure.

const paise = n => Math.round((Number(n) || 0) * 100);

/** @returns {number[]} `tenure` rupee amounts that sum to `total` (all zero when there is no GST or no tenure) */
export function splitGstAcrossInstalments(total, tenure) {
  const n = Math.max(0, Math.floor(Number(tenure) || 0));
  const t = paise(total);
  if (n === 0 || t <= 0) return Array.from({ length: n }, () => 0);
  const base = Math.floor(t / n);
  const out = Array.from({ length: n }, () => base);
  out[n - 1] += t - base * n;
  return out.map(p => p / 100);
}
