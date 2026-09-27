// Bills' billing-period date logic. Extracted per the Function Extraction Checklist
// (CODING_STANDARDS.md) — both pure, no signature changes. Split out from the original
// calculations.js, which mixed these with remainingShare (not a date calculation, and not
// Bills-specific — see domain/shared/remainingShare.js).
//
// Bug fix (found while auditing for duplicate date-stepping logic across the app, alongside
// domain/obligations/expected.js's identical bug): `date.setMonth(date.getMonth()+1)` on a
// day-of-month that doesn't exist in the target month silently overflows PAST it — e.g. 31 Jan
// "+1 month" lands on 3 Mar, skipping February entirely, not on 28/29 Feb as intended. This
// affected every monthly/quarterly/halfyearly/yearly recurring Bill due on the 29th–31st, via
// confirmMarkBillPaid's auto-regeneration (App.jsx), and every recurring Expected Income entry
// via ExpectedIncomeScreen's "mark received" (both call computeNextDueDate). Fixed by stepping
// from the 1st of the month, then clamping the intended day into whatever month that lands in —
// the same technique expected.js uses for the same reason.

const daysInMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** advance `base` by `freq`, safely (day-31-proof), keeping base's own day-of-month, clamped. */
const stepByFrequency = (base, freq) => {
  const day = base.getDate();
  const stepped = new Date(base.getFullYear(), base.getMonth(), 1);
  if (freq === "monthly") stepped.setMonth(stepped.getMonth() + 1);
  else if (freq === "quarterly") stepped.setMonth(stepped.getMonth() + 3);
  else if (freq === "halfyearly") stepped.setMonth(stepped.getMonth() + 6);
  else if (freq === "annual" || freq === "yearly") stepped.setFullYear(stepped.getFullYear() + 1);
  stepped.setDate(Math.min(day, daysInMonth(stepped)));
  return stepped;
};

export const computeNextDueDate = (bill, paidDate) => {
  const base = bill.billingModel === "prorata"
    ? new Date(paidDate || bill.dueDate || bill.activationDate || new Date())
    : new Date(bill.periodEnd || bill.dueDate || new Date());
  const freq = bill.frequency || "monthly";
  if (freq === "custom" && bill.validityDays) {
    const next = new Date(base);
    next.setDate(next.getDate() + Number(bill.validityDays));
    return next.toISOString().split("T")[0];
  }
  if (freq !== "monthly" && freq !== "quarterly" && freq !== "halfyearly" && freq !== "annual" && freq !== "yearly") {
    return base.toISOString().split("T")[0]; // unknown frequency: unchanged from the original behavior (no-op step)
  }
  return stepByFrequency(base, freq).toISOString().split("T")[0];
};

export const computeNextPeriod = (bill, paidDate) => {
  if(bill.billingModel !== "calendar" || !bill.periodStart || !bill.periodEnd) return null;
  const start = new Date(bill.periodEnd); start.setDate(start.getDate() + 1);
  const freq = bill.frequency || "monthly";
  const nextStart = stepByFrequency(start, freq);
  const end = new Date(nextStart); end.setDate(end.getDate() - 1);
  return { periodStart: start.toISOString().split("T")[0], periodEnd: end.toISOString().split("T")[0] };
};
