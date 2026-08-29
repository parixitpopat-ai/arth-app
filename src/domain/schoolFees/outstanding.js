// domain/schoolFees/outstanding.js
//
// Single source of truth for "how much is currently outstanding on this fee
// period." Used by settlement (WP-5), discount/write-off (WP-6), credit
// notes (WP-7), and will be used by the annual view (WP-9) and the Future
// Money adapter (WP-8). Defined once, deliberately, so these can't drift
// apart the way the three independent SIP-commitment calculations did
// elsewhere in the codebase — same formula, one place, every consumer reads
// it from here.

/**
 * @param {Object} period - a feePeriods[] record
 * @returns {number} current outstanding balance, floored at 0
 */
export function calculateOutstanding(period) {
  const v = (period.obligationAmount || 0)
    - (period.paidAmount || 0)
    - (period.discountAmount || 0)
    - (period.writeOffAmount || 0)
    - (period.appliedCreditAmount || 0);
  return Math.max(0, v);
}
