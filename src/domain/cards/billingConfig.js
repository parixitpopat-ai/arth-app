// domain/cards/billingConfig.js
//
// Credit Card WP — effective-dated billing configuration. A `cc` account's
// billing (statement day, due day, pay-from account) can change over time,
// but a historical Statement Bill was generated under whatever configuration
// was in effect when it was built, and must never be reinterpreted through
// today's mutable config (WP rule 3). `billingHistory` is the dated-version
// list this module reads/writes; the account's legacy `statementDate`/
// `dueDate` fields are kept as the fallback "v1" version for cards that
// predate this model (see migrateLegacyBillingHistory below) — no second
// Account model, per the WP's locked model.
//
// Version shape: { effectiveFrom: "YYYY-MM-DD", statementDay, dueDay, payFromAccId, createdAt }

/**
 * The billing config in effect on a given date — the latest version whose
 * effectiveFrom is on/before that date. Falls back to the account's legacy
 * statementDate/dueDate/payFromAccId fields if billingHistory is empty or
 * unset, so cards that predate this model keep working unchanged.
 */
export function getEffectiveBillingConfig(account, dateStr) {
  const history = Array.isArray(account?.billingHistory) ? account.billingHistory : [];
  const candidates = history.filter(v => v.effectiveFrom && v.effectiveFrom <= dateStr);
  if (candidates.length === 0) {
    return {
      effectiveFrom: null,
      statementDay: Math.max(1, Math.min(31, parseInt(account?.statementDate || 15, 10))),
      dueDay: Math.max(1, Math.min(31, parseInt(account?.dueDate || 5, 10))),
      payFromAccId: account?.paymentAccId || null,
    };
  }
  return candidates.reduce((latest, v) => (v.effectiveFrom > latest.effectiveFrom ? v : latest));
}

/**
 * Legacy cards have no billingHistory at all — this seeds a single v1 version
 * from the account's existing statementDate/dueDate fields, effective from
 * "the beginning" (a sentinel earlier than any real transaction date), so
 * getEffectiveBillingConfig has something concrete to hand back for every
 * historical period. Never fabricates a different value than what the card
 * already had; purely a representation migration, not a data change.
 */
export function migrateLegacyBillingHistory(account) {
  if (Array.isArray(account?.billingHistory) && account.billingHistory.length > 0) return account;
  return {
    ...account,
    billingHistory: [{
      effectiveFrom: "2000-01-01",
      statementDay: Math.max(1, Math.min(31, parseInt(account?.statementDate || 15, 10))),
      dueDay: Math.max(1, Math.min(31, parseInt(account?.dueDate || 5, 10))),
      payFromAccId: account?.paymentAccId || null,
      createdAt: account?.createdAt || "2000-01-01",
    }],
  };
}

/**
 * The earliest date a new billing version is allowed to take effect from —
 * the day after the most recently generated statement's period end, so a
 * change can never land inside (or before) an already-generated Bill's
 * period, per the WP's "cannot select a statement period that already has a
 * generated Bill" rule. Returns null if no statement has ever been
 * generated for this card (any future date is fine).
 */
export function getEarliestEligibleChangeDate(cardId, bills) {
  const cardBills = (bills || []).filter(b => b.isCcStatement && b.accId === cardId && b.periodTo);
  if (cardBills.length === 0) return null;
  const latestPeriodTo = cardBills.map(b => b.periodTo).sort().slice(-1)[0];
  const d = new Date(latestPeriodTo);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Validates and returns the new billingHistory array for a billing change.
 * Throws (never silently clamps) if effectiveFrom would land inside an
 * already-generated statement's period.
 */
export function addBillingVersion(account, { effectiveFrom, statementDay, dueDay, payFromAccId }, bills, createdAt) {
  const earliestEligible = getEarliestEligibleChangeDate(account.id, bills);
  if (earliestEligible && effectiveFrom < earliestEligible) {
    throw new Error(`Billing changes can only apply from ${earliestEligible} onward — earlier periods already have a generated statement.`);
  }
  const history = migrateLegacyBillingHistory(account).billingHistory;
  return [...history, { effectiveFrom, statementDay, dueDay, payFromAccId: payFromAccId || null, createdAt: createdAt || effectiveFrom }];
}
