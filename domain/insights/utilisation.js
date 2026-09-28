// domain/insights/utilisation.js
//
// WP8/WP9 — the Prepaid/service utilisation slice of the central Insights read model.
// Deliberately thin, per WP8's acceptance criteria's own qualifier ("where available"): no
// estimation anywhere — a billerAccount with no real validUntil on record simply isn't
// included, never guessed.
//
// getPrepaidUtilisation is now a cross-biller ranking built on top of
// domain/bills/prepaidUtilisation.js's getPrepaidCoverage (WP9's single canonical derivation,
// also used directly by the Biller Account Detail screen) — this file no longer re-derives
// "which period is current" itself, only ranks the per-biller results that function returns.
//
// getMembershipUtilisation is a thin re-export of the existing getCostPerVisit — a genuine
// utilisation metric (cost per gym/membership visit) that already exists but was never surfaced
// as an Insight.

import { getPrepaidCoverage } from "../../src/domain/bills/prepaidUtilisation.js";
export { getCostPerVisit as getMembershipUtilisation } from "../../src/domain/membership/checkIn.js";

/**
 * For every Biller Account with a real, current prepaid coverage period, that period and how
 * many days remain — ranked soonest-to-expire first. Thin wrapper: groups bills by
 * billerAccountId and calls getPrepaidCoverage per account, never a second "current period"
 * derivation.
 *
 * @param {Array} bills
 * @param {Array} billerAccounts - [{id, name, type}]
 * @param {Date} [today]
 * @returns {Array<{billerAccount, validFrom, validUntil, daysRemaining, totalDays, percentUsed, status}>}
 */
export function getPrepaidUtilisation(bills, billerAccounts, today = new Date()) {
  return (billerAccounts || [])
    .map(billerAccount => {
      const accountBills = (bills || []).filter(b => String(b.billerAccountId) === String(billerAccount.id));
      const coverage = getPrepaidCoverage(accountBills, today);
      return coverage ? { billerAccount, ...coverage } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}
