// domain/payTogether/group.js
//
// Plan Ahead PA10-PA13 - "Pay together": several upcoming instalments planned for ONE payment date.
// A group sits ON TOP of the instalments: their due dates and amounts are untouched, nothing is paid by
// creating one, and removing an instalment (or undoing the group) just puts it back where it was.
// Only instalments that already exist can be grouped (a Bill, a School Fee period, a SIP instalment);
// Expected items are not real instalments yet and are never offered.

export const PAYABLE_SOURCE_TYPES = ["bill", "feePeriod", "recurringSchedule"];

export const itemKey = ({ sourceType, sourceId }) => `${sourceType}:${sourceId}`;

const isOpen = e => e && e.date && e.status !== "paid" && Number(e.amount) > 0 && PAYABLE_SOURCE_TYPES.includes(e.sourceType);

/** Keys already inside some group (optionally ignoring one group, so its own items stay listed). */
export function groupedKeys(groups, exceptGroupId = null) {
  const set = new Set();
  for (const g of groups || []) {
    if (exceptGroupId != null && String(g.id) === String(exceptGroupId)) continue;
    for (const it of g.items || []) set.add(itemKey(it));
  }
  return set;
}

/** Upcoming (not overdue), unpaid, real instalments that aren't already in a group, soonest first. */
export function listPayableInstalments(events, groups, today) {
  const taken = groupedKeys(groups);
  return (events || [])
    .filter(e => isOpen(e) && e.date >= today && !taken.has(itemKey(e)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** @returns {{ok:true, group:Object}|{ok:false, reason:string}} */
export function createGroup({ events, keys, date, genId }) {
  if (!date) return { ok: false, reason: "Choose a payment date." };
  const byKey = new Map((events || []).map(e => [itemKey(e), e]));
  const items = [...new Set(keys || [])].filter(k => isOpen(byKey.get(k))).map(k => {
    const e = byKey.get(k);
    return { sourceType: e.sourceType, sourceId: e.sourceId };
  });
  if (items.length < 2) return { ok: false, reason: "Pick at least two instalments." };
  return { ok: true, group: { id: genId(), date, items, createdAt: Date.now() } };
}

/** Group with one item taken out; null when fewer than two remain (a group of one isn't "together"). */
export function removeItem(group, key) {
  const items = (group.items || []).filter(it => itemKey(it) !== key);
  return items.length < 2 ? null : { ...group, items };
}

/** The group's instalments that still exist and are unpaid, as the live events. */
export function liveItems(group, events) {
  const byKey = new Map((events || []).map(e => [itemKey(e), e]));
  return (group.items || []).map(it => byKey.get(itemKey(it))).filter(isOpen);
}

/** The group's total cash (sum of its live instalments). */
export function groupTotal(group, events) {
  return Math.round(liveItems(group, events).reduce((s, e) => s + Number(e.amount), 0) * 100) / 100;
}
