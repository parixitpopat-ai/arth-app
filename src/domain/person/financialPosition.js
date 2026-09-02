// domain/person/financialPosition.js
//
// Pure. Reads the existing, authoritative settlements[p.id] shape — never
// computes a balance independently, never stores one. This module only
// labels and explains what settlements already produced.

/**
 * @param {{owesMe:number, iOwe:number}} settlement - settlements[p.id],
 *   the existing authoritative shape, as-is
 * @returns {{state:"balanced"|"owed_to_me"|"i_owe", label:string, amount:number, owesMe:number, iOwe:number}}
 */
export function getFinancialPositionLabel(settlement) {
  const owesMe = Number(settlement?.owesMe || 0);
  const iOwe = Number(settlement?.iOwe || 0);
  const net = owesMe - iOwe;

  if (net === 0) {
    return { state: "balanced", label: "Balanced", amount: 0, owesMe, iOwe };
  }
  if (net > 0) {
    return { state: "owed_to_me", label: "They owe you", amount: net, owesMe, iOwe };
  }
  return { state: "i_owe", label: "You owe them", amount: Math.abs(net), owesMe, iOwe };
}

/**
 * "How this is worked out" — an honest, non-authoritative EXPLANATION of
 * settlements[p.id]'s total, listing the real contributing transactions
 * and bills. This never recomputes the total independently — the total
 * shown alongside this breakdown always comes from settlements[p.id]
 * itself; this function only enumerates what's behind it, for
 * transparency, using the same existing, already-correct attribution
 * primitive (getPersonAttributedAmount) rather than a second calculation.
 *
 * @param {string} personId
 * @param {Array} txns
 * @param {Array} bills
 * @param {Function} getPersonAttributedAmount - injected, the real
 *   existing function, never reimplemented here
 * @returns {Array<{id, kind:"txn"|"bill", desc, amount, mode:"owesMe"|"iOwe", date}>}
 *   sorted most-recent first; only entries with a genuine non-zero
 *   attributed amount for this person are included
 */
export function getFinancialPositionBreakdown(personId, txns, bills, getPersonAttributedAmount) {
  const items = [];

  for (const t of (txns || [])) {
    if (!t || t.type !== "expense") continue;
    const info = t.people?.[personId];
    if (!info) continue;
    const amount = getPersonAttributedAmount(t, personId);
    if (!(amount > 0)) continue;
    items.push({
      id: t.id, kind: "txn",
      desc: t.desc || t.merchant || "Expense",
      amount,
      mode: info.mode === "owes" ? "owesMe" : "iOwe",
      date: t.date || null,
    });
  }

  for (const b of (bills || [])) {
    if (!b) continue;
    const info = b.splitPeople?.[personId];
    if (!info) continue;
    const remaining = Number(info.amount || 0) - Number(info.settledAmt || 0);
    if (!(remaining > 0)) continue;
    items.push({
      id: b.id, kind: "bill",
      desc: b.name || b.merchant || "Bill",
      amount: remaining,
      mode: info.mode === "owes" ? "owesMe" : "iOwe",
      date: b.dueDate || null,
    });
  }

  return items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
