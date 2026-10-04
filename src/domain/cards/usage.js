// domain/cards/usage.js
//
// One definition of "how much of a credit card is in use", so every screen agrees.
//   billed    what is owed on statements already issued and not yet paid (cardOutstanding / getCardSummary.totalOutstanding)
//   unbilled  charges since the last statement, waiting for the next one (getCardSummary.currentCycleSpend)
//   used      billed + unbilled - this is what the bank counts against the limit, so available limit and
//             utilisation are worked out from it (not from the billed amount alone).
// Arth only records transactions whose money has been taken, so there is no separate "unsettled" amount.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

export function getCardUsage({ limit, billedOutstanding, unbilled }) {
  const lim = Number(limit) || 0;
  const billed = Math.max(0, r2(billedOutstanding));
  const pending = Math.max(0, r2(unbilled));
  const used = r2(billed + pending);
  const hasLimit = lim > 0;
  return {
    hasLimit, billed, unbilled: pending, used,
    available: hasLimit ? Math.max(0, r2(lim - used)) : null,
    utilisationPct: hasLimit ? Math.min(100, Math.round((used / lim) * 100)) : null,
    overLimit: hasLimit && used > lim,
  };
}
