// domain/cards/usage.js
//
// One definition of "how much of a credit card is in use", so every screen agrees.
//   billed    what is owed on statements already issued and not yet paid (cardOutstanding / getCardSummary.totalOutstanding)
//   unbilled  charges since the last statement, waiting for the next one (getCardSummary.currentCycleSpend)
//   used      billed + unbilled - this is what the bank counts against the limit, so available limit and
//             utilisation are worked out from it (not from the billed amount alone).
// Arth only records transactions whose money has been taken, so there is no separate "unsettled" amount.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

//   emiBalance what is still to be billed on EMI purchases made on the card (their instalments are dated in the future, so they are in
//             neither billed nor unbilled yet). A bank keeps that balance blocked on the limit until the EMI is paid off.
//             I am not certain every bank does this the same way: check a card's available limit against its own statement.
export function getCardUsage({ limit, billedOutstanding, unbilled, emiBalance = 0 }) {
  const lim = Number(limit) || 0;
  const billed = Math.max(0, r2(billedOutstanding));
  const pending = Math.max(0, r2(unbilled));
  const emi = Math.max(0, r2(emiBalance));
  const used = r2(billed + pending + emi);
  const hasLimit = lim > 0;
  return {
    hasLimit, billed, unbilled: pending, emi, used,
    available: hasLimit ? Math.max(0, r2(lim - used)) : null,
    utilisationPct: hasLimit ? Math.min(100, Math.round((used / lim) * 100)) : null,
    overLimit: hasLimit && used > lim,
  };
}

/** Totals across cards for the Money screen: only cards with a limit count toward the limit and utilisation. */
export function summariseCardLimits(rows) {
  const withLimit = (rows || []).filter(r => r?.usage?.hasLimit);
  const totalLimit = r2(withLimit.reduce((s, r) => s + Number(r.limit || 0), 0));
  const totalUsed = r2(withLimit.reduce((s, r) => s + r.usage.used, 0));
  return {
    cardCount: (rows || []).length, cardsWithLimit: withLimit.length,
    totalLimit, totalUsed, totalAvailable: r2(Math.max(0, totalLimit - totalUsed)),
    utilisationPct: totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : null,
  };
}

/** What is still to be billed on active card-EMI purchases made on this card (the loans an EMI purchase creates, `autoScheduled`). */
export function emiBalanceForCard(loans, cardId) {
  return r2((loans || []).filter(l => l && l.direction === "taken" && l.status === "active" && l.autoScheduled === true && String(l.paymentAccId) === String(cardId))
    .reduce((t, l) => t + Math.max(0, Number(l.outstanding) || 0), 0));
}
