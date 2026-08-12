// WP-2 (ADR-037, technical shape resolved 2026-08-10, commit c4ec91f) — first
// Financial Calendar module. Read-only, no owned state, matching the resolved
// AggregateRoot question: this is a pure-function module in the same shape as
// domain/cards/summaries.js, not an aggregate.
//
// Scope, deliberately narrow, matching this session's WP-2 minimum-slice
// decision: Calendar Month only. No Fiscal Year, Quarter, Custom, or Billing
// Cycle period types. This module does not wrap or replace the existing
// "YYYY-MM" viewMonth string convention (ADR-037 §8) — it takes that string
// as input unchanged and returns computed bounds alongside it, nothing more.

import { dateAtDay } from "../../helpers/dateHelpers.js";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n) => String(n).padStart(2, "0");

const toIsoDateString = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Calendar Month bounds for the existing "YYYY-MM" viewMonth convention.
 * Pure function — no state, no mutation.
 */
export const getCalendarMonthBounds = (monthKey) => {
  const [yearStr, monthStr] = String(monthKey || "").split("-");
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1; // "YYYY-MM" is 1-indexed; Date is 0-indexed

  const startDate = dateAtDay(year, monthIndex, 1);
  // NOT using dateAtDay(year, monthIndex+1, 0) here — verified against the real
  // dateHelpers.js that this breaks. dateAtDay clamps its day argument via
  // `Math.max(1, Number(day)||1)`; since 0 is falsy in JS, day=0 is silently
  // promoted to day=1. Computing the last day directly instead.
  const endDate = new Date(year, monthIndex + 1, 0, 12, 0, 0, 0);

  return {
    start: toIsoDateString(startDate),
    end: toIsoDateString(endDate),
    label: `${MONTH_LABELS[startDate.getMonth()]} ${startDate.getFullYear()}`,
  };
};