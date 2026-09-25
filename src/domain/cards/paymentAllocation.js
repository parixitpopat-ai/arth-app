// domain/cards/paymentAllocation.js
//
// Credit Card WP, rule 10 / test I: paying a card must not be blocked by
// verification status, and once paid, the specific generated statement Bill
// record needs to flip to "paid" — otherwise it lingers as unpaid in
// Payments -> Bills forever, even though a real cc_payment already covered
// it (getCardSummary/cardOutstanding already recalculate the card's own
// running balance live from cc_payment transactions; this module is the
// missing piece that reflects the same fact onto the Bill record itself).
//
// Allocation rule: oldest unpaid statement first (by periodTo), against
// cc_payment transactions posted to this card after that statement's period
// closed, oldest transaction first, consumed cumulatively — a payment can
// close more than one bill, and a bill isn't marked paid until payments
// covering it (possibly several, summed) reach its amount. Never marks a
// bill paid on a partial payment, and never double-allocates the same
// transaction amount to two bills.

const AMOUNT_EPSILON = 0.005;

/**
 * @returns {Array<{billId, paidByTxnId, paidDate}>} the statement Bills that
 *   should flip to paid, and the transaction whose cumulative coverage
 *   closed each one — caller applies these as a patch, never this module
 *   itself (kept pure, no setState).
 */
export function allocateCcPaymentsToStatements(card, bills, txns) {
  const unpaidStatements = (bills || [])
    .filter(b => b.isCcStatement && b.accId === card.id && b.status !== "paid")
    .sort((a, b) => String(a.periodTo).localeCompare(String(b.periodTo)));
  if (unpaidStatements.length === 0) return [];

  const payments = (txns || [])
    .filter(t => t.type === "cc_payment" && t.toAccId === card.id && t.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(t => ({ txn: t, remaining: Number(t.amount || 0) }));

  const results = [];
  for (const bill of unpaidStatements) {
    let covered = 0;
    let closingTxn = null;
    for (const p of payments) {
      if (p.remaining <= 0) continue;
      if (String(p.txn.date) <= bill.periodTo) continue; // payment must postdate the statement closing
      const take = Math.min(p.remaining, Number(bill.amount || 0) - covered);
      if (take <= 0) continue;
      p.remaining -= take;
      covered += take;
      closingTxn = p.txn;
      if (covered >= Number(bill.amount || 0) - AMOUNT_EPSILON) break;
    }
    if (closingTxn && covered >= Number(bill.amount || 0) - AMOUNT_EPSILON) {
      results.push({ billId: bill.id, paidByTxnId: closingTxn.id, paidDate: closingTxn.date });
    }
  }
  return results;
}
