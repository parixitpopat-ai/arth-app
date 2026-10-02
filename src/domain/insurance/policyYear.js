// domain/insurance/policyYear.js
//
// Payments v2 (WP18d) F2 "Policy year" — e.g. "12 Nov 2025 – 11 Nov 2026". A policy's current
// coverage year is never stored as its own field: it is derived, on demand, from the policy's
// next renewalDate (always the first day of the NEXT cycle) and its premiumFrequency. The
// current cycle therefore ends the day before renewalDate, and started one cycle-length before
// that. Pure and deterministic — no clock, no store access.

const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3, halfyearly: 6, annual: 12 };

import { addDaysToDateStr, addMonthsClamped } from "../../helpers/dateHelpers.js";

/**
 * @param {string} renewalDate - "YYYY-MM-DD", the policy's next renewal date
 * @param {string} premiumFrequency - "monthly" | "quarterly" | "halfyearly" | "annual"
 * @returns {{start:string, end:string}|null} the current policy year's start/end, or null when
 *   renewalDate isn't known.
 */
export function getPolicyYearRange(renewalDate, premiumFrequency) {
  if (!renewalDate) return null;
  const months = FREQUENCY_MONTHS[premiumFrequency] || 12;
  return {
    start: addMonthsClamped(renewalDate, -months),
    end: addDaysToDateStr(renewalDate, -1),
  };
}

/** "2025–26" style short label for a policy year's start, by its start date's own calendar year. */
export function getPolicyYearLabel(policyYearRange) {
  if (!policyYearRange?.start) return "";
  const startYear = Number(String(policyYearRange.start).slice(0, 4));
  if (!startYear) return "";
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;
}
