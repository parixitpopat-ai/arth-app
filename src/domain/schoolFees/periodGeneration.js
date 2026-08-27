// domain/schoolFees/periodGeneration.js
//
// Pure period-generation function for School Fee schedules (I-5 WP-2).
// Read/generation logic only — no state, no side effects, no persistence,
// no Bills/Membership/getCommitments() interaction of any kind. Nothing in
// this file is wired into any consumer; WP-1 owns storage, WP-2 owns this.
//
// Locked requirements this function is responsible for (School Fees
// Architecture Decisions + I-5 plan corrections):
//
// - One independently addressable fee period per calendar month in range.
// - Rate rules may change within a school year — rateRules[] covers
//   sub-ranges by month; each generated period reads its amount from
//   whichever rule covers its month AT GENERATION TIME ONLY.
// - A generated period's obligationAmount is independent once created. This
//   function has no re-derivation step — it is only ever called once, at
//   schedule creation. Editing a single period afterwards (WP-4) never calls
//   back into this function, which is what keeps "September override doesn't
//   change October" true. This file cannot violate that rule by construction
//   because it has no update path at all, only a generate-once path.
// - Each school year is a separate schedule. This function is intentionally
//   ignorant of any other schedule — it only ever produces periods for the
//   single (schoolYearStart, schoolYearEnd) range it's given, and the caller
//   is responsible for attaching a scheduleId and never re-invoking this
//   function against an existing schedule's range.
// - No proration: v1 generates whole calendar months only.
// - No inferred missing rate: a month with no covering rateRules entry is a
//   thrown error, never a guess.

import { genId } from "../../helpers/idGenerator.js";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/**
 * Generate one fee period per whole calendar month between schoolYearStart
 * and schoolYearEnd (inclusive), reading each month's obligationAmount from
 * whichever rateRules entry covers it.
 *
 * @param {string} schoolYearStart - "YYYY-MM-DD"
 * @param {string} schoolYearEnd - "YYYY-MM-DD"
 * @param {Array<{from:string, to:string, monthlyRate:number}>} rateRules -
 *   from/to are "YYYY-MM" month strings, inclusive on both ends.
 * @returns {Array} feePeriods — NOT yet persisted, NOT yet carrying a
 *   scheduleId. Caller attaches scheduleId and writes to state (WP-1).
 * @throws {Error} if schoolYearStart/End are missing or invalid, if
 *   schoolYearStart is after schoolYearEnd, if rateRules is empty, or if any
 *   month in range has no covering rateRules entry.
 */
export function generateFeePeriods(schoolYearStart, schoolYearEnd, rateRules) {
  if (!schoolYearStart || !schoolYearEnd) {
    throw new Error("generateFeePeriods: schoolYearStart and schoolYearEnd are required");
  }
  if (!Array.isArray(rateRules) || rateRules.length === 0) {
    throw new Error("generateFeePeriods: at least one rate rule is required");
  }

  const months = enumerateMonths(schoolYearStart, schoolYearEnd);

  return months.map(({ monthKey, periodStart, periodEnd }) => {
    const rate = findRateForMonth(monthKey, rateRules);
    if (rate == null) {
      throw new Error(`generateFeePeriods: no rate rule covers ${monthKey} — refusing to guess a missing rate`);
    }
    return {
      id: genId(),
      label: formatMonthLabel(monthKey),
      periodStart,
      periodEnd,
      dueDate: periodStart, // v1 default: fee due at period start (documented assumption, I-5 plan)
      obligationAmount: rate,
      startingStateDeclared: false, // I-5 plan correction #1 — undeclared until the user says otherwise
      paidAmount: 0,
      discountAmount: 0,
      writeOffAmount: 0,
      appliedCreditAmount: 0, // I-5 plan correction #2 — credit tracked separately from payment
      settlementLinks: [],
    };
  });
}

// --- internal helpers, not exported -----------------------------------

function enumerateMonths(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("generateFeePeriods: schoolYearStart/schoolYearEnd must be valid dates");
  }
  if (start.getTime() > end.getTime()) {
    throw new Error("generateFeePeriods: schoolYearStart must not be after schoolYearEnd");
  }

  const months = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor.getTime() <= last.getTime()) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const periodStart = `${monthKey}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const periodEnd = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
    months.push({ monthKey, periodStart, periodEnd });
    cursor = new Date(y, m + 1, 1);
  }
  return months;
}

function findRateForMonth(monthKey, rateRules) {
  const match = rateRules.find(r => monthKey >= r.from && monthKey <= r.to);
  return match ? Number(match.monthlyRate) : null;
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
