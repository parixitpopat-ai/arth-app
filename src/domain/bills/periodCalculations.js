// Bills' billing-period date logic. Extracted per the Function Extraction Checklist
// (CODING_STANDARDS.md) — both pure, no signature changes. Split out from the original
// calculations.js, which mixed these with remainingShare (not a date calculation, and not
// Bills-specific — see domain/shared/remainingShare.js).
//
// Bug fix #1 (found while auditing for duplicate date-stepping logic across the app, alongside
// domain/obligations/expected.js's identical bug): `date.setMonth(date.getMonth()+1)` on a
// day-of-month that doesn't exist in the target month silently overflows PAST it — e.g. 31 Jan
// "+1 month" lands on 3 Mar, skipping February entirely, not on 28/29 Feb as intended. This
// affected every monthly/quarterly/halfyearly/yearly recurring Bill due on the 29th–31st, via
// confirmMarkBillPaid's auto-regeneration (App.jsx), and every recurring Expected Income entry
// via ExpectedIncomeScreen's "mark received" (both call computeNextDueDate).
//
// Bug fix #2 (self-inflicted by fix #1's first version, caught by re-running the new tests under
// TZ=Asia/Kolkata, not just the sandbox's default UTC — the exact gap that let both bugs hide):
// the first version of this fix formatted its result with `.toISOString().split("T")[0]`, which
// gives the UTC calendar day — in India, still the PREVIOUS day until 05:30 local. This file now
// reuses the two helpers helpers/dateHelpers.js already provides for exactly this, instead of
// each maintaining its own copy of the same logic: `dateAtDay(year, monthIndex, day)` (clamps a
// day into whichever month it lands in — the same clamp expected.js's own, separate
// implementation does) and `toLocalDateStr` (the app's one local-safe "YYYY-MM-DD" formatter,
// already used everywhere else since this session's earlier UTC-vs-local fixes).

import { dateAtDay, toLocalDateStr } from "../../helpers/dateHelpers.js";

/** Advance `base` by `freq`, keeping its own day-of-month, safely clamped (day-31-proof) into
 *  whatever month/year that lands in. Unrecognized frequency: no-op, same as before. */
const stepByFrequency = (base, freq) => {
  const day = base.getDate();
  if (freq === "monthly") return dateAtDay(base.getFullYear(), base.getMonth() + 1, day);
  if (freq === "quarterly") return dateAtDay(base.getFullYear(), base.getMonth() + 3, day);
  if (freq === "halfyearly") return dateAtDay(base.getFullYear(), base.getMonth() + 6, day);
  if (freq === "annual" || freq === "yearly") return dateAtDay(base.getFullYear() + 1, base.getMonth(), day);
  return base;
};

export const computeNextDueDate = (bill, paidDate) => {
  const base = bill.billingModel === "prorata"
    ? new Date(paidDate || bill.dueDate || bill.activationDate || new Date())
    : new Date(bill.periodEnd || bill.dueDate || new Date());
  const freq = bill.frequency || "monthly";
  if (freq === "custom" && bill.validityDays) {
    const next = new Date(base);
    next.setDate(next.getDate() + Number(bill.validityDays));
    return toLocalDateStr(next);
  }
  return toLocalDateStr(stepByFrequency(base, freq));
};

export const computeNextPeriod = (bill, paidDate) => {
  if(bill.billingModel !== "calendar" || !bill.periodStart || !bill.periodEnd) return null;
  const start = new Date(bill.periodEnd); start.setDate(start.getDate() + 1);
  const freq = bill.frequency || "monthly";
  const nextStart = stepByFrequency(start, freq);
  const end = new Date(nextStart); end.setDate(end.getDate() - 1);
  return { periodStart: toLocalDateStr(start), periodEnd: toLocalDateStr(end) };
};
