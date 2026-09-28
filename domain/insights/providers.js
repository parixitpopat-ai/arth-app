// domain/insights/providers.js
//
// WP8 — the Providers slice of the central Insights read model. Genuinely new aggregation:
// nothing in the app currently ranks Billers/Providers by real spend (confirmed by repo-wide
// search this session — every billerAccounts.filter(...) usage is form/lookup plumbing, not
// aggregation). Built on the same real fields every other Bill-derived figure uses —
// getNetBillAmount for refund netting (the same function Committed Spending's Bill entries use),
// bill.paidDate/status for "did this actually happen" — nothing estimated.

import { getNetBillAmount } from "../../src/domain/bills/refunds.js";

/**
 * Every Biller/Provider ranked by real (paid, refund-netted) spend within a period. A Bill
 * counts only once it's actually paid — this is a record of money that left the household, not
 * a projection of what's owed (Outlook's Future Money already owns that question).
 *
 * @param {Array} bills
 * @param {Array} billerAccounts - [{id, name, type}]
 * @param {string} monthKey - "YYYY-MM"
 * @param {Object} [refundTotalsByBill] - from buildRefundTotalsByBill, defaults to {} (no refunds)
 * @returns {Array<{billerAccount, count, total}>} sorted descending by total; billerless or
 *   zero-total providers are omitted, never shown as a fabricated zero row
 */
export function getProviderSpendBreakdown(bills, billerAccounts, monthKey, refundTotalsByBill = {}) {
  const byAccount = new Map();
  (bills || []).forEach(b => {
    if (b.status !== "paid" || !b.billerAccountId || !b.paidDate || !String(b.paidDate).startsWith(monthKey)) return;
    const net = getNetBillAmount(b, refundTotalsByBill);
    if (!(net > 0)) return;
    const key = String(b.billerAccountId);
    const existing = byAccount.get(key) || { count: 0, total: 0 };
    existing.count += 1;
    existing.total += net;
    byAccount.set(key, existing);
  });
  return Array.from(byAccount.entries())
    .map(([id, agg]) => ({ billerAccount: (billerAccounts || []).find(ba => String(ba.id) === id) || null, ...agg }))
    .filter(row => row.billerAccount && row.total > 0)
    .sort((a, b) => b.total - a.total);
}
