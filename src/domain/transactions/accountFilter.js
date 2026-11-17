// The Transactions screen's "Account or card" filter: everything that touches ONE account or card, whatever the type (purchase, payment, refund,
// transfer, part-paid slice), plus a card's statement periods as one-tap date ranges. Pure; reads only.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = iso => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** The account itself plus any UPI handle / rail linked to it (spending through a linked handle is spending on this account). */
export function accountIdSet(accountId, accounts = []) {
  const id = String(accountId);
  const set = new Set([id]);
  for (const a of accounts || []) if (a && a.linkedAccount != null && String(a.linkedAccount) === id) set.add(String(a.id));
  return set;
}

/** True when the transaction moves money on / off this account: its account, either end of a transfer or card payment, or a slice of a part-paid expense. */
export function txnTouchesAccount(t, accountId, accounts = []) {
  if (!t) return false;
  const ids = accountIdSet(accountId, accounts);
  const has = v => v != null && v !== "" && ids.has(String(v));
  if (has(t.accId) || has(t.fromAccId) || has(t.toAccId)) return true;
  return Array.isArray(t.paymentLines) && t.paymentLines.some(l => l && has(l.accId));
}

/**
 * A card's statement periods (newest first) as filter ranges. A statement covers (periodFrom, periodTo], so the first day inside it is the day AFTER periodFrom.
 * @returns {Array<{id:string, from:string, to:string, label:string}>}
 */
export function cardStatementPeriods(bills = [], accountId, addDay, limit = 6) {
  return (bills || [])
    .filter(b => b && b.isCcStatement && String(b.accId) === String(accountId) && /^\d{4}-\d{2}-\d{2}/.test(b.periodFrom || "") && /^\d{4}-\d{2}-\d{2}/.test(b.periodTo || ""))
    .sort((a, b) => String(b.periodTo).localeCompare(String(a.periodTo)))
    .slice(0, limit)
    .map(b => { const from = addDay(String(b.periodFrom).slice(0, 10), 1), to = String(b.periodTo).slice(0, 10); return { id: String(b.id), from, to, label: `${day(from)} – ${day(to)}` }; });
}
