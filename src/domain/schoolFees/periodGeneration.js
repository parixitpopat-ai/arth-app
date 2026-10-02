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

// ============================================================================
// buildManualFeePeriods — Payments v2 (WP18) School Fees domain change.
//
// generateFeePeriods above is left completely unmodified — it stays the read
// path for whatever already-created schedules/periods exist (backward
// compatibility with existing data), and its own "one period per calendar
// month, no cycle/frequency concept" design is untouched.
//
// New schedule CREATION no longer goes through generateFeePeriods at all.
// The product owner's own words: school fees have a manual structure — a
// period can be 1, 2, 3, 5, however many months long, decided per instance,
// with no frequency/cycle picker (Monthly/Quarterly/Halfyearly/Annual, "No.
// of cycles") anywhere in the School Fees creation flow. So this function
// takes a caller-supplied list of periods — each an arbitrary date range
// with its own amount — and constructs one feePeriod record per supplied
// period directly, in exactly the shape every existing pure function in
// this domain (startingState.js, settlement.js, discountWriteOff.js,
// creditNotes.js, outstanding.js) already operates on generically. None of
// those functions assume a period is exactly one calendar month — they only
// ever read periodStart/periodEnd/obligationAmount/paidAmount/etc — so
// nothing downstream of this function needs to change.
//
// startingStateDeclared fix (reusing the WP17 investigation's conclusion,
// not re-deriving it): generateFeePeriods above always births a period
// undeclared (startingStateDeclared: false), which is right for a period
// that's already calendar-past relative to when the schedule is created
// (Arth genuinely doesn't know whether it was already paid before tracking
// began), but wrong for a period that hasn't elapsed yet — there is nothing
// to "declare" about the future, and gating it behind an undeclared-prompt
// just because its periodEnd will eventually pass is a bug, not a feature.
// This function instead births each period already declared ("false"-unpaid,
// paidAmount 0) whenever its periodEnd has not yet elapsed as of creation
// time, and only leaves it undeclared when periodEnd is already in the past
// at creation time (a genuinely historical period being backfilled).
//
// Also carries the `kind` discriminator (Payments v2 Education screens,
// E1/E2/E4): one-time fee items (registration, uniform, books, activities,
// exams, transport-as-one-time) are modeled as their own feePeriod records,
// distinguishable by `kind`, going through these exact same pure functions —
// never a second settlement/discount/credit system.

const FEE_KINDS = ["tuition", "transport", "registration", "uniform", "books", "activities", "exams", "other"];

/**
 * @param {Array<{label?:string, periodStart:string, periodEnd:string, obligationAmount:number, kind?:string}>} periods
 *   Caller-supplied, arbitrary-length periods — NOT required to be whole
 *   calendar months, NOT required to be contiguous or non-overlapping (a
 *   one-time fee item may share a date range with a tuition period).
 * @param {Object} [options]
 * @param {string} [options.todayStr] - "YYYY-MM-DD", injectable for
 *   deterministic tests; defaults to the real local today.
 * @returns {Array} feePeriods — NOT yet persisted, NOT yet carrying a
 *   scheduleId. Caller attaches scheduleId (same convention as
 *   generateFeePeriods) and writes to state.
 * @throws {Error} if periods is empty, or any entry is missing
 *   periodStart/periodEnd/obligationAmount, has periodStart after periodEnd,
 *   or a non-positive obligationAmount.
 */
export function buildManualFeePeriods(periods, options = {}) {
  if (!Array.isArray(periods) || periods.length === 0) {
    throw new Error("buildManualFeePeriods: at least one period is required");
  }
  const todayStrV = options.todayStr || toLocalDateStrFallback(new Date());

  return periods.map((input, idx) => {
    const { label, periodStart, periodEnd, obligationAmount, kind } = input || {};
    if (!periodStart || !periodEnd) {
      throw new Error(`buildManualFeePeriods: period ${idx + 1} is missing periodStart/periodEnd`);
    }
    if (periodStart > periodEnd) {
      throw new Error(`buildManualFeePeriods: period ${idx + 1}'s periodStart is after its periodEnd`);
    }
    if (!Number.isFinite(Number(obligationAmount)) || Number(obligationAmount) <= 0) {
      throw new Error(`buildManualFeePeriods: period ${idx + 1} needs a positive obligationAmount`);
    }
    const resolvedKind = kind && FEE_KINDS.includes(kind) ? kind : "tuition";
    // Born declared (unpaid) when the period hasn't elapsed yet as of creation —
    // nothing to backfill. Born undeclared only when it's already calendar-past.
    const alreadyElapsed = periodEnd < todayStrV;
    return {
      id: genId(),
      label: label && label.trim() ? label.trim() : formatDateRangeLabel(periodStart, periodEnd),
      periodStart,
      periodEnd,
      dueDate: periodStart,
      obligationAmount: Number(obligationAmount),
      kind: resolvedKind,
      startingStateDeclared: !alreadyElapsed,
      paidAmount: 0,
      discountAmount: 0,
      writeOffAmount: 0,
      appliedCreditAmount: 0,
      settlementLinks: [],
    };
  });
}

// Local fallback so this module has no dependency on dateHelpers.js for its
// default — startingState.js already owns the todayStr() helper used
// everywhere else; callers in practice always pass options.todayStr
// explicitly (App.jsx's own todayStr()), this is only a safety default.
function toLocalDateStrFallback(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Oct – Dec" (same year) or "Oct 2026 – Jan 2027" (crosses a year) — never a quarter number. */
function formatDateRangeLabel(periodStart, periodEnd) {
  const [ys, ms] = periodStart.split("-").map(Number);
  const [ye, me] = periodEnd.split("-").map(Number);
  const startLabel = `${MONTH_NAMES[ms - 1].slice(0, 3)}${ys !== ye ? ` ${ys}` : ""}`;
  const endLabel = `${MONTH_NAMES[me - 1].slice(0, 3)} ${ye}`;
  return ms === me && ys === ye ? `${MONTH_NAMES[ms - 1]} ${ys}` : `${startLabel} – ${endLabel}`;
}
