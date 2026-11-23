// src/domain/transactions/uncategorised.js — which expenses still have no category, for the "Sort them" banner on Transactions. Pure.
// An expense counts when it has no category at all (catIds / catId empty) and none of its line items has one either (an itemised expense is categorised by its items).
const hasCat = t => (Array.isArray(t.catIds) && t.catIds.some(Boolean)) || Boolean(t.catId);
const itemsHaveCat = t => Array.isArray(t.items) && t.items.some(i => i && (Boolean(i.catId) || (Array.isArray(i.catIds) && i.catIds.some(Boolean))));

/** @param {Array} txns @returns {Array} ids of the expenses with no category, in the order given */
export function uncategorisedExpenseIds(txns) {
  const out = [];
  for (const t of txns || []) {
    if (!t || t.type !== "expense" || t.isRefund || t.id == null) continue;
    if (hasCat(t) || itemsHaveCat(t)) continue;
    out.push(t.id);
  }
  return out;
}
