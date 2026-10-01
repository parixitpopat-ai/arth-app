// domain/insights/savingRate.js
//
// WP12 — Saving rate (section 10), newly required by the handoff. Deliberately takes the
// household's forecasted month-end spend and EMI total as ARGUMENTS rather than computing
// either itself — both already exist (getHouseholdForecastSummary's projectedMonthEnd is
// Budget's own canonical forecast; monthlyEmiCommitment is App.jsx's own existing EMI total).
// This file only combines already-canonical figures; it introduces no forecasting method of
// its own, per the explicit rule that Insights must never create a third one.
//
// Formula, as specified in the handoff: saving rate = (income − spending(forecast) − loan EMIs)
// ÷ income. "Kept" includes recurring SIP investment, which is already inside spending(forecast)
// as committed saving? No — per the handoff's own worked example, SIP is carried as ITS OWN
// line ("Kept · incl. ₹5,000 SIP"), meaning the ₹5,000 SIP amount is NOT subtracted out again —
// it's already part of what's "kept" (money that left checking but stayed in the household's
// own investments), so no separate SIP subtraction happens here; sipAmount is accepted purely
// for that one caption line, never subtracted from the kept total.

/**
 * @param {number} income - this period's real income total (getIncomeSummary's `total`)
 * @param {number} projectedSpend - Budget's own canonical month-end forecast (projectedMonthEnd)
 * @param {number} emiTotal - the household's existing monthly EMI commitment total
 * @param {number} [sipAmount] - this period's SIP total, caption-only (see file header)
 * @returns {{rate: number|null, kept: number, income: number, projectedSpend: number, emiTotal: number, sipAmount: number}}
 *   rate is null when income is 0 (nothing to take a percentage of — not fabricated as 0%).
 */
export function getSavingRateSummary(income, projectedSpend, emiTotal, sipAmount = 0) {
  const safeIncome = Number(income || 0);
  const safeSpend = Number(projectedSpend || 0);
  const safeEmi = Number(emiTotal || 0);
  const kept = safeIncome - safeSpend - safeEmi;
  const rate = safeIncome > 0 ? Math.round((kept / safeIncome) * 100) : null;
  return { rate, kept, income: safeIncome, projectedSpend: safeSpend, emiTotal: safeEmi, sipAmount: Number(sipAmount || 0) };
}
