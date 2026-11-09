// domain/transactions/completeness.js
//
// "Needs details": an expense should have (1) a category, (2) a sub-category (when that category has any), and (3) someone or something it
// belongs to: Me, another person, a one-time person, a group, or (for vehicle costs) a vehicle. "Me" is a person: the one who enters the expenses,
// so an expense tagged to Me alone is complete. What fails (3) is an expense tagged to nobody at all.
// Nothing here blocks a save; it only reports what is missing so the app can show it.
//
// Set ME_COUNTS_AS_OWNER to false if Me alone should be reported as missing a person or group.
export const ME_COUNTS_AS_OWNER = true;
export const ME_KEY = "__me__";

export const GAP_LABELS = { category: "No category", subcategory: "No sub-category", owner: "No person or group" };

const list = (arr, single) => (Array.isArray(arr) && arr.length ? arr : single ? [single] : []).filter(Boolean);

/** @returns {Array<"category"|"subcategory"|"owner">} what an expense is missing (empty when complete or not an expense) */
export function expenseGaps(txn, cats = [], { meCounts = ME_COUNTS_AS_OWNER, mePersonId = "" } = {}) {
  if (!txn || txn.type !== "expense") return [];
  const gaps = [];
  const catIds = list(txn.catIds, txn.catId);
  if (!catIds.length) gaps.push("category");
  else {
    const needsSub = catIds.some(id => ((cats || []).find(c => c.id === id)?.subs || []).length > 0);
    const itemHasSub = Array.isArray(txn.lineItems) && txn.lineItems.some(li => li && (li.subId || (Array.isArray(li.subIds) && li.subIds.length)));
    if (needsSub && !list(txn.subIds, txn.subId).length && !itemHasSub) gaps.push("subcategory");
  }
  const people = txn.people && typeof txn.people === "object" ? txn.people : {};
  const isMe = id => id === ME_KEY || (Boolean(mePersonId) && String(id) === String(mePersonId));   // the operator of the app, by either of its two names
  const otherPerson = Object.keys(people).some(k => !isMe(k)) || (Boolean(txn.paidByPersonId) && !isMe(txn.paidByPersonId)) || Boolean(String(txn.guestPerson || "").trim());
  const meOnly = Object.keys(people).some(isMe) || (Boolean(txn.paidByPersonId) && isMe(txn.paidByPersonId));
  const hasGroup = Boolean(txn.groupId) || (Array.isArray(txn.groupAllocations) && txn.groupAllocations.some(g => g && g.groupId));
  if (!txn.vehicleId && !hasGroup && !otherPerson && !(meCounts && meOnly)) gaps.push("owner");
  return gaps;
}

/** Every expense that is missing something, newest first, with totals. */
export function summarizeGaps(txns = [], cats = [], opts) {
  const items = [];
  const byGap = { category: 0, subcategory: 0, owner: 0 };
  let amount = 0;
  for (const t of txns || []) {
    const gaps = expenseGaps(t, cats, opts);
    if (!gaps.length) continue;
    items.push({ txn: t, gaps });
    amount += Number(t.amount) || 0;
    for (const g of gaps) byGap[g] += 1;
  }
  items.sort((a, b) => String(b.txn.date || "").localeCompare(String(a.txn.date || "")) || String(b.txn.id).localeCompare(String(a.txn.id)));
  return { total: items.length, amount, byGap, items };
}
