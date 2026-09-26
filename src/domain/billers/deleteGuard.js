// domain/billers/deleteGuard.js
//
// QW-5 (UI-2C plan). What still points at a billerAccount, so it cannot be
// deleted without orphaning references. Transactions were missing from the
// original inline guard: a txn's billerLinkId (set by "Link to") would be left
// pointing at a deleted account. This was already requested in
// PPL-relationship-architecture-decision.md ("Bug fix").
//
// Pure: counts only, decides nothing about what the user should do next.

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * @returns {{ bills:number, memberships:number, feePayments:number, txns:number, total:number }}
 */
export function getBillerAccountDeleteBlockers(billerAccountId, { bills = [], memberships = [], feePayments = [], txns = [] } = {}) {
  const counts = {
    bills: bills.filter(b => sameId(b?.billerAccountId, billerAccountId)).length,
    memberships: memberships.filter(m => sameId(m?.billerAccountId, billerAccountId)).length,
    feePayments: feePayments.filter(f => sameId(f?.billerAccountId, billerAccountId)).length,
    txns: txns.filter(t => sameId(t?.billerLinkId, billerAccountId)).length,
  };
  counts.total = counts.bills + counts.memberships + counts.feePayments + counts.txns;
  return counts;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Human sentence naming exactly what is linked, e.g. "2 bills and 5 transactions". */
export function describeBillerAccountDeleteBlockers(counts) {
  const parts = [];
  if (counts.bills) parts.push(plural(counts.bills, "bill", "bills"));
  if (counts.memberships) parts.push(plural(counts.memberships, "membership", "memberships"));
  if (counts.feePayments) parts.push(plural(counts.feePayments, "fee payment", "fee payments"));
  if (counts.txns) parts.push(plural(counts.txns, "transaction", "transactions"));
  if (parts.length <= 1) return parts[0] || "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
