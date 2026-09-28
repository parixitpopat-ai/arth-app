// domain/insights/utilisation.js
//
// WP8 — the Prepaid/service utilisation slice of the central Insights read model. Deliberately
// thin, per the acceptance criteria's own qualifier ("where available"): no estimation anywhere
// — a billerAccount with no real validUntil on record simply isn't included, never guessed.
//
// getPrepaidUtilisation reuses isRechargeBiller (the existing recharge-type classifier) plus the
// real validUntil/validFrom fields already captured on recharge Bills (Mobile Prepaid, Fastag,
// Metro/NCMC/EV Recharge, Prepaid Meter, DTH) — the same fields the Payments screen's own
// "Until <date>" badge already reads (App.jsx ~L15497), never a new tracking mechanism.
//
// getMembershipUtilisation is a thin re-export of the existing getCostPerVisit — a genuine
// utilisation metric (cost per gym/membership visit) that already exists but was never surfaced
// as an Insight.

import { isRechargeBiller } from "../../src/domain/bills/commitments.js";
export { getCostPerVisit as getMembershipUtilisation } from "../../src/domain/membership/checkIn.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * For every recharge-type Biller Account, its most recent real validity period (by validFrom),
 * and how many days remain (negative once expired). Only Biller Accounts with at least one
 * recharge Bill carrying a real validUntil are included — no data, no row, never a guess.
 *
 * @param {Array} bills
 * @param {Array} billerAccounts - [{id, name, type}]
 * @param {Date} [today]
 * @returns {Array<{billerAccount, validFrom, validUntil, daysRemaining, status}>}
 *   status: "expired" | "expiring_soon" (<=7 days) | "active"
 */
export function getPrepaidUtilisation(bills, billerAccounts, today = new Date()) {
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const latestByAccount = new Map();
  (bills || []).forEach(b => {
    if (!b.billerAccountId || !b.validUntil || !isRechargeBiller(b.billerCategory)) return;
    const key = String(b.billerAccountId);
    const existing = latestByAccount.get(key);
    if (!existing || String(b.validFrom || "") > String(existing.validFrom || "")) {
      latestByAccount.set(key, b);
    }
  });
  return Array.from(latestByAccount.entries())
    .map(([id, bill]) => {
      const billerAccount = (billerAccounts || []).find(ba => String(ba.id) === id) || null;
      if (!billerAccount) return null;
      const daysRemaining = Math.ceil((new Date(bill.validUntil).getTime() - todayMs) / DAY_MS);
      const status = daysRemaining < 0 ? "expired" : daysRemaining <= 7 ? "expiring_soon" : "active";
      return { billerAccount, validFrom: bill.validFrom || null, validUntil: bill.validUntil, daysRemaining, status };
    })
    .filter(Boolean)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}
