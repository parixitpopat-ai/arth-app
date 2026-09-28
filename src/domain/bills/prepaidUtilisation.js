// domain/bills/prepaidUtilisation.js
//
// WP9 — Prepaid/Utilisation generalization. The locked rule this module exists to enforce: a
// real prepaid payment (Fastag top-up, mobile recharge, DTH renewal, metered prepaid top-up...)
// stays exactly one Bill record, same as every other recharge-type Bill already created via the
// Add Bill flow (App.jsx's validFrom2/validUntilCalc fields, unchanged by this module). Coverage,
// utilisation and remaining time are never stored as separate synthetic records — they are
// derived here, on demand, from that one real Bill's validFrom/validUntil. Nothing here creates,
// reads, or writes bills[]/txns[] — it only computes over what the caller already has.
//
// This is the single canonical home for that derivation — domain/insights/utilisation.js's own
// getPrepaidUtilisation (the cross-biller ranking used by the Insights page) is built on top of
// getPrepaidCoverage below, not a second implementation of "which period is current."

import { isRechargeBiller } from "./commitments.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const toDayMs = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// A bare "YYYY-MM-DD" string, parsed as the LOCAL calendar day it names — never via `new
// Date(dateStr)`, which parses a date-only string as UTC midnight. That mismatch is real: in
// India (UTC+5:30), UTC midnight is still the previous local evening, which silently shifted
// daysRemaining by a day depending on the viewer's clock time. Every date this module compares
// goes through this parse, so "today" (constructed via toDayMs, always local) and validFrom/
// validUntil (stored as bare date strings) are always compared on the same footing.
const parseLocalDateMs = (dateStr) => {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

/**
 * Every real recharge-type Bill for one Biller Account that carries an actual validUntil —
 * i.e. every real prepaid period on record for this account, most recent first. Never
 * fabricates a period between two real ones (a gap in coverage is a real gap, not filled in).
 *
 * @param {Array} billerAccountBills - the caller's own bills.filter(b => b.billerAccountId === id)
 * @returns {Array} Bill records, sorted by validFrom descending
 */
export function getPrepaidHistory(billerAccountBills) {
  return (billerAccountBills || [])
    .filter(b => b.validUntil && isRechargeBiller(b.billerCategory))
    .slice()
    .sort((a, b) => String(b.validFrom || "").localeCompare(String(a.validFrom || "")));
}

/**
 * The current (most recent) real prepaid coverage period for one Biller Account, and what's
 * derived from it: days remaining (negative once expired) and, only when validFrom is also on
 * record, percentUsed/totalDays. percentUsed is never computed from a guessed start date — a
 * Bill with validUntil but no validFrom yields totalDays/percentUsed of null, not a fabricated
 * percentage. Returns null entirely when this account has no real prepaid period on record.
 *
 * @param {Array} billerAccountBills - the caller's own bills.filter(b => b.billerAccountId === id)
 * @param {Date} [today]
 * @returns {{validFrom, validUntil, daysRemaining, totalDays, percentUsed, status}|null}
 *   status: "expired" | "expiring_soon" (<=7 days remaining) | "active"
 */
export function getPrepaidCoverage(billerAccountBills, today = new Date()) {
  const history = getPrepaidHistory(billerAccountBills);
  if (!history.length) return null;
  const current = history[0]; // getPrepaidHistory is already sorted most-recent-first
  const todayMs = toDayMs(today);
  const daysRemaining = Math.ceil((parseLocalDateMs(current.validUntil) - todayMs) / DAY_MS);
  const status = daysRemaining < 0 ? "expired" : daysRemaining <= 7 ? "expiring_soon" : "active";

  let totalDays = null, percentUsed = null;
  if (current.validFrom) {
    totalDays = Math.round((parseLocalDateMs(current.validUntil) - parseLocalDateMs(current.validFrom)) / DAY_MS) + 1;
    if (totalDays > 0) {
      const daysElapsed = Math.min(totalDays, Math.max(0, totalDays - Math.max(0, daysRemaining)));
      percentUsed = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
    }
  }

  return { validFrom: current.validFrom || null, validUntil: current.validUntil, daysRemaining, totalDays, percentUsed, status };
}
