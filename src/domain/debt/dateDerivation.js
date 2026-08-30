// domain/debt/dateDerivation.js
//
// One pure function: "what's the next occurrence of day-of-month X, on or
// after a given reference date?" Used for both personal-loan `dueDay` and
// CC EMI `statementDate` — the underlying math is identical in both cases,
// so this is deliberately one small shared function, not two near-copies.
//
// Never calls new Date()/Date.now() internally — the reference date is
// always injected by the caller, so this is fully deterministic and
// testable without any hidden "now."
//
// Rollover behavior deliberately mirrors what the app's own CC-EMI-purchase
// auto-materialization code already does elsewhere in App.jsx (JS's own
// Date constructor rollover for a day that doesn't exist in a given month,
// e.g. day 31 in a 30-day month) — this file doesn't invent a new date
// convention, it reuses the one already accepted in production.

/**
 * @param {Date} today - reference date (caller-supplied, never computed here)
 * @param {number} day - day of month, 1-31
 * @returns {string|null} an ISO date string (YYYY-MM-DD), or null if `day`
 *   isn't a valid day-of-month value. Never throws.
 */
export function computeNextOccurrenceOfDay(today, day) {
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) return null;
  const d = Number(day);
  if (!Number.isInteger(d) || d < 1 || d > 31) return null;

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let candidate = new Date(today.getFullYear(), today.getMonth(), d);
  if (candidate < todayMidnight) {
    candidate = new Date(today.getFullYear(), today.getMonth() + 1, d);
  }
  // Local-date formatting, deliberately not toISOString() — that converts to
  // UTC first, which can silently shift the date by one day depending on
  // the caller's timezone and time of day. This stays in local calendar terms
  // throughout, matching how the rest of Arth's domain layer treats dates.
  const yyyy = candidate.getFullYear();
  const mm = String(candidate.getMonth() + 1).padStart(2, "0");
  const dd = String(candidate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
